"use client";

/** "내 차례!" swoosh across the table. Mount only while visible. */
export const TurnBanner = () => (
  <div className="ll-turn-banner" aria-hidden>
    <div className="ll-turn-banner-inner">⚔ 내 차례!</div>
  </div>
);
