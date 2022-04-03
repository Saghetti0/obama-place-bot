import { ApolloClient, gql, NormalizedCacheObject } from "@apollo/client";
import { inspect } from "util";
import { WebSocket } from "ws";
import { Pixel } from "./controlLogic";

const wsAddress = "wss://obama.gg/place/ws";

const version = "0.0.1";

export class ClientLogic {
  private ws: WebSocket;
  private job: Pixel | null = null;
  private nextPixelTimestamp: number | null = null;

  constructor(
    private readonly client: ApolloClient<NormalizedCacheObject>,
  ) {
    this.ws = new WebSocket(wsAddress);
  }
  
  async putPixel(tag: number, x: number, y: number, color: number) {
    //{"operationName":"setPixel","variables":{"input":{"actionName":"r/replace:set_pixel","PixelMessageData":{"coordinate":{"x":204,"y":619},"colorIndex":27,"canvasIndex":0}}},"query":"mutation setPixel($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          ... on SetPixelResponseMessageData {\n            timestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n"}
    return await this.client.mutate({
      mutation: gql`
        mutation setPixel($input: ActInput!) {
          act(input: $input) {
            data {
              ... on BasicMessage {
                id
                data {
                  ... on GetUserCooldownResponseMessageData {
                    nextAvailablePixelTimestamp
                    __typename
                  }
                  ... on SetPixelResponseMessageData {
                    timestamp
                    __typename
                  }
                  __typename
                }
                __typename
              }
              __typename
            }
            __typename
          }
        }
      `,
      variables: {
        input: {
          actionName: "r/replace:set_pixel",
          PixelMessageData: {
            coordinate: {
              x,
              y,
            },
            colorIndex: color,
            canvasIndex: tag.toString(),
          },
        },
      },
    });
  }

  async getNextPixelTimestamp() {
    // {"operationName":"getUserCooldown","variables":{"input":{"actionName":"r/replace:get_user_cooldown"}},"query":"mutation getUserCooldown($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n"}
    const response = await this.client.mutate({
      mutation: gql`mutation getUserCooldown($input: ActInput!) {
        act(input: $input) {
          data {
            ... on BasicMessage {
              id
              data {
                ... on GetUserCooldownResponseMessageData {
                  nextAvailablePixelTimestamp
                  __typename
                }
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
      }
      `,
      variables: {
        input: {
          actionName: "r/replace:get_user_cooldown",
        },
      },
    });

    return response?.data?.act?.data[0]?.data?.nextAvailablePixelTimestamp + 5000;
  }

  async placeCurrentJob() {
    console.log("placing pixel...");

    if (this.job) {
      this.putPixel(this.job.tag, this.job.tagX, this.job.tagY, this.job.color).then((r) => {
        console.log("pixel placed", r);
      }).catch((e) => {
        console.log("error", e);
      }).finally(async () => {
        this.nextPixelTimestamp = await this.getNextPixelTimestamp();
        if (this.nextPixelTimestamp) {
          console.log(`need to wait ${Math.floor((this.nextPixelTimestamp-Date.now())/1000)} seconds before next pixel`);
        } else {
          console.log("no cooldown??");
        }
      });
    }
  }

  async run() {
    console.log("connecting to ws");

    this.ws.on("close", () => {
      throw new Error("ws closed");
    });

    this.ws.on("error", (e) => {
      throw new Error(`ws error: ${e}`);
    });

    this.ws.on("message", (data: string) => {
      const message = JSON.parse(data);

      switch (message.type) {
        case "init_response": {
          console.log("Connected to server.");
          console.log(message.data.motd);
          console.log("\nWaiting for a job, hang tight...");

          break;
        }

        case "disconnect": {
          console.log("\n=== Disconnected from server ===");
          console.log(message.data.reason);
          console.log("================================\n");

          break;
        }

        case "set_job": {
          this.job = message.data.job;

          if (this.job === null || this.job === undefined) {
            console.log("New job: nothing (for now)");
            break;
          }

          console.log(`New job: place pixel at ${this.job.x},${this.job.y} (color: ${this.job.color} | ${this.job.tagX},${this.job.tagY}@${this.job.tag})`);

          break;
        }
      }
    });

    await new Promise<void>((resolve) => {
      this.ws.on("open", () => {
        console.log("connected to ws");

        this.ws.send(JSON.stringify({
          type: "init",
          data: {
            version: version,
          }
        }));

        resolve();
      });
    });

    this.nextPixelTimestamp = await this.getNextPixelTimestamp();

    if (this.nextPixelTimestamp) {
      console.log(`need to wait ${Math.floor((this.nextPixelTimestamp-Date.now())/1000)} seconds before next pixel`);
    } else {
      console.log("no cooldown right now");
    }

    while (true) {
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));

      if (this.job === null) {
        continue;
      }

      if (this.nextPixelTimestamp === null) {
        await this.placeCurrentJob();
      }

      if (this.nextPixelTimestamp !== null && this.nextPixelTimestamp < (Date.now())) {
        await this.placeCurrentJob();
      }
    }
  }
}
