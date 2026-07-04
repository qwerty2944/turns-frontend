"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CARD_DESC_KR, CARD_NAMES_KR } from "../model/cards";
import {
  Announcement,
  announcementFlyTarget,
} from "../model/announcements";
import type { AnnouncementItem } from "../model/useAnnouncementQueue";
import { CardImage } from "./CardImage";

type Props = {
  item: AnnouncementItem | null;
  leaving: boolean;
  /** Anchor (relative to the table wrap) for a nickname's seat/hand. */
  resolveAnchor: (nickname?: string) => { x: number; y: number } | undefined;
};

/**
 * Big center-of-table announcement: card slams in with a banner, holds,
 * then flies toward the actor's seat (plays) or fades (everything else).
 * Entirely non-interactive — never blocks seat/hand clicks.
 */
export const CenterStage = ({ item, leaving, resolveAnchor }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [leaveStyle, setLeaveStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!leaving || !item) {
      setLeaveStyle({});
      return;
    }
    const wrap = wrapRef.current;
    const flyTo = announcementFlyTarget(item.a);
    const anchor = flyTo ? resolveAnchor(flyTo) : undefined;
    if (wrap && anchor) {
      const rect = wrap.getBoundingClientRect();
      const dx = anchor.x - rect.width / 2;
      const dy = anchor.y - rect.height / 2;
      setLeaveStyle({
        transform: `translate(${dx}px, ${dy}px) scale(0.2)`,
        opacity: 0,
      });
    } else {
      setLeaveStyle({ transform: "scale(0.9)", opacity: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, item?.id]);

  if (!item) return null;

  return (
    <div ref={wrapRef} className="ll-centerstage" aria-live="polite">
      <div key={item.id} className="ll-centerstage-inner" style={leaveStyle}>
        <StageContent a={item.a} />
      </div>
    </div>
  );
};

const StageContent = ({ a }: { a: Announcement }) => {
  switch (a.type) {
    case "play":
      return (
        <>
          <div className="ll-centerstage-card">
            <CardImage card={a.card} fluid noTooltip />
          </div>
          <div className="ll-centerstage-banner">
            <span className="ll-centerstage-title">
              {a.card}. {CARD_NAMES_KR[a.card]}
            </span>
            <span className="ll-centerstage-sub">
              {a.actor}
              {a.target ? ` → ${a.target}` : ""}
              {a.guess ? ` · 추측: ${CARD_NAMES_KR[a.guess]}` : ""}
              {a.noTarget ? " · 대상 없음 (효과 없이 버림)" : ""}
            </span>
            <span className="ll-centerstage-sub" style={{ color: "var(--muted)" }}>
              {CARD_DESC_KR[a.card]}
            </span>
          </div>
        </>
      );
    case "verdict":
      return (
        <div
          className={`ll-centerstage-banner${a.hit ? " ll-centerstage-banner--hit" : ""}`}
        >
          <span className="ll-centerstage-title">
            {a.hit ? "🎯 적중!" : "❌ 빗나감"}
          </span>
          {a.guess ? (
            <span className="ll-centerstage-sub">
              추측: {CARD_NAMES_KR[a.guess]}
            </span>
          ) : null}
        </div>
      );
    case "peek":
      return (
        <>
          <div className="ll-centerstage-card">
            <CardImage card={a.card} fluid noTooltip />
          </div>
          <div className="ll-centerstage-banner">
            <span className="ll-centerstage-title">
              🕯 {a.nickname}의 카드
            </span>
            <span className="ll-centerstage-sub">
              {a.card}. {CARD_NAMES_KR[a.card]}
            </span>
            <span className="ll-centerstage-note">🤫 나에게만 보입니다</span>
          </div>
        </>
      );
    case "eliminated":
      return (
        <div className="ll-centerstage-banner ll-centerstage-banner--hit">
          <span className="ll-centerstage-title">💀 {a.name} 탈락!</span>
        </div>
      );
    case "roundWin":
      return (
        <div className="ll-centerstage-banner">
          <span className="ll-centerstage-title">🏆 {a.name} 라운드 승리!</span>
        </div>
      );
  }
};
