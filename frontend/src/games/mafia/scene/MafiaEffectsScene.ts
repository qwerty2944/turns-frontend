import Phaser from "phaser";
import { ROLE_KEY, type Role } from "../model/roles";

export type Anchor = { x: number; y: number };

export type MafiaEffectPayload =
  | { kind: "nightFall" }
  | { kind: "dayBreak" }
  | { kind: "wolfHunt"; target: Anchor }
  | { kind: "doctorSave"; target: Anchor }
  | { kind: "seerGlow"; target: Anchor; isWolf: boolean }
  | { kind: "lynch"; target: Anchor }
  | { kind: "villagerWin" }
  | { kind: "wolfWin" }
  | { kind: "roleReveal"; role: Role; at: Anchor };

type Listener = { onReady: () => void };

export class MafiaEffectsScene extends Phaser.Scene {
  private listener: Listener = { onReady: () => {} };
  private booted = false;

  constructor() {
    super("mafia-effects");
  }

  setOnReady(cb: () => void) {
    this.listener = { onReady: cb };
    if (this.booted) cb();
  }

  preload() {
    for (const key of Object.values(ROLE_KEY)) {
      this.load.image(`role-${key}`, `/games/mafia/${key}.png`);
    }
    this.load.image("role-back", `/games/mafia/back.png`);
  }

  create() {
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.booted = true;
    this.listener.onReady();
  }

  playEffect(p: MafiaEffectPayload) {
    if (!this.booted) return;
    switch (p.kind) {
      case "nightFall":
        return this.fxNightFall();
      case "dayBreak":
        return this.fxDayBreak();
      case "wolfHunt":
        return this.fxWolfHunt(p.target);
      case "doctorSave":
        return this.fxDoctorSave(p.target);
      case "seerGlow":
        return this.fxSeerGlow(p.target, p.isWolf);
      case "lynch":
        return this.fxLynch(p.target);
      case "villagerWin":
        return this.fxVillagerWin();
      case "wolfWin":
        return this.fxWolfWin();
      case "roleReveal":
        return this.fxRoleReveal(p.role, p.at);
    }
  }

  // ─── Effects ─────────────────────────────────────────────────────

