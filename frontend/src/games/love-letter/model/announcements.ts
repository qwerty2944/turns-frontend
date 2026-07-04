/**
 * Center-stage announcements — big card reveals + banners driven by the
 * same server-log diff that feeds the Phaser particle overlay.
 */
export type Announcement =
  | {
      type: "play";
      card: number;
      actor: string;
      target?: string;
      guess?: number;
      noTarget: boolean;
    }
  | { type: "verdict"; hit: boolean; guess?: number }
  | { type: "peek"; card: number; nickname: string }
  | { type: "eliminated"; name: string }
  | { type: "roundWin"; name: string };

export const SLAM_MS = 250;
export const LEAVE_MS = 350;
/** Hold time while ≥3 announcements are backed up in the queue. */
export const COMPRESSED_HOLD_MS = 500;

export const HOLD_MS: Record<Announcement["type"], number> = {
  play: 1100,
  verdict: 900,
  peek: 2600,
  eliminated: 950,
  roundWin: 1300,
};

export type LogEntryLike = {
  kind: string;
  text: string;
  actor?: string;
  target?: string;
  card?: number;
  guess?: number;
};

/**
 * Map a server log entry to an announcement (or null for log-panel-only
 * entries). Text heuristics mirror the server's emoji prefixes — the same
 * ones the Phaser dispatch already relies on.
 */
export const logToAnnouncement = (e: LogEntryLike): Announcement | null => {
  const text = typeof e.text === "string" ? e.text : "";
  if (e.kind === "play" && e.card) {
    return {
      type: "play",
      card: e.card,
      actor: e.actor || "",
      target: e.target || undefined,
      guess: e.guess || undefined,
      noTarget: text.includes("(대상 없음)"),
    };
  }
  if (e.kind === "reveal") {
    if (text.startsWith("🎯")) return { type: "verdict", hit: true, guess: e.guess };
    if (text.startsWith("❌")) return { type: "verdict", hit: false, guess: e.guess };
    return null;
  }
  if (e.kind === "result") {
    if (text.includes("라운드 승리") && e.actor)
      return { type: "roundWin", name: e.actor };
    if (text.includes("탈락") && e.actor)
      return { type: "eliminated", name: e.actor };
    return null;
  }
  return null;
};

/** Nickname whose seat the leaving card should fly toward (if any). */
export const announcementFlyTarget = (a: Announcement): string | undefined => {
  if (a.type === "play") return a.actor;
  return undefined;
};
