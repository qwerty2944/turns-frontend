import { CARD, cardNeedsGuardGuess, cardNeedsTarget } from "./cards";

/**
 * In-table targeting state machine.
 *
 * idle    — nothing selected
 * confirm — a card is raised waiting for a second tap (no-target cards, or
 *           target cards when nobody is targetable → discard with no effect)
 * target  — a target card is raised; valid seats are clickable
 * guess   — Guard only: target picked, waiting for the guessed-card strip
 */
export type TargetingState =
  | { mode: "idle" }
  | { mode: "confirm"; card: number; handIdx: number; noTargets: boolean }
  | { mode: "target"; card: number; handIdx: number }
  | { mode: "guess"; card: number; handIdx: number; targetSid: string };

export type TargetingAction =
  | { type: "pick"; card: number; handIdx: number; validTargetCount: number }
  | { type: "seat"; sid: string }
  | { type: "cancel" };

export const IDLE: TargetingState = { mode: "idle" };

export function targetingReducer(
  state: TargetingState,
  action: TargetingAction,
): TargetingState {
  switch (action.type) {
    case "pick": {
      const { card, handIdx, validTargetCount } = action;
      // Re-tapping the already-raised confirm card is handled by the
      // component (it sends the play); picking any card re-enters fresh.
      if (!cardNeedsTarget(card)) {
        return { mode: "confirm", card, handIdx, noTargets: false };
      }
      if (validTargetCount === 0) {
        return { mode: "confirm", card, handIdx, noTargets: true };
      }
      return { mode: "target", card, handIdx };
    }
    case "seat": {
      if (state.mode !== "target") return state;
      if (cardNeedsGuardGuess(state.card)) {
        return {
          mode: "guess",
          card: state.card,
          handIdx: state.handIdx,
          targetSid: action.sid,
        };
      }
      // Non-guard target cards are sent by the component, which resets.
      return state;
    }
    case "cancel":
      return IDLE;
  }
}

export type SeatLike = {
  sessionId: string;
  eliminated: boolean;
  protected: boolean;
};

/** Session ids this card may legally target right now. */
export const validTargetSids = (
  card: number,
  meSid: string,
  seats: SeatLike[],
): string[] =>
  seats
    .filter((s) => {
      if (s.eliminated) return false;
      if (s.sessionId === meSid) return card === CARD.PRINCE;
      return !s.protected;
    })
    .map((s) => s.sessionId);
