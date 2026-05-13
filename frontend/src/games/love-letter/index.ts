import dynamic from "next/dynamic";
import type { GameManifest } from "@/entities/game/model/types";

// Phaser depends on browser globals — load the table only on the client.
const Table = dynamic(() => import("./ui/LoveLetterTable"), { ssr: false });

export const loveLetterManifest: GameManifest = {
  id: "love_letter",
  roomName: "love_letter",
  displayName: "러브레터",
  description:
    "16장의 카드, 마지막까지 살아남거나 가장 큰 카드를 든 자가 공주의 마음을 얻는다.",
  minPlayers: 2,
  maxPlayers: 4,
  available: true,
  Table,
};
