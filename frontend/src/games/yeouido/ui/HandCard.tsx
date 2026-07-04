"use client";

import { cardArt, cardView } from "../model/cards";

type Props = {
  cardId: string;
  playable: boolean;
  selected: boolean;
  onClick: () => void;
  /** Compact frame (deck preview in lobby). */
  small?: boolean;
  /** Hover in/out — drives the fixed preview bar above the hand. */
  onHover?: (cardId: string | null) => void;
};

export const HandCard = ({ cardId, playable, selected, onClick, small, onHover }: Props) => {
  const view = cardView(cardId);
  const classes = [
    "yd-card",
    small ? "yd-card--small" : "",
    playable ? "yd-card--playable" : "",
    selected ? "yd-card--selected" : "",
    view.faction ? `yd-card--${view.faction}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      onClick={onClick}
      title={view.name}
      onMouseEnter={onHover ? () => onHover(cardId) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      <span className="yd-card-cost">{view.cost}</span>
      <div className="yd-card-art" style={{ backgroundImage: `url(${cardArt(cardId)})` }} />
      <div className="yd-card-name">{view.name}</div>
      {!small && (
        <div className="yd-card-body">
          {view.text && <div className="yd-card-text">{view.text}</div>}
          {!view.text && view.flavor && (
            <div className="yd-card-text yd-card-flavor">{view.flavor}</div>
          )}
        </div>
      )}
      {view.type === "unit" && (
        <>
          <span className="yd-stat yd-stat--atk">{view.atk}</span>
          <span className="yd-stat yd-stat--hp">{view.hp}</span>
        </>
      )}
    </button>
  );
};
