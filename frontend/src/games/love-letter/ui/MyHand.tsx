"use client";

import { CARD, CARD_NAMES_KR } from "../model/cards";
import type { TargetingState } from "../model/targeting";
import { CardImage } from "./CardImage";
import { HandCard } from "./HandCard";

const GUARD_GUESS_OPTIONS = [
  CARD.PRIEST,
  CARD.BARON,
  CARD.HANDMAID,
  CARD.PRINCE,
  CARD.KING,
  CARD.COUNTESS,
  CARD.PRINCESS,
];

type Props = {
  hand: number[];
  isMyTurn: boolean;
  myEliminated: boolean;
  targeting: TargetingState;
  countessRestriction: boolean;
  /** Bumps when a locked card is clicked, keyed by hand index. */
  shakeKeys: number[];
  incomingIdx: number | null;
  showSelfPad: boolean;
  statusText: string;
  statusColor: string;
  handRef: React.MutableRefObject<HTMLDivElement | null>;
  onPick: (card: number, idx: number) => void;
  onGuess: (card: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSelfTarget: () => void;
};

export const MyHand = ({
  hand,
  isMyTurn,
  myEliminated,
  targeting,
  countessRestriction,
  shakeKeys,
  incomingIdx,
  showSelfPad,
  statusText,
  statusColor,
  handRef,
  onPick,
  onGuess,
  onConfirm,
  onCancel,
  onSelfTarget,
}: Props) => {
  const selectedIdx =
    targeting.mode === "idle" ? null : targeting.handIdx;

  return (
    <div className="ll-hand-zone">
      {/* Floating action strip above the hand */}
      {targeting.mode === "confirm" && (
        <div className="ll-action-strip">
          <span style={{ fontSize: 13 }}>
            {targeting.noTargets
              ? "지목 가능한 대상 없음 — 효과 없이 버립니다"
              : `${CARD_NAMES_KR[targeting.card]} 사용할까요?`}
          </span>
          <button onClick={onConfirm}>사용</button>
          <button onClick={onCancel}>취소</button>
        </div>
      )}
      {targeting.mode === "target" && (
        <div className="ll-action-strip">
          <span style={{ fontSize: 13, color: "var(--gold-soft)" }}>
            ⬆ 대상을 선택하세요
          </span>
          <button onClick={onCancel}>취소</button>
        </div>
      )}
      {targeting.mode === "guess" && (
        <div className="ll-action-strip" style={{ flexDirection: "column" }}>
          <span style={{ fontSize: 13, color: "var(--gold-soft)" }}>
            추측할 카드를 선택 (병사 제외)
          </span>
          <div className="ll-guess-strip">
            {GUARD_GUESS_OPTIONS.map((c) => (
              <button key={c} className="ll-guess-card" onClick={() => onGuess(c)}>
                <CardImage card={c} size={48} noTooltip />
                <span>
                  {c}. {CARD_NAMES_KR[c]}
                </span>
              </button>
            ))}
          </div>
          <button onClick={onCancel}>취소</button>
        </div>
      )}

      <div
        className="ll-hand"
        ref={handRef}
        style={{ alignItems: "flex-end" }}
      >
        {hand.length === 0 ? (
          <span className="muted">손패 없음</span>
        ) : (
          hand.map((c, idx) => {
            const locked =
              countessRestriction &&
              (c === CARD.KING || c === CARD.PRINCE);
            const fanRot =
              hand.length === 2 ? (idx === 0 ? -4 : 4) : 0;
            const fanY = hand.length === 2 ? 4 : 0;
            return (
              <HandCard
                key={`${c}-${idx}`}
                card={c}
                playable={isMyTurn && !myEliminated}
                selected={selectedIdx === idx}
                locked={locked}
                incoming={incomingIdx === idx}
                fanRot={fanRot}
                fanY={fanY}
                shakeKey={shakeKeys[idx] ?? 0}
                onPick={() => onPick(c, idx)}
              />
            );
          })
        )}
        {showSelfPad && (
          <button className="ll-self-pad" onClick={onSelfTarget}>
            <CardImage card={0} faceDown size={40} />
            <span>나 (자신)</span>
          </button>
        )}
      </div>

      <div className="ll-status" style={{ color: statusColor }}>
        {statusText}
      </div>
    </div>
  );
};
