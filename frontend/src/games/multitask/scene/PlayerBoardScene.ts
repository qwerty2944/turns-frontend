import Phaser from "phaser";

export type TapTargetView = {
  id: number;
  cell: number;
  spawnedAt: number;
  expiresAt: number;
};

export type DodgeBlockView = {
  id: number;
  col: number;
  y: number;
  speed: number;
  spawnedAt: number;
};

export type PlayerView = {
  sessionId: string;
  nickname: string;
  alive: boolean;
  hearts: number;
  score: number;
  holdPos: number;
  holdZoneStart: number;
  holdZoneEnd: number;
  holdCycleId: number;
  tapTargets: TapTargetView[];
  dodgeCol: number;
  dodgeBlocks: DodgeBlockView[];
  lastDamageAt: number;
  /** Estimated server time (ms) — used to interpolate falling blocks between server ticks. */
  serverNowEst?: number;
};

export type InputCallbacks = {
  onHoldTap: () => void;
  onTapCell: (cell: number) => void;
  onMoveCol: (col: number) => void;
};

type Theme = {
  bg: number;
  panel: number;
  text: string;
  accent: number;
  danger: number;
  gold: number;
  muted: number;
};

const DEFAULT_THEME: Theme = {
  bg: 0x140d2e,
  panel: 0x21194a,
  text: "#e9e3f5",
  accent: 0x7a3fff,
  danger: 0xff5f70,
  gold: 0xd9b66c,
  muted: 0x6e6794,
};

// Base board dimensions — Phaser canvas scales to fit the wrapper.
export const BOARD_W = 220;
export const BOARD_H = 420;

// Layout regions (y ranges).
const HOLD_TOP = 30;
const HOLD_HEIGHT = 60;
const TAP_TOP = 110;
const TAP_HEIGHT = 150;
const DODGE_TOP = 280;
const DODGE_HEIGHT = 130;

