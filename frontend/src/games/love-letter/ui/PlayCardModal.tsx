"use client";

import { useEffect, useState } from "react";
import {
  CARD,
  CARD_NAMES_KR,
  cardNeedsGuardGuess,
  cardNeedsTarget,
} from "../model/cards";
import { CardImage } from "./CardImage";

type Target = { sessionId: string; nickname: string; eliminated: boolean; protected: boolean };

type Props = {
  card: number;
  selfSessionId: string;
  targets: Target[];
  myHandHasCountessRestriction: boolean;
  onConfirm: (payload: {
    card: number;
    targetSessionId?: string;
    guardGuess?: number;
  }) => void;
  onCancel: () => void;
};

const GUARD_GUESS_OPTIONS = [
  CARD.PRIEST, CARD.BARON, CARD.HANDMAID, CARD.PRINCE,
  CARD.KING, CARD.COUNTESS, CARD.PRINCESS,
];

export const PlayCardModal = ({
  card,
  selfSessionId,
  targets,
  myHandHasCountessRestriction,
  onConfirm,
  onCancel,
}: Props) => {
  const needsTarget = cardNeedsTarget(card);
  const allowSelfTarget = card === CARD.PRINCE;
  const validTargets = targets.filter(
    (t) =>
      !t.eliminated &&
      !t.protected &&
      (allowSelfTarget || t.sessionId !== selfSessionId),
  );
  const everyoneProtected =
    needsTarget && validTargets.filter((t) => t.sessionId !== selfSessionId).length === 0;

  const [targetSid, setTargetSid] = useState<string>("");
  const [guess, setGuess] = useState<number>(CARD.PRIEST);

  useEffect(() => {
    if (validTargets.length > 0) setTargetSid(validTargets[0].sessionId);
  }, [validTargets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (myHandHasCountessRestriction && card !== CARD.COUNTESS) {
    return (
      <Backdrop onClose={onCancel}>
        <h3 className="title" style={{ margin: 0 }}>
          {CARD_NAMES_KR[CARD.COUNTESS]} 규칙
        </h3>
        <p className="muted">
          왕 또는 왕자와 함께 손에 들었을 때는 반드시 백작부인을 버려야 합니다.
        </p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button onClick={onCancel}>닫기</button>
        </div>
      </Backdrop>
    );
  }

  const submit = () => {
    if (needsTarget && !everyoneProtected) {
      if (!targetSid) return;
    }
    onConfirm({
      card,
      targetSessionId: needsTarget && !everyoneProtected ? targetSid : undefined,
      guardGuess: cardNeedsGuardGuess(card) ? guess : undefined,
    });
  };

  return (
    <Backdrop onClose={onCancel}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <CardImage card={card} size={90} />
        <div className="col" style={{ gap: 4 }}>
          <h3 className="title" style={{ margin: 0 }}>{CARD_NAMES_KR[card]} 사용</h3>
          {everyoneProtected && (
            <p className="muted">대상이 모두 보호 또는 탈락 상태입니다. 효과 없이 버립니다.</p>
          )}
          {needsTarget && !everyoneProtected && (
            <label className="col" style={{ gap: 4 }}>
              <span className="muted">대상</span>
              <select
                value={targetSid}
                onChange={(e) => setTargetSid(e.target.value)}
                style={selectStyle}
              >
                {validTargets.map((t) => (
                  <option key={t.sessionId} value={t.sessionId}>
                    {t.nickname}{t.sessionId === selfSessionId ? " (나)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {cardNeedsGuardGuess(card) && (
            <label className="col" style={{ gap: 4 }}>
              <span className="muted">추측할 카드 (병사 제외)</span>
              <select
                value={guess}
                onChange={(e) => setGuess(Number(e.target.value))}
                style={selectStyle}
              >
                {GUARD_GUESS_OPTIONS.map((c) => (
                  <option key={c} value={c}>{CARD_NAMES_KR[c]}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel}>취소</button>
        <button onClick={submit}>사용</button>
      </div>
    </Backdrop>
  );
};

const selectStyle: React.CSSProperties = {
  background: "rgba(13,10,31,0.6)",
  border: "1px solid rgba(217,182,108,0.4)",
  color: "var(--text)",
  padding: "0.4rem",
  borderRadius: 6,
};

const Backdrop = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(8, 5, 22, 0.75)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="panel col"
      style={{ maxWidth: 460, width: "92vw" }}
    >
      {children}
    </div>
  </div>
);
