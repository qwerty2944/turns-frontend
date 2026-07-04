import Phaser from "phaser";

export type Rect = { x: number; y: number; width: number; height: number };

export type EffectPayload =
  | {
      kind: "lineClear";
      board: Rect;
      rows: number[];
      count: number;
    }
  | {
      kind: "attackComet";
      from: Rect;
      to: Rect;
      lines: number;
    }
  | { kind: "topOut"; board: Rect }
  | { kind: "roundWin"; board: Rect };

type Listener = { onReady: () => void };

const FLASH_COLORS: Record<number, number> = {
  1: 0xffffff,
  2: 0xfacc15,
  3: 0xfb923c,
  4: 0xa855f7, // tetris flash leads with purple, rainbow trail follows
};

const CLEAR_LABEL: Record<number, { text: string; color: string }> = {
  2: { text: "DOUBLE!", color: "#facc15" },
  3: { text: "TRIPLE!", color: "#fb923c" },
  4: { text: "TETRIS!", color: "#e879f9" },
};

const SHAKE_INTENSITY: Record<number, { duration: number; force: number }> = {
  1: { duration: 90, force: 0.002 },
  2: { duration: 160, force: 0.005 },
  3: { duration: 240, force: 0.009 },
  4: { duration: 380, force: 0.016 },
};

export class TetrisEffectsScene extends Phaser.Scene {
  private listener: Listener = { onReady: () => {} };
  private booted = false;
  private fx!: Phaser.GameObjects.Container;

  constructor() {
    super("tetris-effects");
  }

  setOnReady(cb: () => void) {
    this.listener = { onReady: cb };
    if (this.booted) cb();
  }

  preload() {
    // Use generated textures only — no external assets needed.
  }

  create() {
    this.fx = this.add.container(0, 0);
    // 1x1 white texture for tinted rects/comet bodies.
    if (!this.textures.exists("px")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture("px", 1, 1);
      g.destroy();
    }
    this.booted = true;
    this.listener.onReady();
  }

  playEffect(p: EffectPayload) {
    if (!this.booted) return;
    switch (p.kind) {
      case "lineClear":
        return this.fxLineClear(p);
      case "attackComet":
        return this.fxComet(p);
      case "topOut":
        return this.fxTopOut(p.board);
      case "roundWin":
        return this.fxRoundWin(p.board);
    }
  }

  // ───────── effects ───────── //

  private fxLineClear(p: Extract<EffectPayload, { kind: "lineClear" }>) {
    const rowH = Math.max(1, p.board.height / 20);
    const count = Math.min(4, Math.max(1, p.count));
    const flashColor = FLASH_COLORS[count] ?? 0xffffff;

    for (const r of p.rows) {
      const cy = p.board.y + r * rowH + rowH / 2;

      // Row flash that collapses vertically.
      const rect = this.add.rectangle(
        p.board.x + p.board.width / 2,
        cy,
        p.board.width,
        rowH,
        flashColor,
        0.95,
      );
      rect.setBlendMode(Phaser.BlendModes.ADD);
      this.fx.add(rect);
      this.tweens.add({
        targets: rect,
        alpha: 0,
        scaleY: 0.08,
        duration: 320,
        ease: "Cubic.easeOut",
        onComplete: () => rect.destroy(),
      });

      // Horizontal shockwave sweeping outward from the row center.
      const sweep = this.add.rectangle(
        p.board.x + p.board.width / 2,
        cy,
        6,
        rowH * 0.8,
        0xffffff,
        0.9,
      );
      sweep.setBlendMode(Phaser.BlendModes.ADD);
      this.fx.add(sweep);
      this.tweens.add({
        targets: sweep,
        scaleX: p.board.width / 5,
        alpha: 0,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => sweep.destroy(),
      });

      // Chunky debris flying up + gravity feel via speedY spread.
      const burst = this.add.particles(0, 0, "px", {
        x: { min: p.board.x, max: p.board.x + p.board.width },
        y: cy,
        speedY: { min: -160, max: -320 },
        speedX: { min: -120, max: 120 },
        scale: { start: 2.6, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: [flashColor, 0xffffff],
        lifespan: 520,
        quantity: 8,
        gravityY: 500,
        emitting: false,
      });
      burst.explode(Math.min(40, 10 + count * 8));
      this.time.delayedCall(800, () => burst.destroy());
    }

    // Combo callout text for double+.
    const label = CLEAR_LABEL[count];
    if (label) {
      const txt = this.add
        .text(p.board.x + p.board.width / 2, p.board.y + p.board.height * 0.4, label.text, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: count >= 4 ? "26px" : "18px",
          color: label.color,
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(2.2)
        .setAngle(-4);
      this.fx.add(txt);
      this.tweens.add({
        targets: txt,
        alpha: 1,
        scale: 1,
        angle: 0,
        duration: 180,
        ease: "Back.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: txt,
            y: txt.y - 36,
            alpha: 0,
            delay: 420,
            duration: 380,
            onComplete: () => txt.destroy(),
          });
        },
      });
    }

