"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  Announcement,
  COMPRESSED_HOLD_MS,
  HOLD_MS,
  LEAVE_MS,
  SLAM_MS,
} from "./announcements";

export type AnnouncementItem = { a: Announcement; id: number };

type QueueState = {
  current: AnnouncementItem | null;
  leaving: boolean;
  queue: AnnouncementItem[];
};

type QueueAction =
  | { type: "enqueue"; item: AnnouncementItem }
  | { type: "leave" }
  | { type: "next" };

const reducer = (state: QueueState, action: QueueAction): QueueState => {
  switch (action.type) {
    case "enqueue":
      if (!state.current) {
        return { ...state, current: action.item, leaving: false };
      }
      return { ...state, queue: [...state.queue, action.item] };
    case "leave":
      if (!state.current || state.leaving) return state;
      return { ...state, leaving: true };
    case "next": {
      const [head, ...rest] = state.queue;
      return { current: head ?? null, leaving: false, queue: rest };
    }
  }
};

/**
 * Auto-advancing announcement queue: enter (slam) → hold → leave (fly out)
 * → next. Hold times compress when a burst of entries backs up.
 */
export const useAnnouncementQueue = () => {
  const [state, dispatch] = useReducer(reducer, {
    current: null,
    leaving: false,
    queue: [],
  });
  const idRef = useRef(0);

  // Stable — safe to hand to once-registered Colyseus onMessage handlers.
  const enqueue = useCallback((a: Announcement) => {
    idRef.current += 1;
    dispatch({ type: "enqueue", item: { a, id: idRef.current } });
  }, []);

  const { current, leaving, queue } = state;

  useEffect(() => {
    if (!current) return;
    const t = leaving
      ? setTimeout(() => dispatch({ type: "next" }), LEAVE_MS)
      : setTimeout(
          () => dispatch({ type: "leave" }),
          SLAM_MS + (queue.length >= 3 ? COMPRESSED_HOLD_MS : HOLD_MS[current.a.type]),
        );
    return () => clearTimeout(t);
  }, [current, leaving, queue.length]);

  return { current, leaving, enqueue };
};