  /** Night: deep indigo wash, twinkling stars, a glowing moon that rises. */
  private fxNightFall() {
    const w = this.scale.width;
    const h = this.scale.height;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x120a2e, 0);
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.5,
      duration: 700,
      hold: 1400,
      yoyo: true,
      onComplete: () => overlay.destroy(),
    });

    // Twinkling stars scattered across the top half.
    for (let i = 0; i < 26; i++) {
      const star = this.add.circle(
        Math.random() * w,
        Math.random() * h * 0.55,
        1 + Math.random() * 1.6,
        0xfff2c8,
        0,
      );
      this.tweens.add({
        targets: star,
        alpha: 0.4 + Math.random() * 0.6,
        delay: Math.random() * 600,
        duration: 300 + Math.random() * 400,
        yoyo: true,
        repeat: 1,
        hold: 300 + Math.random() * 600,
        onComplete: () => star.destroy(),
      });
    }

    // Moon with halo, rising from below the horizon line.
    const moonX = w * 0.82;
    const halo = this.add.circle(moonX, 120, 58, 0xfff2c8, 0.12);
    const moon = this.add.circle(moonX, 120, 34, 0xfff2c8, 0.95);
    const crater1 = this.add.circle(moonX - 10, 112, 6, 0xe8dcae, 0.9);
    const crater2 = this.add.circle(moonX + 8, 128, 4, 0xe8dcae, 0.85);
    const moonGroup = [halo, moon, crater1, crater2];
    moonGroup.forEach((o) => {
      o.y += 160;
      o.setAlpha(0);
    });
    this.tweens.add({
      targets: moonGroup,
      y: "-=160",
      alpha: { from: 0, to: 1 },
      duration: 1300,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: moonGroup,
          alpha: 0,
          delay: 900,
          duration: 800,
          onComplete: () => moonGroup.forEach((o) => o.destroy()),
        });
      },
    });

    // A wolf howl hint: expanding sound rings from the moon.
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(moonX, 120, 40, 0x000000, 0);
      ring.setStrokeStyle(2, 0xc8b8ff, 0.5);
      this.tweens.add({
        targets: ring,
        radius: 90 + i * 30,
        alpha: 0,
        delay: 1200 + i * 220,
        duration: 900,
        onComplete: () => ring.destroy(),
      });
    }
  }

  /** Day: warm sunrise gradient sweep + rays. */
  private fxDayBreak() {
    const w = this.scale.width;
    const h = this.scale.height;

    const glow = this.add.rectangle(w / 2, h / 2, w, h, 0xffd76e, 0);
    this.tweens.add({
      targets: glow,
      fillAlpha: 0.32,
      duration: 500,
      hold: 900,
      yoyo: true,
      onComplete: () => glow.destroy(),
    });

    // Sun rays fanning out from the top center.
    const cx = w / 2;
    for (let i = 0; i < 7; i++) {
      const angle = -90 + (i - 3) * 16;
      const ray = this.add.rectangle(cx, 0, 8, h * 0.7, 0xffe9a8, 0.25);
      ray.setOrigin(0.5, 0);
      ray.setAngle(angle);
      ray.setBlendMode(Phaser.BlendModes.ADD);
      ray.setScale(1, 0);
      this.tweens.add({
        targets: ray,
        scaleY: 1,
        alpha: { from: 0.35, to: 0 },
        delay: i * 60,
        duration: 900,
        ease: "Sine.easeOut",
        onComplete: () => ray.destroy(),
      });
    }

    // Rising warm motes (morning dust).
    for (let i = 0; i < 14; i++) {
      const mote = this.add.circle(
        Math.random() * w,
        h * (0.5 + Math.random() * 0.5),
        1.5 + Math.random() * 2,
        0xffe9a8,
        0.7,
      );
      this.tweens.add({
        targets: mote,
        y: mote.y - 60 - Math.random() * 80,
        alpha: 0,
        delay: Math.random() * 400,
        duration: 1100 + Math.random() * 500,
        onComplete: () => mote.destroy(),
      });
    }
  }

  /** Wolf kill: red vignette pulse + triple claw slash across the victim. */
  private fxWolfHunt(target: Anchor) {
    const w = this.scale.width;
    const h = this.scale.height;

    // Screen-edge red vignette pulse for dread.
    const vignette = this.add.rectangle(w / 2, h / 2, w, h, 0x6a0d1e, 0);
    this.tweens.add({
      targets: vignette,
      fillAlpha: 0.28,
      duration: 180,
      yoyo: true,
      hold: 260,
      onComplete: () => vignette.destroy(),
    });

    // Three staggered claw slashes — long, angled, with white hot core.
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 22;
      const core = this.add.rectangle(target.x + off, target.y, 3, 130, 0xffffff, 0.9);
      const blade = this.add.rectangle(target.x + off, target.y, 7, 130, 0xff4d6d, 0.95);
      [blade, core].forEach((r) => {
        r.setAngle(24);
        r.setScale(1, 0);
        r.setBlendMode(Phaser.BlendModes.ADD);
      });
      this.tweens.add({
        targets: [blade, core],
        scaleY: 1,
        delay: i * 90,
        duration: 160,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: [blade, core],
            alpha: 0,
            scaleX: 2.4,
            duration: 460,
            onComplete: () => {
              blade.destroy();
              core.destroy();
            },
          });
        },
      });
    }

    // Blood-red burst + drifting paw print dots walking away.
    this.burst(target, 0xff4d6d, 18, 1.3);
    for (let i = 0; i < 4; i++) {
      const paw = this.add.circle(
        target.x + 30 + i * 22,
        target.y + 40 + (i % 2) * 10,
        4,
        0xff4d6d,
        0,
      );
      this.tweens.add({
        targets: paw,
        alpha: { from: 0.8, to: 0 },
        delay: 500 + i * 160,
        duration: 700,
        onComplete: () => paw.destroy(),
      });
    }

    this.cameras.main.shake(260, 0.009);
  }

  /** Doctor save: golden shield dome + healing cross + sparkles. */
  private fxDoctorSave(target: Anchor) {
    // Shield dome.
    const dome = this.add.circle(target.x, target.y, 46, 0xfff2c8, 0.14);
    dome.setStrokeStyle(3, 0xfff2c8, 0.9);
    dome.setScale(0.3);
    this.tweens.add({
      targets: dome,
      scale: 1,
      duration: 320,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: dome,
          alpha: 0,
          delay: 700,
          duration: 500,
          onComplete: () => dome.destroy(),
        });
      },
    });

    // Cross.
    const v = this.add.rectangle(target.x, target.y, 9, 42, 0xfff2c8, 1);
    const hbar = this.add.rectangle(target.x, target.y, 30, 9, 0xfff2c8, 1);
    v.setScale(1, 0);
    hbar.setScale(0, 1);
    this.tweens.add({ targets: v, scaleY: 1, duration: 260, ease: "Quad.easeOut" });
    this.tweens.add({
      targets: hbar,
      scaleX: 1,
      duration: 260,
      delay: 80,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: [v, hbar],
      alpha: 0,
      delay: 800,
      duration: 600,
      onComplete: () => {
        v.destroy();
        hbar.destroy();
      },
    });

    // Rising sparkle plusses.
    for (let i = 0; i < 8; i++) {
      const s = this.add
        .text(
          target.x + (Math.random() - 0.5) * 70,
          target.y + (Math.random() - 0.5) * 30,
          "+",
          { fontSize: `${10 + Math.random() * 8}px`, color: "#fff2c8" },
        )
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({
        targets: s,
        alpha: { from: 1, to: 0 },
        y: s.y - 30 - Math.random() * 30,
        delay: 200 + Math.random() * 300,
        duration: 800,
        onComplete: () => s.destroy(),
      });
    }

    this.burst(target, 0xfff2c8, 14);
  }

  /** Seer: crystal-ball scry — concentric rings + eye flash colored by result. */
  private fxSeerGlow(target: Anchor, isWolf: boolean) {
    const color = isWolf ? 0xff4d6d : 0x6ad1ff;

    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(target.x, target.y, 8, 0x000000, 0);
      ring.setStrokeStyle(3 - i * 0.5, color, 0.9);
      this.tweens.add({
        targets: ring,
        radius: 46 + i * 22,
        alpha: 0,
        delay: i * 140,
        duration: 800,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
      });
    }

    // The scrying eye: an ellipse outline + iris dot that blinks open.
    const eyeW = 44;
    const eye = this.add.ellipse(target.x, target.y - 46, eyeW, 22, 0x000000, 0);
    eye.setStrokeStyle(2.5, color, 1);
    eye.setScale(1, 0);
    const iris = this.add.circle(target.x, target.y - 46, 7, color, 1);
    iris.setScale(0);
    this.tweens.add({ targets: eye, scaleY: 1, duration: 220, ease: "Quad.easeOut" });
    this.tweens.add({
      targets: iris,
      scale: 1,
      duration: 220,
      delay: 140,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: [eye, iris],
      alpha: 0,
      delay: 900,
      duration: 400,
      onComplete: () => {
        eye.destroy();
        iris.destroy();
      },
    });

    this.burst(target, color, 12, 0.9);
  }

  /** Lynch: spotlight isolates the accused, then crows scatter into dusk. */
  private fxLynch(target: Anchor) {
    const w = this.scale.width;
    const h = this.scale.height;

    // Darken everything…
    const dark = this.add.rectangle(w / 2, h / 2, w, h, 0x05030d, 0);
    this.tweens.add({
      targets: dark,
      fillAlpha: 0.55,
      duration: 350,
      hold: 900,
      yoyo: true,
      onComplete: () => dark.destroy(),
    });

    // …except a harsh spotlight cone on the target.
    const spot = this.add.circle(target.x, target.y, 74, 0xfff2c8, 0);
    spot.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: spot,
      fillAlpha: 0.22,
      duration: 350,
      hold: 700,
      yoyo: true,
      onComplete: () => spot.destroy(),
    });

    // Gavel strike: a bar slams down onto the seat.
    const gavel = this.add.rectangle(target.x, target.y - 120, 46, 14, 0xd9b66c, 1);
    gavel.setAngle(-20);
    this.tweens.add({
      targets: gavel,
      y: target.y - 30,
      angle: 6,
      duration: 240,
      delay: 250,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.cameras.main.shake(200, 0.007);
        this.burst(target, 0xd9b66c, 10, 0.8);
        this.tweens.add({
          targets: gavel,
          alpha: 0,
          y: gavel.y - 24,
          duration: 500,
          onComplete: () => gavel.destroy(),
        });
      },
    });

    // Crow scatter.
    for (let i = 0; i < 14; i++) {
      const crow = this.add.triangle(
        target.x,
        target.y,
        0, 6, 6, 0, 12, 6,
        0x080510,
        1,
      );
      const a = Math.random() * Math.PI - Math.PI; // upward half
      const d = 130 + Math.random() * 110;
      this.tweens.add({
        targets: crow,
        x: target.x + Math.cos(a) * d,
        y: target.y + Math.sin(a) * d * 0.7 - 40,
        angle: (Math.random() - 0.5) * 240,
        alpha: 0,
        delay: 400 + Math.random() * 200,
        duration: 700 + Math.random() * 500,
        ease: "Quad.easeOut",
        onComplete: () => crow.destroy(),
      });
    }
  }

  /** Villagers win: sunrise + confetti + dove-white bursts. */
  private fxVillagerWin() {
    const w = this.scale.width;
    const h = this.scale.height;

    const dawn = this.add.rectangle(w / 2, h / 2, w, h, 0xffd76e, 0);
    this.tweens.add({
      targets: dawn,
      fillAlpha: 0.25,
      duration: 700,
      hold: 1200,
      yoyo: true,
      onComplete: () => dawn.destroy(),
    });

    for (let i = 0; i < 90; i++) {
      const confetti = this.add.rectangle(
        Math.random() * w,
        -20 - Math.random() * 60,
        6 + Math.random() * 6,
        9 + Math.random() * 6,
        Phaser.Display.Color.RandomRGB(160, 255).color,
        1,
      );
      confetti.angle = Math.random() * 360;
      this.tweens.add({
        targets: confetti,
        y: h + 40,
        angle: confetti.angle + 360 + Math.random() * 360,
        x: confetti.x + (Math.random() - 0.5) * 120,
        delay: Math.random() * 500,
        duration: 1800 + Math.random() * 1500,
        ease: "Cubic.easeIn",
        onComplete: () => confetti.destroy(),
      });
    }

    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(300 + i * 260, () => {
        this.burst(
          { x: w * (0.3 + Math.random() * 0.4), y: h * (0.3 + Math.random() * 0.3) },
          0xffffff,
          16,
          1.1,
        );
      });
    }
  }

  /** Wolves win: blood moon rises, claw marks rake the whole screen. */
  private fxWolfWin() {
    const w = this.scale.width;
    const h = this.scale.height;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x6a0d1e, 0);
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.55,
      duration: 700,
      hold: 1100,
      yoyo: true,
      onComplete: () => overlay.destroy(),
    });

    // Blood moon.
    const moonHalo = this.add.circle(w / 2, h * 0.3, 76, 0xff4d6d, 0.12);
    const moon = this.add.circle(w / 2, h * 0.3, 48, 0xd42a4e, 0.95);
    [moonHalo, moon].forEach((o) => o.setScale(0));
    this.tweens.add({
      targets: [moonHalo, moon],
      scale: 1,
      duration: 600,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: [moonHalo, moon],
          alpha: 0,
          delay: 1000,
          duration: 700,
          onComplete: () => {
            moonHalo.destroy();
            moon.destroy();
          },
        });
      },
    });

    // Screen-wide claw rake.
    for (let i = 0; i < 4; i++) {
      const slash = this.add.rectangle(
        w * 0.2 + i * w * 0.18,
        h / 2,
        10,
        h * 1.2,
        0xff4d6d,
        0.85,
      );
      slash.setAngle(28);
      slash.setScale(1, 0);
      slash.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: slash,
        scaleY: 1,
        delay: 350 + i * 110,
        duration: 200,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: slash,
            alpha: 0,
            duration: 600,
            onComplete: () => slash.destroy(),
          });
        },
      });
    }

    this.burst({ x: w / 2, y: h / 2 }, 0xff4d6d, 34, 1.6);
    this.cameras.main.shake(420, 0.012);
  }

  /** Role reveal: tarot card flips over at the seat, then fades. */
  private fxRoleReveal(role: Role, at: Anchor) {
    const key = `role-${ROLE_KEY[role] ?? "villager"}`;
    const hasArt = this.textures.exists(key);
    const cardW = 84;
    const cardH = 118;

    const back = this.textures.exists("role-back")
      ? this.add.image(at.x, at.y - 20, "role-back")
      : null;
    const face = hasArt ? this.add.image(at.x, at.y - 20, key) : null;

    if (back && face) {
      back.setDisplaySize(cardW, cardH);
      face.setDisplaySize(cardW, cardH);
      face.setScale(0, face.scaleY);
      back.setScale(back.scaleX, back.scaleY);
      const faceScaleX = cardW / face.width;
      const backScaleX = cardW / back.width;

      // flip: back shrinks to 0 width, face grows from 0.
      this.tweens.add({
        targets: back,
        scaleX: 0,
        duration: 200,
        ease: "Quad.easeIn",
        onComplete: () => {
          back.destroy();
          this.tweens.add({
            targets: face,
            scaleX: faceScaleX,
            duration: 220,
            ease: "Quad.easeOut",
          });
        },
      });
      void backScaleX;
      this.tweens.add({
        targets: face,
        y: face.y - 10,
        alpha: 0,
        delay: 1700,
        duration: 500,
        onComplete: () => face.destroy(),
      });
    }

    this.burst(at, 0xd9b66c, 18, 1.2);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private burst(at: Anchor, color: number, count: number, scale = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 60;
      const dot = this.add.circle(at.x, at.y, 2 + Math.random() * 2.5 * scale, color, 1);
      this.tweens.add({
        targets: dot,
        x: at.x + Math.cos(a) * d,
        y: at.y + Math.sin(a) * d,
        alpha: 0,
        duration: 600 + Math.random() * 200,
        ease: "Cubic.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }
}
