import { gql, NormalizedCacheObject, ApolloClient } from "@apollo/client";
import ndarray from "ndarray";
import getPixels from "get-pixels";
import fs from "fs";
import { Client, Server } from "./server";
import fetch from "node-fetch";
import Jimp from "jimp";

export type Pixel = {
  x: number;
  y: number;
  color: number;
  tag: number;
  tagX: number;
  tagY: number;
}

const colorLookup: Record<string, number> = {
  "#BE0039": 1,
  "#FF4500": 2,
  "#FFA800": 3,
  "#FFD635": 4,
  "#00A368": 6,
  "#00CC78": 7,
  "#7EED56": 8,
  "#00756F": 9,
  "#009EAA": 10,
  "#2450A4": 12,
  "#3690EA": 13,
  "#51E9F4": 14,
  "#493AC1": 15,
  "#6A5CFF": 16,
  "#811E9F": 18,
  "#B44AC0": 19,
  "#FF3881": 22,
  "#FF99AA": 23,
  "#6D482F": 24,
  "#9C6926": 25,
  "#000000": 27,
  "#898D90": 29,
  "#D4D7D9": 30,
  "#FFFFFF": 31
};

const tags: number[] = [0, 1, 2, 3];
const tagLocations: Record<string, [number, number]> = {
  "0": [0, 0],
  "1": [1000, 0],
  "2": [0, 1000],
  "3": [1000, 1000],
};

export class ControlLogic {
  //private pixelsPrevious: ndarray.NdArray<Uint8Array> | null = null;
  private isCheckRunning = false;
  private readonly desiredPixels: Map<string, Pixel> = new Map();
  private readonly placeServer = new Server(this);
  readonly jobOwnerMap: Map<string, string | null> = new Map();
  private lastDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAB9AAAAAUCAQAAAB/727eAAAAhElEQVR42u3XMQ0AAAzDsJU/6cGoKtkQ8iUHAAAA1EUCAAAAMOgAAACAQQcAAACDDgAAABh0AAAAMOgAAACAQQcAAACDDgAAABh0AAAAMOgAAACAQQcAAACDDgAAABh0AAAAMOgAAACAQQcAAACDDgAAABh0AAAAMOgAAACAQQcAAIANDwt4ABXCDxOWAAAAAElFTkSuQmCC";

  private getTagForPixel(x: number, y: number): number {
    const tag = tags.find((tag) => {
      const [tagX, tagY] = tagLocations[tag.toString()];
      return x >= tagX && x < tagX + 1000 && y >= tagY && y < tagY + 1000;
    });
    if (tag === undefined) {
      throw new Error(`Could not find tag for pixel ${x}, ${y}`);
    }
    return tag;
  }

  private getOffsetIntoTag(x: number, y: number): [number, number] {
    const [tagX, tagY] = tagLocations[this.getTagForPixel(x, y).toString()];
    return [x - tagX, y - tagY];
  }

  constructor(
    private graphql: ApolloClient<NormalizedCacheObject>
  ) {
    JSON.parse(fs.readFileSync("./image.json", "utf8")).forEach((element: any) => {
      this.desiredPixels.set(`${element[0]},${element[1]}`, {
        x: element[0],
        y: element[1],
        color: element[2],
        tag: this.getTagForPixel(element[0], element[1]),
        tagX: this.getOffsetIntoTag(element[0], element[1])[0],
        tagY: this.getOffsetIntoTag(element[0], element[1])[1],
      });
    });
  }

  private getCanvasLink(tag: number): Promise<string | null> {
    // this is particularly sad
    // relies on not using websockets in order for it to work
    // i can't be bothered to use ws to make it live updating though
    // would take too long
  
    return new Promise((resolve, reject) => {
      let link: string | null = null;
    
      this.graphql.subscribe({
        query: gql`subscription replace($input: SubscribeInput!) {
          subscribe(input: $input) {
            id
            ... on BasicMessage {
              data {
                __typename
                ... on FullFrameMessageData {
                  __typename
                  name
                  timestamp
                }
                ... on DiffFrameMessageData {
                  __typename
                  name
                  currentTimestamp
                  previousTimestamp
                }
              }
              __typename
            }
            __typename
          }
        }`,
        variables: {
          input: {
            channel: {
              category: "CANVAS",
              tag: tag.toString(),
              teamOwner: "AFD2022"
            },
          }
        }
      }).subscribe({
        next: (data) => {
          if (data.data?.subscribe?.__typename === "BasicMessage") {
            if (data.data?.subscribe?.data?.__typename === "FullFrameMessageData") {
              link = data.data?.subscribe?.data?.name;
            }
          }
        },
        error: (error) => {
          console.log("canvas.error", error);
          reject(error);
        },
        complete: () => {
          resolve(link);
        },
      });
    });
  }