export class PlayerBoardScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private isLocal: boolean = false;
  private callbacks: InputCallbacks | null = null;
  private view: PlayerView | null = null;

  // ── Display objects ──────────────────────────────────────────────
  private g!: Phaser.GameObjects.Graphics;
  private nicknameText!: Phaser.GameObjects.Text;
  private heartsText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private outOverlay!: Phaser.GameObjects.Graphics;
  private outText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private damageFlash!: Phaser.GameObjects.Rectangle;

  // pointer/swipe tracking for dodge lane
  private pointerStart: { x: number; y: number; t: number } | null = null;
  private lastShownDamageAt = 0;

  constructor() {
    super("PlayerBoard");
  }

  init(data: {
    theme?: Partial<Theme>;
    isLocal?: boolean;
    callbacks?: InputCallbacks;
  }) {
    if (data?.theme) this.theme = { ...DEFAULT_THEME, ...data.theme };
    this.isLocal = !!data?.isLocal;
    this.callbacks = data?.callbacks ?? null;
  }

  create() {
    this.cameras.main.setBackgroundColor(this.theme.bg);
    this.g = this.add.graphics();

    this.nicknameText = this.add
      .text(8, 6, "", {
        fontFamily: "'Galmuri11', 'Press Start 2P', monospace",
        fontSize: "12px",
        color: this.theme.text,
      })
      .setOrigin(0, 0);

    this.heartsText = this.add
      .text(BOARD_W - 8, 6, "", {
        fontFamily: "'Galmuri11', 'Press Start 2P', monospace",
        fontSize: "12px",
        color: "#ff8896",
      })
      .setOrigin(1, 0);

    this.scoreText = this.add
      .text(BOARD_W / 2, 6, "", {
        fontFamily: "'Galmuri11', 'Press Start 2P', monospace",
        fontSize: "11px",
        color: "#d9b66c",
      })
      .setOrigin(0.5, 0);

    this.hintText = this.add
      .text(BOARD_W / 2, BOARD_H - 6, "", {
        fontFamily: "'Galmuri11', monospace",
        fontSize: "9px",
        color: "#9a92c5",
      })
      .setOrigin(0.5, 1);

    this.damageFlash = this.add
      .rectangle(BOARD_W / 2, BOARD_H / 2, BOARD_W, BOARD_H, this.theme.danger, 0)
      .setOrigin(0.5, 0.5);

    this.outOverlay = this.add
      .graphics()
      .fillStyle(0x000000, 0.55)
      .fillRect(0, 0, BOARD_W, BOARD_H)
      .setVisible(false);
    this.outText = this.add
      .text(BOARD_W / 2, BOARD_H / 2, "OUT", {
        fontFamily: "'Galmuri11', 'Press Start 2P', monospace",
        fontSize: "28px",
        color: "#ff5f70",
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    if (this.isLocal) this.wireInput();
  }

  setPlayerView(v: PlayerView) {
    this.view = v;
  }

  setTheme(theme: Partial<Theme>) {
    this.theme = { ...DEFAULT_THEME, ...theme };
    this.cameras.main.setBackgroundColor(this.theme.bg);
  }

  update(_t: number, _dt: number) {
    const v = this.view;
    if (!v) return;
    const nowMs = Date.now();

    // Header texts
    this.nicknameText.setText(v.nickname || "");
    this.heartsText.setText("❤".repeat(Math.max(0, v.hearts)));
    this.scoreText.setText(`${v.score}점`);
    this.hintText.setText(
      this.isLocal
        ? "스페이스=홀드 · 탭=타깃 · ←→/스와이프=회피"
        : "관전 중",
    );

    // Damage flash (~250ms)
    if (v.lastDamageAt > this.lastShownDamageAt) {
      this.lastShownDamageAt = v.lastDamageAt;
      this.damageFlash.fillAlpha = 0.55;
      this.tweens.add({
        targets: this.damageFlash,
        fillAlpha: 0,
        duration: 280,
        ease: "Cubic.easeOut",
      });
    }

    this.g.clear();
    this.drawHoldBar(v);
    this.drawTapGrid(v, nowMs);
    this.drawDodgeLane(v);

    // OUT overlay
    if (!v.alive) {
      this.outOverlay.setVisible(true);
      this.outText.setVisible(true);
    } else {
      this.outOverlay.setVisible(false);
      this.outText.setVisible(false);
    }
  }

  // ── Drawing ──────────────────────────────────────────────────────

  private drawHoldBar(v: PlayerView) {
    const x = 10;
    const y = HOLD_TOP;
    const w = BOARD_W - 20;
    const h = HOLD_HEIGHT;

    // Track
    this.g.fillStyle(this.theme.panel, 1).fillRect(x, y, w, h);
    this.g.lineStyle(1, this.theme.muted, 0.6).strokeRect(x, y, w, h);

    // Target zone
    const zs = x + w * Math.max(0, Math.min(1, v.holdZoneStart));
    const ze = x + w * Math.max(0, Math.min(1, v.holdZoneEnd));
    const zw = Math.max(2, ze - zs);
    this.g.fillStyle(this.theme.gold, 0.45).fillRect(zs, y + 8, zw, h - 16);
    this.g.lineStyle(2, this.theme.gold, 1).strokeRect(zs, y + 8, zw, h - 16);

    // Indicator
    const ix = x + w * Math.max(0, Math.min(1, v.holdPos));
    const inZone = v.holdPos >= v.holdZoneStart && v.holdPos <= v.holdZoneEnd;
    this.g
      .fillStyle(inZone ? this.theme.gold : this.theme.accent, 1)
      .fillRect(ix - 2, y - 4, 4, h + 8);
  }

  private drawTapGrid(v: PlayerView, nowMs: number) {
    const x0 = 10;
    const y0 = TAP_TOP;
    const w = BOARD_W - 20;
    const h = TAP_HEIGHT;
    const cellSize = Math.floor(Math.min(w, h) / 4);
    const gridLeft = x0 + (w - cellSize * 4) / 2;
    const gridTop = y0 + (h - cellSize * 4) / 2;

    // Frame
    this.g
      .fillStyle(this.theme.panel, 0.6)
      .fillRect(x0, y0, w, h);

    // Cells
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cx = gridLeft + c * cellSize;
        const cy = gridTop + r * cellSize;
        this.g
          .lineStyle(1, this.theme.muted, 0.4)
          .strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);
      }
    }

    // Active targets
    for (const t of v.tapTargets) {
      const c = t.cell % 4;
      const r = Math.floor(t.cell / 4);
      const cx = gridLeft + c * cellSize + cellSize / 2;
      const cy = gridTop + r * cellSize + cellSize / 2;
      const total = Math.max(1, t.expiresAt - t.spawnedAt);
      const remaining = Math.max(0, t.expiresAt - nowMs);
      const ratio = remaining / total;
      const radius = (cellSize / 2 - 4) * (0.35 + 0.65 * ratio);
      const color =
        ratio < 0.33 ? this.theme.danger : ratio < 0.66 ? this.theme.gold : this.theme.accent;
      this.g.fillStyle(color, 0.9).fillCircle(cx, cy, radius);
      this.g.lineStyle(1, 0xffffff, 0.6).strokeCircle(cx, cy, radius);
    }
  }

  private drawDodgeLane(v: PlayerView) {
    const x0 = 10;
    const y0 = DODGE_TOP;
    const w = BOARD_W - 20;
    const h = DODGE_HEIGHT;
    const colW = w / 3;

    // Lane background
    this.g.fillStyle(this.theme.panel, 0.6).fillRect(x0, y0, w, h);
    // Column dividers
    for (let i = 1; i < 3; i++) {
      this.g
        .lineStyle(1, this.theme.muted, 0.3)
        .lineBetween(x0 + colW * i, y0 + 4, x0 + colW * i, y0 + h - 4);
    }

    // Falling blocks — interpolate locally using spawnedAt+speed when we have
    // a clock estimate, so motion stays smooth between 20Hz server ticks.
    const now = v.serverNowEst ?? Date.now();
    for (const b of v.dodgeBlocks) {
      const interp = b.speed > 0
        ? Math.max(0, Math.min(1.1, (now - b.spawnedAt) * b.speed))
        : b.y;
      const yRatio = Math.max(b.y, interp);
      const cx = x0 + b.col * colW + colW / 2;
      const cy = y0 + h * Math.max(0, Math.min(1, yRatio));
      const bw = colW - 14;
      const bh = 16;
      this.g.fillStyle(this.theme.danger, 0.95).fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
      this.g
        .lineStyle(1, 0xffffff, 0.5)
        .strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    }

    // Character (player)
    const charCx = x0 + v.dodgeCol * colW + colW / 2;
    const charCy = y0 + h * 0.85;
    const cw = colW - 22;
    const ch = 18;
    this.g.fillStyle(this.theme.accent, 1).fillRect(charCx - cw / 2, charCy - ch / 2, cw, ch);
    this.g
      .lineStyle(1.5, 0xffffff, 0.8)
      .strokeRect(charCx - cw / 2, charCy - ch / 2, cw, ch);
    // Eye
    this.g.fillStyle(0xffffff, 1).fillRect(charCx - 3, charCy - 3, 2, 2);
    this.g.fillStyle(0xffffff, 1).fillRect(charCx + 1, charCy - 3, 2, 2);
  }

  // ── Input ────────────────────────────────────────────────────────

  private wireInput() {
    if (!this.callbacks) return;

    // Make scene events camera-relative coords (default)
    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        this.pointerStart = { x: pointer.x, y: pointer.y, t: pointer.time };
      },
    );

    this.input.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer) => {
        const start = this.pointerStart;
        this.pointerStart = null;
        if (!start || !this.callbacks) return;
        const v = this.view;
        if (!v || !v.alive) return;

        const dx = pointer.x - start.x;
        const dy = pointer.y - start.y;
        const dist = Math.hypot(dx, dy);
        const x = pointer.x;
        const y = pointer.y;

        const inHold =
          y >= HOLD_TOP && y <= HOLD_TOP + HOLD_HEIGHT && x >= 10 && x <= BOARD_W - 10;
        const inTap =
          y >= TAP_TOP && y <= TAP_TOP + TAP_HEIGHT && x >= 10 && x <= BOARD_W - 10;
        const inDodge =
          y >= DODGE_TOP && y <= DODGE_TOP + DODGE_HEIGHT && x >= 10 && x <= BOARD_W - 10;

        if (inHold) {
          this.callbacks.onHoldTap();
          return;
        }

        if (inTap && dist < 12) {
          // Cell hit-testing must mirror the grid math.
          const w = BOARD_W - 20;
          const h = TAP_HEIGHT;
          const cellSize = Math.floor(Math.min(w, h) / 4);
          const gridLeft = 10 + (w - cellSize * 4) / 2;
          const gridTop = TAP_TOP + (h - cellSize * 4) / 2;
          const c = Math.floor((x - gridLeft) / cellSize);
          const r = Math.floor((y - gridTop) / cellSize);
          if (c >= 0 && c < 4 && r >= 0 && r < 4) {
            this.callbacks.onTapCell(r * 4 + c);
            return;
          }
        }

        if (inDodge) {
          // Tap on a column moves directly; swipe left/right also moves.
          if (dist < 12) {
            const w = BOARD_W - 20;
            const colW = w / 3;
            const col = Math.max(0, Math.min(2, Math.floor((x - 10) / colW)));
            this.callbacks.onMoveCol(col);
            return;
          }
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 18) {
            const dir = dx > 0 ? 1 : -1;
            const target = Math.max(0, Math.min(2, (v.dodgeCol ?? 1) + dir));
            this.callbacks.onMoveCol(target);
            return;
          }
        }
      },
    );

    // Keyboard (PC) — global, not bound to canvas focus.
    // We add a window-level keydown so the local player can play even when
    // they haven't clicked the canvas first.
    const onKey = (e: KeyboardEvent) => {
      if (!this.callbacks) return;
      const v = this.view;
      if (!v || !v.alive) return;
      if (e.code === "Space") {
        e.preventDefault();
        this.callbacks.onHoldTap();
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        const target = Math.max(0, (v.dodgeCol ?? 1) - 1);
        this.callbacks.onMoveCol(target);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        const target = Math.min(2, (v.dodgeCol ?? 1) + 1);
        this.callbacks.onMoveCol(target);
      } else if (e.code.startsWith("Digit")) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) {
          // 1..9 maps to top-left 3x3 region for keyboard play.
          const idx = n - 1;
          const cell = Math.floor(idx / 3) * 4 + (idx % 3);
          this.callbacks.onTapCell(cell);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    this.events.once("shutdown", () => {
      window.removeEventListener("keydown", onKey);
    });
    this.events.once("destroy", () => {
      window.removeEventListener("keydown", onKey);
    });
  }
}
