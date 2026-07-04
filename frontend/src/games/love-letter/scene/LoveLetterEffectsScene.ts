import Phaser from "phaser";
import { CARD_KEY } from "../model/cards";

export type Anchor = { x: number; y: number };

export type EffectPayload =
  | {
      kind: "play";
      card: number;
      actor: Anchor;
      target?: Anchor;
      guess?: number;
      deck?: Anchor;
    }
  | { kind: "guardHit"; target: Anchor }
  | { kind: "guardMiss"; actor: Anchor }
  | { kind: "eliminated"; seat: Anchor }
  | { kind: "roundWin"; seat: Anchor }
  | { kind: "confetti" };

type Listener = { onReady: () => void };

export class LoveLetterEffectsScene extends Phaser.Scene {
  private listener: Listener = { onReady: () => {} };
  private booted = false;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super("effects");
  }

  setOnReady(cb: () => void) {
    this.listener = { onReady: cb };
    if (this.booted) cb();
  }

  preload() {
    for (const key of Object.values(CARD_KEY)) {
      this.load.image(`card-${key}`, `/cards/${key}.png`);
    }
    this.load.image("card-back", `/cards/back.png`);
  }

  create() {
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.layer = this.add.container(0, 0);
    this.booted = true;
    this.listener.onReady();
  }

  playEffect(p: EffectPayload) {
    if (!this.booted) return;
    switch (p.kind) {
      case "play":
        this.fxPlay(p);
        break;
      case "guardHit":
        this.fxGuardHit(p.target);
        break;
      case "guardMiss":
        this.fxGuardMiss(p.actor);
        break;
      case "eliminated":
        this.fxEliminated(p.seat);
        break;
      case "roundWin":
        this.fxRoundWin(p.seat);
        break;
      case "confetti":
        this.fxConfettiFull();
        break;
    }
  }

  // ───────────────────── per-card effects ───────────────────── //

  private fxPlay(p: Extract<EffectPayload, { kind: "play" }>) {
    switch (p.card) {
      case 1:
        return this.fxGuardThrow(p.actor, p.target, p.guess);
      case 2:
        return this.fxPriestRay(p.actor, p.target);
      case 3:
        return this.fxBaronCollide(p.actor, p.target);
      case 4:
        return this.fxHandmaidShield(p.actor);
      case 5:
        return this.fxPrinceVortex(p.target ?? p.actor);
      case 6:
        return this.fxKingSwap(p.actor, p.target);
      case 7:
        return this.fxCountessShimmer(p.actor);
      case 8:
        return this.fxPrincessFall(p.actor);
    }
  }

  /** Responsive card sprite width: scales with the table, clamped. */
  private cardWidth(mult = 1) {
    return Phaser.Math.Clamp(this.scale.width * 0.085, 56, 110) * mult;
  }

  private spawnCardSprite(at: Anchor, cardKey: string, mult = 1) {
    const tex = this.textures.exists(`card-${cardKey}`)
      ? `card-${cardKey}`
      : "card-back";
    const s = this.add.image(at.x, at.y, tex);
    const w = this.cardWidth(mult);
    s.setDisplaySize(w, w * 1.5);
    return s;
  }

  private fxGuardThrow(actor: Anchor, target?: Anchor, guess?: number) {
    const dest = target ?? actor;
    const sprite = this.spawnCardSprite(actor, "guard", 1);
    sprite.setAlpha(0);
    this.tweens.add({
      targets: sprite,
      alpha: 1,
      x: dest.x,
      y: dest.y,
      angle: 360,
      duration: 700,
      ease: "Sine.easeInOut",
      onComplete: () => {
        sprite.destroy();
        this.burst(dest, 0xff6b6b, 16);
      },
    });
    if (guess) {
      const guessKey = ["", "guard", "priest", "baron", "handmaid", "prince", "king", "countess", "princess"][guess];
      const g = this.spawnCardSprite(dest, guessKey, 0.8);
      g.setAlpha(0);
      g.y -= 70;
      this.tweens.add({
        targets: g,
        alpha: 1,
        y: g.y - 18,
        duration: 500,
        delay: 400,
        yoyo: true,
        hold: 600,
        onComplete: () => g.destroy(),
      });
    }
  }

  private fxPriestRay(actor: Anchor, target?: Anchor) {
    const dest = target ?? actor;
    const line = this.add.graphics();
    line.lineStyle(5, 0xf1d999, 0.9);
    line.lineBetween(actor.x, actor.y, dest.x, dest.y);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 800,
      onComplete: () => line.destroy(),
    });
    this.burst(dest, 0xf1d999, 18);
  }

  private fxBaronCollide(actor: Anchor, target?: Anchor) {
    if (!target) return;
    const mid: Anchor = {
      x: (actor.x + target.x) / 2,
      y: (actor.y + target.y) / 2,
    };
    const a = this.spawnCardSprite(actor, "baron", 0.95);
    const b = this.spawnCardSprite(target, "baron", 0.95);
    this.tweens.add({
      targets: a,
      x: mid.x - 30,
      y: mid.y,
      duration: 450,
      ease: "Quad.easeIn",
    });
    this.tweens.add({
      targets: b,
      x: mid.x + 30,
      y: mid.y,
      duration: 450,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.cameras.main.shake(150, 0.005);
        this.burst(mid, 0xffd166, 22);
        // loser falls (we don't know which; drop both with tiny separation)
        this.physics.add.existing(a);
        this.physics.add.existing(b);
        const bodyA = a.body as Phaser.Physics.Arcade.Body;
        const bodyB = b.body as Phaser.Physics.Arcade.Body;
        bodyA.setGravityY(900);
        bodyB.setGravityY(900);
        bodyA.setVelocity(-90, -170);
        bodyB.setVelocity(90, -170);
        this.time.delayedCall(900, () => {
          a.destroy();
          b.destroy();
        });
      },
    });
  }

  private fxHandmaidShield(actor: Anchor) {
    const ring = this.add.graphics();
    ring.lineStyle(6, 0xc8a5ff, 0.9);
    ring.strokeCircle(0, 0, 56);
    ring.setPosition(actor.x, actor.y);
    ring.setScale(0.4);
    this.tweens.add({
      targets: ring,
      scale: 1.6,
      alpha: 0,
      duration: 900,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private fxPrinceVortex(at: Anchor) {
    const swirl = this.add.graphics();
    swirl.lineStyle(4, 0x7a3fff, 0.85);
    for (let i = 0; i < 4; i++) {
      const r = 22 + i * 14;
      swirl.strokeCircle(0, 0, r);
    }
    swirl.setPosition(at.x, at.y);
    this.tweens.add({
      targets: swirl,
      angle: 360,
      scale: 1.4,
      alpha: 0,
      duration: 900,
      onComplete: () => swirl.destroy(),
    });
    const eject = this.spawnCardSprite(at, "back", 0.85);
    this.tweens.add({
      targets: eject,
      y: at.y - 110,
      alpha: 0,
      angle: 540,
      duration: 850,
      onComplete: () => eject.destroy(),
    });
  }

  private fxKingSwap(actor: Anchor, target?: Anchor) {
    if (!target) return;
    const a = this.spawnCardSprite(actor, "back", 0.9);
    const b = this.spawnCardSprite(target, "back", 0.9);
    this.tweens.add({
      targets: a,
      x: target.x,
      y: target.y,
      angle: 180,
      duration: 700,
      ease: "Sine.easeInOut",
      onComplete: () => a.destroy(),
    });
    this.tweens.add({
      targets: b,
      x: actor.x,
      y: actor.y,
      angle: -180,
      duration: 700,
      ease: "Sine.easeInOut",
      onComplete: () => b.destroy(),
    });
  }

  private fxCountessShimmer(actor: Anchor) {
    const aura = this.add.graphics();
    aura.fillStyle(0xf1d999, 0.35);
    aura.fillCircle(0, 0, 48);
    aura.setPosition(actor.x, actor.y);
    aura.setScale(0.4);
    this.tweens.add({
      targets: aura,
      scale: 1.3,
      alpha: 0,
      duration: 700,
      yoyo: true,
      repeat: 1,
      onComplete: () => aura.destroy(),
    });
  }

  private fxPrincessFall(seat: Anchor) {
    const start = { x: seat.x, y: -120 };
    const sprite = this.spawnCardSprite(start, "princess", 1.15);
    this.physics.add.existing(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(1400);
    body.setVelocityY(0);
    this.time.delayedCall(600, () => {
      this.cameras.main.shake(220, 0.012);
      this.burst(seat, 0xffe2a8, 28);
      sprite.destroy();
    });
  }

  // ───────────────────── outcome effects ───────────────────── //

  private fxGuardHit(target: Anchor) {
    const flash = this.add.rectangle(target.x, target.y, 160, 230, 0xff4d4d, 0.55);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.4,
      duration: 600,
      onComplete: () => flash.destroy(),
    });
    this.cameras.main.shake(120, 0.006);
  }

  private fxGuardMiss(actor: Anchor) {
    const txt = this.add
      .text(actor.x, actor.y - 40, "❌", { fontSize: "40px" })
      .setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      y: txt.y - 40,
      duration: 800,
      onComplete: () => txt.destroy(),
    });
  }

  private fxEliminated(seat: Anchor) {
    this.burst(seat, 0x202020, 36, 1.6);
    this.cameras.main.shake(260, 0.01);
  }

  private fxRoundWin(seat: Anchor) {
    for (let i = 0; i < 24; i++) {
      const dot = this.add.rectangle(
        seat.x + (Math.random() - 0.5) * 60,
        -10,
        7,
        7,
        Phaser.Display.Color.RandomRGB(150, 255).color,
      );
      dot.angle = Math.random() * 360;
      this.physics.add.existing(dot);
      const body = dot.body as Phaser.Physics.Arcade.Body;
      body.setGravityY(600);
      body.setVelocity((Math.random() - 0.5) * 250, Math.random() * 60);
      this.time.delayedCall(1800, () => dot.destroy());
    }
    this.fxConfettiFull();
  }

  /** Full-table confetti rain (round win / game end). */
  private fxConfettiFull() {
    const w = this.scale.width;
    for (let i = 0; i < 140; i++) {
      const dot = this.add.rectangle(
        Math.random() * w,
        -20 - Math.random() * 60,
        5 + Math.random() * 5,
        5 + Math.random() * 5,
        Phaser.Display.Color.RandomRGB(140, 255).color,
      );
      dot.angle = Math.random() * 360;
      this.physics.add.existing(dot);
      const body = dot.body as Phaser.Physics.Arcade.Body;
      body.setGravityY(500 + Math.random() * 320);
      body.setVelocity((Math.random() - 0.5) * 160, Math.random() * 80);
      body.setAngularVelocity((Math.random() - 0.5) * 360);
      this.time.delayedCall(2600, () => dot.destroy());
    }
  }

  // ───────────────────── helpers ───────────────────── //

  private burst(at: Anchor, color: number, count: number, scale = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 150;
      const dot = this.add.circle(at.x, at.y, 4 * scale, color, 1);
      this.tweens.add({
        targets: dot,
        x: at.x + Math.cos(a) * speed,
        y: at.y + Math.sin(a) * speed,
        alpha: 0,
        duration: 500 + Math.random() * 300,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }
}
