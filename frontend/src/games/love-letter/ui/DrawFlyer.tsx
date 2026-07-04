"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_KEY } from "../model/cards";

export type Flight = {
  card: number;
  /** Center points relative to the table wrap. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  w: number;
  h: number;
};

type Props = {
  flight: Flight;
  onDone: () => void;
};

/** A card that flies from the deck into the hand, flipping face-up mid-air. */
export const DrawFlyer = ({ flight, onDone }: Props) => {
  const [go, setGo] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setGo(false);
    // Double-rAF so the initial position paints before the transition starts.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGo(true));
    });
    const fallback = setTimeout(() => doneRef.current(), 950);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(fallback);
    };
  }, [flight]);

  const dx = flight.to.x - flight.from.x;
  const dy = flight.to.y - flight.from.y;
  const face = CARD_KEY[flight.card] || "back";

  return (
    <div
      className="ll-draw-fly"
      style={{
        left: flight.from.x - flight.w / 2,
        top: flight.from.y - flight.h / 2,
        width: flight.w,
        height: flight.h,
        transform: go ? `translate(${dx}px, ${dy}px)` : "translate(0px, 0px)",
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName === "transform" && e.target === e.currentTarget) {
          doneRef.current();
        }
      }}
    >
      <div className={`ll-flip${go ? " ll-flip--flipped" : ""}`}>
        <div
          className="ll-flip-face"
          style={{ backgroundImage: "url(/cards/back.png)" }}
        />
        <div
          className="ll-flip-face ll-flip-face--front"
          style={{ backgroundImage: `url(/cards/${face}.png)` }}
        />
      </div>
    </div>
  );
};
