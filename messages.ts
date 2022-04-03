import { Pixel } from "./controlLogic"

export type MessageInit = { 
  type: "init";
  data: {
    version: string;
  }
}

export type MessageInitResponse = { 
  type: "init_response";
  data: {
    motd: string;
  }
}

export type MessageDisconnect = {
  type: "disconnect";
  data: {
    reason: string;
  }
}

export type MessageGetJob = {
  type: "get_job";
  data: {};
}

export type MessageSetJob = {
  type: "set_job";
  data: {
    job: Pixel | null;
  }
}

export type Message = MessageInit | MessageInitResponse | MessageDisconnect | MessageGetJob | MessageSetJob;
