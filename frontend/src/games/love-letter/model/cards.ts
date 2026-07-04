export const CARD = {
  GUARD: 1,
  PRIEST: 2,
  BARON: 3,
  HANDMAID: 4,
  PRINCE: 5,
  KING: 6,
  COUNTESS: 7,
  PRINCESS: 8,
} as const;

export const CARD_NAMES_KR: Record<number, string> = {
  1: "병사",
  2: "사제",
  3: "남작",
  4: "하녀",
  5: "왕자",
  6: "왕",
  7: "백작부인",
  8: "공주",
};

export const CARD_DESC_KR: Record<number, string> = {
  1: "다른 플레이어 카드 추측 (병사 제외). 적중 시 탈락",
  2: "다른 플레이어 손패 본다",
  3: "다른 플레이어와 비교. 낮은 쪽 탈락",
  4: "다음 차례까지 효과로부터 보호",
  5: "한 명을 지목해 손패를 버리고 다시 뽑게 함 (자신 가능)",
  6: "다른 플레이어와 손패 교환",
  7: "왕/왕자와 같이 있으면 반드시 버려야 함",
  8: "버려지면 즉시 탈락",
};

export const CARD_KEY: Record<number, string> = {
  1: "guard",
  2: "priest",
  3: "baron",
  4: "handmaid",
  5: "prince",
  6: "king",
  7: "countess",
  8: "princess",
};

/** Copies of each card in the 16-card deck (5 Guards … 1 Princess). */
export const CARD_TOTALS: Record<number, number> = {
  1: 5,
  2: 2,
  3: 2,
  4: 2,
  5: 2,
  6: 1,
  7: 1,
  8: 1,
};

export const cardNeedsTarget = (card: number) =>
  card === CARD.GUARD ||
  card === CARD.PRIEST ||
  card === CARD.BARON ||
  card === CARD.KING ||
  card === CARD.PRINCE;

export const cardNeedsGuardGuess = (card: number) => card === CARD.GUARD;
