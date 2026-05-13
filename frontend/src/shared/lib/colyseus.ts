import { Client, Room } from "@colyseus/sdk";
import { env } from "../config/env";

export const createColyseusClient = () => new Client(env.colyseusUrl);

export type { Room };
