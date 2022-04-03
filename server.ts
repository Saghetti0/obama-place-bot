import { WebSocket, WebSocketServer } from 'ws';
import uuid from "uuid";
import fs from "fs";
import { Message } from './messages';
import { ControlLogic, Pixel } from './controlLogic';

const serverVersion = "0.0.1";
const motd = fs.readFileSync("motd.txt", "utf8");

export class Client {
  public isReady = false;
  public job: Pixel | null = null;

  constructor(private ws: WebSocket, private id: string, private server: Server) {
    this.ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on("close", (e) => {
      console.log(`Client ${this.id} disconnected (code ${e})`);
      this.server.handleClose(this);
    });

    this.ws.on("error", (e) => {
      console.log(`Client ${this.id} exited with error ${e}`);
      this.server.handleClose(this);
    })
  }

  getId() {
    return this.id;
  }

  private sendDisconnect(reason: string) {
    this.ws.send(JSON.stringify({
      type: "disconnect",
      data: {
        reason: reason,
      }
    }));
  }

  private sendMessage(message: Message) {
    this.ws.send(JSON.stringify(message));
  }

  setJob(job: Pixel | null) {
    this.job = job;

    this.sendMessage({
      type: "set_job",
      data: {
        job: job,
      }
    });
  }

  private handleMessage(message: Partial<Message>) {
    if (typeof message !== "object" || message === null) return;

    switch (message.type) {
      case "init": {
        if (message.data?.version != serverVersion) {
          this.sendDisconnect(`Your client is out of date! You're on version ${message.data?.version}, but the server is on version ${serverVersion}.\nDownload the latest version at https://obama.gg/place/`);
          console.log(`Client ${this.id} was outdated! Client version: ${message.data?.version}, server version: ${serverVersion}`);
          return;
        }

        console.log(`Client ${this.id} sent init and got accepted`);
        this.isReady = true;

        this.sendMessage({
          type: "init_response",
          data: {
            motd: motd,
          }
        });

        break;
      }

      case "get_job": {
        this.sendMessage({
          type: "set_job",
          data: {
            job: this.job
          }
        });

        break;
      }
    }
  }
}

export class Server {
  private serverWs = new WebSocketServer({ port: 8181 });
  public clients: Map<string, Client> = new Map();

  constructor(private readonly controlLogic: ControlLogic) {
    this.serverWs.on("connection", (ws: WebSocket) => {
      const id = uuid.v1();
      const client = new Client(ws, id, this);
      this.clients.set(id, client);
      console.log(`Client ${id} connected`);
    });
  }
  
  public handleClose(client: Client) {
    this.clients.delete(client.getId());
    if (client.job !== null) {
      const jobId = `${client.job?.x},${client.job?.y}`;
      console.log("freed", jobId, "from", client.getId());
      this.controlLogic.jobOwnerMap.set(jobId, null);
    }
  }
}
