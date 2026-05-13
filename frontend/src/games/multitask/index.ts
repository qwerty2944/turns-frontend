import dynamic from "next/dynamic";
import type { GameManifest } from "@/entities/game/model/types";

// Phaser depends on browser globals — load the table only on the client.
const Table = dynamic(() => import("./ui/MultitaskTable"), { ssr: false });

export const multitaskManifest: GameManifest = {
  id: "multitask",
  roomName: "multitask",
  displayName: "멀티태스크",
  description:
    "3가지 미니태스크를 동시에! 솔로 연습도 가능. 하트 3개를 모두 잃으면 탈락, 최후 생존자 또는 3분 후 최고점수자가 승리.",
  minPlayers: 1,
  maxPlayers: 8,
  available: true,
  Table,
};