  private async getCanvasAllTags() {
    console.time("getCanvasAllTags");
    // i'm stuff
    const stuff: Promise<string | null>[] = []

    for (let i = 0; i < tags.length; i++) {
      stuff.push(this.getCanvasLink(tags[i]));
    }

    const links: string[] = (await Promise.all(stuff)).filter((link) => typeof link === "string") as string[];
    // download all the images

    //console.log(links);

    const images = await Promise.all((await Promise.all(links.map(e => fetch(e)))).filter((e) => e.ok).map(e => e.buffer()));

    // composite the images on a 2000x2000 image

    const composite = new Jimp(2000, 2000);

    for (let i = 0; i < images.length; i++) {
      const location = tagLocations[tags[i].toString()];
      const image = await Jimp.read(images[i]);
      composite.blit(image, location[0], location[1]);
    }

    composite.write("./composite.png");
    
    const buf = await composite.getBufferAsync(Jimp.MIME_PNG);
    const url = `data:image/png;base64,${buf.toString("base64")}`

    this.lastDataUrl = url;

    console.timeEnd("getCanvasAllTags");
    return url;
  }

  private async scheduleJobs() {
    // find everyone who doesn't have a job
    const noJob: Client[] = [];

    this.placeServer.clients.forEach((client) => {
      if (!client.isReady) return;
      if (client.job !== null) return;

      noJob.push(client);
    });

    // find jobs that are available
    const availableJobs: string[] = [];
    
    this.jobOwnerMap.forEach((owner, job) => {
      if (owner === null) {
        availableJobs.push(job);
      }
    });

    // assign jobs
    for (let i = 0; i < noJob.length; i++) {
      const jobId: string | undefined = availableJobs.pop();

      if (jobId === undefined) break;

      const pixelData = this.desiredPixels.get(jobId);

      if (pixelData === undefined) {
        console.log("undefined pixel???", jobId);
        continue;
      }

      noJob[i].setJob(pixelData);
      this.jobOwnerMap.set(jobId, noJob[i].getId());

      console.log("assigned job", jobId, "to", noJob[i].getId());
    }
  }
  
  private async pixelCheck() {
    const canvasData = await this.getCanvasAllTags();
  
    try {
      const pixels = await new Promise<ndarray.NdArray<Uint8Array>>((resolve, reject) => {
        getPixels(canvasData, "image/png", (err, pixels) => {
          if (err) {
            console.log("error getting pixels", err);
            reject(err);
            return;
          }

          resolve(pixels);
        });
      });

      let newJobCount = 0;
      let removedJobCount = 0;

      for (let i = 0; i < pixels.shape[0]; i++) {
        for (let j = 0; j < pixels.shape[1]; j++) {
          // everything is going to happen in the top right quadrant

          // check if this pixel is in desired pixels
          const pixel = this.desiredPixels.get(`${i},${j}`);

          if (pixel === undefined) continue;

          const p1Red = pixels.get(i, j, 0);
          const p1Green = pixels.get(i, j, 1);
          const p1Blue = pixels.get(i, j, 2);
          const p1Alpha = pixels.get(i, j, 3);

          if (p1Alpha === 0) continue;

          // convert to hex color

          const hexColor = `#${p1Red.toString(16).padStart(2, "0")}${p1Green.toString(16).padStart(2, "0")}${p1Blue.toString(16).padStart(2, "0")}`;
          const jobId = `${i},${j}`;

          /*if (!colorLookup[hexColor] === undefined) {
            console.log("Wtf??", hexColor, "at", jobId);
          };*/

          if (colorLookup[hexColor] !== pixel.color) {
            if (!this.jobOwnerMap.has(jobId)) {
              console.log("new job", jobId);
              this.jobOwnerMap.set(jobId, null);
              newJobCount++;
            }
          } else {
            if (this.jobOwnerMap.has(jobId)) {
              console.log("removing job", jobId);
              
              const previousOwner = this.jobOwnerMap.get(jobId);
              this.jobOwnerMap.delete(jobId);
              if (previousOwner !== null && previousOwner !== undefined) {
                const previousClient = this.placeServer.clients.get(previousOwner);
                if (previousClient !== undefined) {
                  console.log("took job from", previousOwner);
                  previousClient.setJob(null);
                }
              }
              removedJobCount++;
            }
          }
        }
      }

      await this.scheduleJobs();

      console.log("new jobs:", newJobCount, "| removed jobs:", removedJobCount);
      console.log("total jobs:", this.jobOwnerMap.size, "| total pixels:", this.desiredPixels.size);

      let jobsWithOwners = 0;
      let jobsWithoutOwners = 0;

      this.jobOwnerMap.forEach((owner, job) => {
        if (owner === null) {
          jobsWithoutOwners++;
        } else {
          jobsWithOwners++;
        }
      });

      console.log("jobs with owners:", jobsWithOwners, "| jobs without owners:", jobsWithoutOwners);
    } catch (error) {
      console.log("error getting pixels", error);
    }
  }

  async run() {
    while (true) {
      await this.pixelCheck();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
