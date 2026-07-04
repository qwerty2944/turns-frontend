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
  /** Current room difficulty (1..6). Used to gate which tasks render. */
  difficulty?: number;
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

// Original fixed 3-region layout. All tasks active from match start.
type Region = { top: number; height: number };
type Layout = { hold: Region; tap: Region; dodge: Region };

const FIXED_LAYOUT: Layout = {
  hold: { top: 30, height: 60 },
  tap: { top: 110, height: 150 },
  dodge: { top: 280, height: 130 },
};

function computeLayout(_diff: number): Layout {
  return FIXED_LAYOUT;
}

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
    const layout = computeLayout(v.difficulty ?? 1);
    this.drawHoldBar(v, layout.hold);
    this.drawTapGrid(v, nowMs, layout.tap);
    this.drawDodgeLane(v, layout.dodge);

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

  private drawHoldBar(v: PlayerView, region: Region) {
    const x = 10;
    const y = region.top;
    const w = BOARD_W - 20;
    const h = region.height;
    const inZone = v.holdPos >= v.holdZoneStart && v.holdPos <= v.holdZoneEnd;

    // Track with inner shading + zone-glow border when the indicator is in.
    this.g.fillStyle(this.theme.panel, 1).fillRect(x, y, w, h);
    this.g.fillStyle(0x000000, 0.25).fillRect(x, y + h * 0.55, w, h * 0.45);
    this.g
      .lineStyle(inZone ? 2 : 1, inZone ? this.theme.gold : this.theme.muted, inZone ? 0.9 : 0.6)
      .strokeRect(x, y, w, h);

    // Target zone — gold band with a soft pulse while the indicator is inside.
    const zs = x + w * Math.max(0, Math.min(1, v.holdZoneStart));
    const ze = x + w * Math.max(0, Math.min(1, v.holdZoneEnd));
    const zw = Math.max(2, ze - zs);
    const pulse = inZone ? 0.5 + 0.2 * Math.sin(Date.now() / 120) : 0.4;
    this.g.fillStyle(this.theme.gold, pulse).fillRect(zs, y + 8, zw, h - 16);
    this.g.lineStyle(2, this.theme.gold, 1).strokeRect(zs, y + 8, zw, h - 16);

    // Indicator — taller with a diamond head; sparks while scoring.
    const ix = x + w * Math.max(0, Math.min(1, v.holdPos));
    const col = inZone ? this.theme.gold : this.theme.accent;
    this.g.fillStyle(col, 1).fillRect(ix - 2, y - 5, 4, h + 10);
    this.g.fillStyle(col, 1).fillTriangle(ix, y - 11, ix - 5, y - 4, ix + 5, y - 4);
    if (inZone) {
      // tiny rising sparks off the indicator head
      const t = Date.now();
      for (let i = 0; i < 3; i++) {
        const sy = y - 12 - ((t / 60 + i * 12) % 22);
        const sx = ix + Math.sin((t + i * 400) / 130) * 5;
        this.g.fillStyle(0xffffff, 0.7 - i * 0.2).fillRect(sx, sy, 2, 2);
      }
    }
  }

  private drawTapGrid(v: PlayerView, nowMs: number, region: Region) {
    const x0 = 10;
    const y0 = region.top;
    const w = BOARD_W - 20;
    const h = region.height;
    const cellSize = Math.floor(Math.min(w, h) / 3);
    const gridLeft = x0 + (w - cellSize * 3) / 2;
    const gridTop = y0 + (h - cellSize * 3) / 2;

    // Frame
    this.g
      .fillStyle(this.theme.panel, 0.6)
      .fillRect(x0, y0, w, h);

    // Cells
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = gridLeft + c * cellSize;
        const cy = gridTop + r * cellSize;
        this.g
          .lineStyle(1, this.theme.muted, 0.4)
          .strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);
      }
    }

    // Active targets — bullseye with a shrinking timer ring and urgency pulse.
    for (const t of v.tapTargets) {
      const c = t.cell % 3;
      const r = Math.floor(t.cell / 3);
      const cx = gridLeft + c * cellSize + cellSize / 2;
      const cy = gridTop + r * cellSize + cellSize / 2;
      const total = Math.max(1, t.expiresAt - t.spawnedAt);
      const remaining = Math.max(0, t.expiresAt - nowMs);
      const ratio = remaining / total;
      const maxR = cellSize / 2 - 4;
      const radius = maxR * (0.35 + 0.65 * ratio);
      const urgent = ratio < 0.33;
      const wobble = urgent ? 1 + 0.08 * Math.sin(nowMs / 55) : 1;
      const color =
        ratio < 0.33 ? this.theme.danger : ratio < 0.66 ? this.theme.gold : this.theme.accent;

      // outer timer ring (full lifetime footprint)
      this.g.lineStyle(2, color, 0.35).strokeCircle(cx, cy, maxR);
      // body + bullseye
      this.g.fillStyle(color, 0.92).fillCircle(cx, cy, radius * wobble);
      this.g.fillStyle(0xffffff, 0.85).fillCircle(cx, cy, Math.max(2, radius * 0.3));
      this.g.lineStyle(1.5, 0xffffff, 0.7).strokeCircle(cx, cy, radius * wobble);
    }
  }

  private drawDodgeLane(v: PlayerView, region: Region) {
    const x0 = 10;
    const y0 = region.top;
    const w = BOARD_W - 20;
    const h = region.height;
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
    const charCyRatio = 0.85;
    for (const b of v.dodgeBlocks) {
      const interp = b.speed > 0
        ? Math.max(0, Math.min(1.1, (now - b.spawnedAt) * b.speed))
        : b.y;
      const yRatio = Math.max(b.y, interp);
      const cx = x0 + b.col * colW + colW / 2;
      const cy = y0 + h * Math.max(0, Math.min(1, yRatio));
      const bw = colW - 14;
      const bh = 16;
      // motion trail
      this.g.fillStyle(this.theme.danger, 0.22).fillRect(cx - bw / 2 + 3, cy - bh / 2 - 12, bw - 6, 9);
      this.g.fillStyle(this.theme.danger, 0.1).fillRect(cx - bw / 2 + 6, cy - bh / 2 - 22, bw - 12, 8);
      // body with bevel
      this.g.fillStyle(this.theme.danger, 0.95).fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
      this.g.fillStyle(0xffffff, 0.28).fillRect(cx - bw / 2, cy - bh / 2, bw, 3);
      this.g.fillStyle(0x000000, 0.3).fillRect(cx - bw / 2, cy + bh / 2 - 3, bw, 3);
      this.g.lineStyle(1, 0xffffff, 0.5).strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
      // proximity warning: block bearing down on the player's column
      if (b.col === v.dodgeCol && yRatio > charCyRatio - 0.28 && yRatio < charCyRatio) {
        const blink = 0.35 + 0.35 * Math.sin(now / 60);
        this.g.lineStyle(2, 0xffffff, blink).strokeRect(cx - bw / 2 - 3, cy - bh / 2 - 3, bw + 6, bh + 6);
      }
    }

    // Character (player) — bobbing little guy with face + shadow.
    const charCx = x0 + v.dodgeCol * colW + colW / 2;
    const bob = Math.sin(now / 180) * 1.5;
    const charCy = y0 + h * charCyRatio + bob;
    const cw = colW - 22;
    const ch = 18;
    // shadow
    this.g.fillStyle(0x000000, 0.35).fillEllipse(charCx, y0 + h * charCyRatio + ch / 2 + 3, cw * 0.8, 5);
    // body with bevel
    this.g.fillStyle(this.theme.accent, 1).fillRect(charCx - cw / 2, charCy - ch / 2, cw, ch);
    this.g.fillStyle(0xffffff, 0.3).fillRect(charCx - cw / 2, charCy - ch / 2, cw, 3);
    this.g.fillStyle(0x000000, 0.25).fillRect(charCx - cw / 2, charCy + ch / 2 - 3, cw, 3);
    this.g.lineStyle(1.5, 0xffffff, 0.8).strokeRect(charCx - cw / 2, charCy - ch / 2, cw, ch);
    // face: eyes + tiny mouth
    this.g.fillStyle(0xffffff, 1).fillRect(charCx - 4, charCy - 4, 2.5, 2.5);
    this.g.fillStyle(0xffffff, 1).fillRect(charCx + 2, charCy - 4, 2.5, 2.5);
    this.g.fillStyle(0xffffff, 0.85).fillRect(charCx - 2, charCy + 2, 4, 1.5);
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

        const layout = computeLayout(v.difficulty ?? 1);
        const inRegion = (r: Region | null) =>
          !!r && y >= r.top && y <= r.top + r.height && x >= 10 && x <= BOARD_W - 10;
        const inHold = inRegion(layout.hold);
        const inTap = inRegion(layout.tap);
        const inDodge = inRegion(layout.dodge);

        if (inHold) {
          this.callbacks.onHoldTap();
          return;
        }

        if (inTap && layout.tap && dist < 12) {
          // Cell hit-testing must mirror the grid math.
          const w = BOARD_W - 20;
          const h = layout.tap.height;
          const cellSize = Math.floor(Math.min(w, h) / 3);
          const gridLeft = 10 + (w - cellSize * 3) / 2;
          const gridTop = layout.tap.top + (h - cellSize * 3) / 2;
          const c = Math.floor((x - gridLeft) / cellSize);
          const r = Math.floor((y - gridTop) / cellSize);
          if (c >= 0 && c < 3 && r >= 0 && r < 3) {
            this.callbacks.onTapCell(r * 3 + c);
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
          // 1..9 maps directly to 3×3 grid cells (row-major).
          this.callbacks.onTapCell(n - 1);
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
