import dynamic from "next/dynamic";
import type { GameManifest } from "@/entities/game/model/types";

// Phaser + canvas pull in browser globals — load the table only on the client.
const Table = dynamic(() => import("./ui/TetrisTable"), { ssr: false });

export const tetrisManifest: GameManifest = {
  id: "tetris",
  roomName: "tetris",
  displayName: "테트리스",
  description:
    "1~6명 대전. 솔로 연습부터 6인 가비지 배틀까지. 2줄 이상 클리어 시 상대 보드로 가비지 발사, 마지막 1인이 라운드 승리.",
  minPlayers: 1,
  maxPlayers: 6,
  available: true,
  Table,
};
