import Phaser from "phaser";
import { CARD_KEY, CARD_NAMES_KR } from "../model/cards";

export type SceneState = {
  myHand: number[];
  opponents: Array<{
    sessionId: string;
    nickname: string;
    discard: number[];
    eliminated: boolean;
    protected: boolean;
    tokens: number;
    isTurn: boolean;
  }>;
  isMyTurn: boolean;
  deckRemaining: number;
  myTokens: number;
  myEliminated: boolean;
  myProtected: boolean;
};

type Listener = { onCardClick: (card: number, idx: number) => void };

const CARD_W = 110;
const CARD_H = 165;
const BACK_KEY = "card-back";

export class LoveLetterScene extends Phaser.Scene {
  private sceneState: SceneState = {
    myHand: [],
    opponents: [],
    isMyTurn: false,
    deckRemaining: 0,
    myTokens: 0,
    myEliminated: false,
    myProtected: false,
  };
  private listener: Listener = { onCardClick: () => {} };
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super("love-letter");
  }

  setListener(l: Listener) {
    this.listener = l;
  }

  preload() {
    const keys = Object.values(CARD_KEY);
    for (const k of keys) this.load.image(`card-${k}`, `/cards/${k}.png`);
    this.load.image(BACK_KEY, `/cards/back.png`);
  }

  create() {
    this.layer = this.add.container(0, 0);
    this.renderAll();
  }

  updateState(s: SceneState) {
    this.sceneState = s;
    if (this.layer) this.renderAll();
  }

  private texFor(card: number) {
    const key = CARD_KEY[card];
    if (key && this.textures.exists(`card-${key}`)) return `card-${key}`;
    return BACK_KEY;
  }

  private makeCard(card: number, faceDown: boolean) {
    const c = this.add.container(0, 0);
    const key = faceDown ? BACK_KEY : this.texFor(card);

    if (this.textures.exists(key)) {
      const img = this.add.image(0, 0, key);
      img.setDisplaySize(CARD_W, CARD_H);
      c.add(img);
    } else {
      const g = this.add.graphics();
      g.fillStyle(faceDown ? 0x2a1a55 : 0x3b2a72, 1);
      g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
      g.lineStyle(2, 0xd9b66c, 1);
      g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
      c.add(g);
      if (!faceDown) {
        const t = this.add
          .text(0, 0, CARD_NAMES_KR[card] || "?", {
            fontFamily: "serif",
            fontSize: "20px",
            color: "#f1d999",
          })
          .setOrigin(0.5);
        c.add(t);
      }
    }

    const frame = this.add.graphics();
    frame.lineStyle(2, 0xd9b66c, 0.7);
    frame.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    c.add(frame);
    return c;
  }

  private renderAll() {
    this.layer.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    const s = this.sceneState;

    const bg = this.add.graphics();
    bg.fillStyle(0x140d2e, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x1f1547, 0.6);
    bg.fillCircle(W / 2, H / 2, Math.min(W, H) * 0.45);
    this.layer.add(bg);

    const deckX = W / 2;
    const deckY = H / 2;
    const deck = this.makeCard(0, true);
    deck.setPosition(deckX, deckY);
    this.layer.add(deck);

    const deckText = this.add
      .text(deckX, deckY + CARD_H / 2 + 14, `덱: ${s.deckRemaining}장`, {
        fontFamily: "serif",
        fontSize: "16px",
        color: "#a496c4",
      })
      .setOrigin(0.5);
    this.layer.add(deckText);

    const n = s.opponents.length;
    for (let i = 0; i < n; i++) {
      const op = s.opponents[i];
      const cx = ((i + 1) * W) / (n + 1);
      const cy = 90;
      const nameTxt = this.add
        .text(
          cx,
          cy - 80,
          `${op.eliminated ? "💀 " : ""}${op.nickname}${op.protected ? " 🛡" : ""}${op.isTurn ? " ▶" : ""}  ❤${op.tokens}`,
          {
            fontFamily: "serif",
            fontSize: "18px",
            color: op.isTurn ? "#f1d999" : "#efe6c6",
          },
        )
        .setOrigin(0.5);
      this.layer.add(nameTxt);

      const oppHand = this.makeCard(0, true);
      oppHand.setPosition(cx, cy);
      oppHand.setScale(0.7);
      if (op.eliminated) oppHand.setAlpha(0.3);
      this.layer.add(oppHand);

      op.discard.forEach((cardNum, idx) => {
        const dx = cx + 70 + idx * 14;
        const dy = cy + 8;
        const dc = this.makeCard(cardNum, false);
        dc.setPosition(dx, dy);
        dc.setScale(0.35);
        this.layer.add(dc);
      });
    }

    const handY = H - 110;
    const handCount = s.myHand.length;
    const spacing = CARD_W + 20;
    const totalW = (handCount - 1) * spacing;
    const startX = W / 2 - totalW / 2;
    s.myHand.forEach((card, idx) => {
      const cx = startX + idx * spacing;
      const c = this.makeCard(card, false);
      c.setPosition(cx, handY);
      const interactive = s.isMyTurn && !s.myEliminated;
      const hit = new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
      c.setSize(CARD_W, CARD_H);
      c.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
      if (interactive) {
        c.on("pointerover", () => c.setScale(1.06));
        c.on("pointerout", () => c.setScale(1));
        c.on("pointerdown", () => this.listener.onCardClick(card, idx));
      } else {
        c.setAlpha(s.myEliminated ? 0.4 : 0.85);
      }
      this.layer.add(c);
    });

    const status = s.myEliminated
      ? "💀 탈락"
      : s.isMyTurn
        ? "내 차례 — 카드 선택"
        : "상대 차례 대기 중";
    const bn = this.add
      .text(W / 2, H - 18, `${status}   ❤ ${s.myTokens}`, {
        fontFamily: "serif",
        fontSize: "16px",
        color: s.isMyTurn ? "#f1d999" : "#a496c4",
      })
      .setOrigin(0.5);
    this.layer.add(bn);
  }
}
