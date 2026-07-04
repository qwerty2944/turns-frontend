"use client";

import dynamic from "next/dynamic";
import { CARD } from "../model/cards";
import type { TargetingState } from "../model/targeting";
import type { AnnouncementItem } from "../model/useAnnouncementQueue";
import type { EffectsOverlayHandle } from "./PhaserEffectsOverlay";
import { CardCounter } from "./CardCounter";
import { CenterStage } from "./CenterStage";
import { DeckStack } from "./DeckStack";
import { DrawFlyer, type Flight } from "./DrawFlyer";
import { MyHand } from "./MyHand";
import { OpponentSeat, type OpponentView } from "./OpponentSeat";
import { TurnBanner } from "./TurnBanner";

// Phaser pulls in `window`; load only on the client.
const PhaserEffectsOverlay = dynamic(() => import("./PhaserEffectsOverlay"), {
  ssr: false,
});

type Props = {
  opponents: OpponentView[];
  currentTurnSid?: string;
  deckRemaining: number;
  publicDiscard: number[];
  myHand: number[];
  isMyTurn: boolean;
  myEliminated: boolean;
  myTokens: number;
  myNickname: string;
  myProtected: boolean;

  targeting: TargetingState;
  targetableSids: Set<string>;
  countessRestriction: boolean;
  shakeKeys: number[];
  incomingIdx: number | null;
  flight: Flight | null;
  showTurnBanner: boolean;
  announcement: AnnouncementItem | null;
  announcementLeaving: boolean;
  resolveAnchor: (nickname?: string) => { x: number; y: number } | undefined;

  onPickCard: (card: number, idx: number) => void;
  onSeatTarget: (sid: string) => void;
  onGuess: (card: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onFlightDone: () => void;

  meSid?: string;
  seatRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  myHandRef: React.MutableRefObject<HTMLDivElement | null>;
  deckRef: React.MutableRefObject<HTMLDivElement | null>;
  overlayWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  overlayRef: React.MutableRefObject<EffectsOverlayHandle | null>;
};

export const TableView = ({
  opponents,
  currentTurnSid,
  deckRemaining,
  publicDiscard,
  myHand,
  isMyTurn,
  myEliminated,
  myTokens,
  myNickname,
  myProtected,
  targeting,
  targetableSids,
  countessRestriction,
  shakeKeys,
  incomingIdx,
  flight,
  showTurnBanner,
  announcement,
  announcementLeaving,
  resolveAnchor,
  onPickCard,
  onSeatTarget,
  onGuess,
  onConfirm,
  onCancel,
  onFlightDone,
  meSid,
  seatRefs,
  myHandRef,
  deckRef,
  overlayWrapRef,
  overlayRef,
}: Props) => {
  const aiming = targeting.mode === "target";

  // Click on any non-interactive spot of the table cancels targeting.
  const onTableClick = (e: React.MouseEvent) => {
    if (targeting.mode === "idle") return;
    const el = e.target as HTMLElement;
    if (
      el.closest(
        "button, .ll-action-strip, .ll-seat--targetable, .ll-self-pad",
      )
    ) {
      return;
    }
    onCancel();
  };

  const statusText = myEliminated
    ? `💀 탈락  ❤ ${myTokens} · ${myNickname}`
    : `${
        isMyTurn ? "내 차례 — 카드를 클릭해서 사용" : "상대 차례를 기다리는 중"
      }  ❤ ${myTokens} · ${myNickname}${myProtected ? " 🛡" : ""}`;
  const statusColor = myEliminated
    ? "var(--danger)"
    : isMyTurn
      ? "var(--gold-soft)"
      : "var(--muted)";

  return (
    <div
      ref={overlayWrapRef}
      className="panel ll-table"
      onClick={onTableClick}
    >
      {/* Remaining-cards tracker */}
      <CardCounter publicDiscard={publicDiscard} />

      {/* Opponents row */}
      <div className="ll-seats">
        {opponents.length === 0 && (
          <span className="muted">상대를 기다리는 중…</span>
        )}
        {opponents.map((op) => (
          <OpponentSeat
            key={op.sessionId}
            op={op}
            isTurn={op.sessionId === currentTurnSid}
            targetable={aiming && targetableSids.has(op.sessionId)}
            dimmed={aiming && !targetableSids.has(op.sessionId)}
            registerRef={(el) => seatRefs.current.set(op.sessionId, el)}
            onTarget={() => onSeatTarget(op.sessionId)}
          />
        ))}
      </div>

      {/* Deck center */}
      <DeckStack remaining={deckRemaining} deckRef={deckRef} />

      {/* My hand */}
      <MyHand
        hand={myHand}
        isMyTurn={isMyTurn}
        myEliminated={myEliminated}
        targeting={targeting}
        countessRestriction={countessRestriction}
        shakeKeys={shakeKeys}
        incomingIdx={incomingIdx}
        showSelfPad={
          aiming &&
          targeting.mode === "target" &&
          targeting.card === CARD.PRINCE &&
          !!meSid &&
          targetableSids.has(meSid)
        }
        statusText={statusText}
        statusColor={statusColor}
        handRef={myHandRef}
        onPick={onPickCard}
        onGuess={onGuess}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onSelfTarget={() => meSid && onSeatTarget(meSid)}
      />

      {/* Phaser particles — z:1, no pointer events */}
      <PhaserEffectsOverlay ref={overlayRef} />

      {/* Draw animation — z:4 */}
      {flight && <DrawFlyer flight={flight} onDone={onFlightDone} />}

      {/* Center-stage announcements — z:5, no pointer events */}
      <CenterStage
        item={announcement}
        leaving={announcementLeaving}
        resolveAnchor={resolveAnchor}
      />

      {/* Turn banner — z:6 */}
      {showTurnBanner && <TurnBanner />}
    </div>
  );
};