    // Tetris (4) — rainbow halo rings.
    if (count >= 4) {
      const cx = p.board.x + p.board.width / 2;
      const cyb = p.board.y + p.board.height / 2;
      const colors = [0xff66ff, 0x66e0ff, 0xffe066];
      colors.forEach((c, i) => {
        const halo = this.add.rectangle(
          cx,
          cyb,
          p.board.width + 12 + i * 10,
          p.board.height + 12 + i * 10,
          0xffffff,
          0,
        );
        halo.setStrokeStyle(4 - i, c, 1);
        halo.setBlendMode(Phaser.BlendModes.ADD);
        this.fx.add(halo);
        this.tweens.add({
          targets: halo,
          scale: 1.06 + i * 0.03,
          alpha: { from: 1, to: 0 },
          duration: 520 + i * 140,
          onComplete: () => halo.destroy(),
        });
      });
    }

    const shake = SHAKE_INTENSITY[count];
    if (shake) {
      this.cameras.main.shake(shake.duration, shake.force);
    }
  }

  private fxComet(p: Extract<EffectPayload, { kind: "attackComet" }>) {
    const fromX = p.from.x + p.from.width / 2;
    const fromY = p.from.y + p.from.height / 2;
    const toX = p.to.x + p.to.width / 2;
    const toY = p.to.y + p.to.height / 2;
    const power = Math.min(4, Math.max(1, p.lines));

    const comet = this.add.image(fromX, fromY, "px");
    comet.setScale(5 + power * 1.5);
    comet.setTint(0xff5566);
    comet.setBlendMode(Phaser.BlendModes.ADD);
    this.fx.add(comet);

    const trail = this.add.particles(0, 0, "px", {
      follow: comet,
      tint: [0xffaa00, 0xff5566, 0xffffff],
      scale: { start: 2.5 + power * 0.7, end: 0 },
      speed: 40,
      lifespan: 320,
      quantity: 3,
      blendMode: Phaser.BlendModes.ADD,
    });

    // Arc the comet: fly through a control point lifted above the midpoint.
    const midX = (fromX + toX) / 2;
    const midY = Math.min(fromY, toY) - 60 - power * 14;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(fromX, fromY),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(toX, toY),
    );
    const follower = { t: 0 };
    this.tweens.add({
      targets: follower,
      t: 1,
      duration: 480 + power * 40,
      ease: "Quad.easeIn",
      onUpdate: () => {
        const v = curve.getPoint(follower.t);
        comet.setPosition(v.x, v.y);
      },
      onComplete: () => {
        // Impact: flash the whole target board + burst + shake.
        const flash = this.add.rectangle(
          p.to.x + p.to.width / 2,
          p.to.y + p.to.height / 2,
          p.to.width,
          p.to.height,
          0xff5566,
          0.35 + power * 0.08,
        );
        flash.setBlendMode(Phaser.BlendModes.ADD);
        this.fx.add(flash);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 300,
          onComplete: () => flash.destroy(),
        });
        const burst = this.add.particles(0, 0, "px", {
          x: toX,
          y: toY,
          tint: [0xff5566, 0xffaa00, 0xffffff],
          scale: { start: 3 + power, end: 0 },
          speed: { min: 80, max: 240 + power * 40 },
          lifespan: 420,
          quantity: 16,
          emitting: false,
          blendMode: Phaser.BlendModes.ADD,
        });
        burst.explode(16 + power * 8);
        this.time.delayedCall(600, () => burst.destroy());
        this.cameras.main.shake(120 + power * 40, 0.003 + power * 0.002);
        comet.destroy();
        trail.stop();
        this.time.delayedCall(400, () => trail.destroy());
      },
    });
  }

  private fxTopOut(board: Rect) {
    // Red flash…
    const overlay = this.add.rectangle(
      board.x + board.width / 2,
      board.y + board.height / 2,
      board.width,
      board.height,
      0xef4444,
      0.55,
    );
    this.fx.add(overlay);
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 1100,
      onComplete: () => overlay.destroy(),
    });

    // …then the stack shatters: gray blocks rain out of the board.
    const cellW = board.width / 10;
    for (let i = 0; i < 26; i++) {
      const bx = board.x + Math.random() * board.width;
      const by = board.y + board.height * (0.35 + Math.random() * 0.6);
      const block = this.add.rectangle(
        bx,
        by,
        cellW * 0.8,
        cellW * 0.8,
        i % 3 === 0 ? 0x9ca3af : 0x6b7280,
        1,
      );
      this.fx.add(block);
      this.tweens.add({
        targets: block,
        x: bx + (Math.random() - 0.5) * 140,
        y: board.y + board.height + 60 + Math.random() * 80,
        angle: (Math.random() - 0.5) * 540,
        alpha: 0,
        duration: 700 + Math.random() * 500,
        ease: "Quad.easeIn",
        onComplete: () => block.destroy(),
      });
    }

    // "K.O." stamp.
    const txt = this.add
      .text(board.x + board.width / 2, board.y + board.height * 0.42, "K.O.", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "30px",
        color: "#ef4444",
        stroke: "#000000",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(2.6)
      .setAlpha(0);
    this.fx.add(txt);
    this.tweens.add({
      targets: txt,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: txt,
          alpha: 0,
          delay: 900,
          duration: 400,
          onComplete: () => txt.destroy(),
        });
      },
    });

    this.cameras.main.shake(320, 0.014);
  }

  private fxRoundWin(board: Rect) {
    const cx = board.x + board.width / 2;
    const cy = board.y + board.height / 2;
    const halo = this.add.rectangle(cx, cy, board.width + 24, board.height + 24, 0xffd700, 0);
    halo.setStrokeStyle(6, 0xffd700, 1);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    this.fx.add(halo);
    this.tweens.add({
      targets: halo,
      scale: 1.1,
      alpha: { from: 1, to: 0 },
      duration: 900,
      onComplete: () => halo.destroy(),
    });

    // Firework bursts around the board.
    const spots: [number, number][] = [
      [cx, cy - board.height * 0.25],
      [cx - board.width * 0.35, cy + board.height * 0.1],
      [cx + board.width * 0.35, cy - board.height * 0.05],
      [cx, cy + board.height * 0.3],
    ];
    spots.forEach(([sx, sy], i) => {
      this.time.delayedCall(i * 180, () => {
        const burst = this.add.particles(0, 0, "px", {
          x: sx,
          y: sy,
          tint: [0xffd700, 0xfacc15, 0xffffff, 0xa855f7, 0x22d3ee],
          scale: { start: 4, end: 0 },
          speed: { min: 80, max: 260 },
          lifespan: 800,
          quantity: 30,
          emitting: false,
          blendMode: Phaser.BlendModes.ADD,
        });
        burst.explode(40);
        this.time.delayedCall(1100, () => burst.destroy());
      });
    });

    // Gold rain across the whole canvas.
    const rain = this.add.particles(0, 0, "px", {
      x: { min: 0, max: this.scale.width },
      y: -10,
      speedY: { min: 120, max: 280 },
      speedX: { min: -30, max: 30 },
      scale: { start: 2.4, end: 0.6 },
      rotate: { min: 0, max: 360 },
      tint: [0xffd700, 0xfacc15, 0xffffff],
      lifespan: 2000,
      quantity: 4,
    });
    this.time.delayedCall(1600, () => {
      rain.stop();
      this.time.delayedCall(2100, () => rain.destroy());
    });
  }
}
