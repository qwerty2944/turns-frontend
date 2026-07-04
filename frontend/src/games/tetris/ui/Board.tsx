"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  BOARD_H,
  BOARD_W,
  PIECE_COLOR,
  occupiedCells,
} from "../model/pieces";
import type { PlayerBoardSnap } from "../model/types";

export type BoardHandle = {
  /** Bounding rect of the board canvas in CSS px, useful for Phaser anchors. */
  getRect: () => DOMRect | null;
};

type Props = {
  board: PlayerBoardSnap;
  /** CSS pixel size of each cell. Auto-scales to fit container if undefined. */
  cellSize?: number;
  showGhost?: boolean;
  highlightRows?: number[];
};

// Canvas-rendered playfield. Re-draws on every prop change. Container fits
// 10:20 aspect with cellSize derived from layout width unless explicit.
export const Board = forwardRef<BoardHandle, Props>(function Board(
  { board, cellSize, showGhost = true, highlightRows = [] },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ cell: 0, w: 0, h: 0 });

  useImperativeHandle(ref, () => ({
    getRect: () => canvasRef.current?.getBoundingClientRect() ?? null,
  }));

  // Size the canvas to fit the wrapper while preserving 10:20 aspect.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const fit = () => {
      const explicit = cellSize ?? 0;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      let cell = explicit;
      if (!cell) {
        const aw = wrap.clientWidth;
        const ah = wrap.clientHeight;
        const cellByW = Math.floor(aw / BOARD_W);
        const cellByH = Math.floor(ah / BOARD_H);
        cell = Math.max(8, Math.min(cellByW, cellByH || cellByW));
      }
      const pxW = cell * BOARD_W;
      const pxH = cell * BOARD_H;
      canvas.style.width = `${pxW}px`;
      canvas.style.height = `${pxH}px`;
      canvas.width = Math.floor(pxW * dpr);
      canvas.height = Math.floor(pxH * dpr);
      sizeRef.current = { cell, w: pxW, h: pxH };
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellSize]);

  // Redraw on state changes.
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, highlightRows.join(","), showGhost]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { cell, w, h } = sizeRef.current;
    if (!cell) return;

    // Background — vertical gradient + subtle grid + vignette.
    ctx.clearRect(0, 0, w, h);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "rgba(10,6,28,0.95)");
    bgGrad.addColorStop(0.6, "rgba(8,5,22,0.92)");
    bgGrad.addColorStop(1, "rgba(16,10,38,0.95)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 1; x < BOARD_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, h);
      ctx.stroke();
    }
    for (let y = 1; y < BOARD_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(w, y * cell);
      ctx.stroke();
    }

    // Danger tint: red gradient at the top when the stack climbs high.
    let stackTop = BOARD_H;
    outer: for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        if (board.cells[y * BOARD_W + x]) {
          stackTop = y;
          break outer;
        }
      }
    }
    if (stackTop <= 6) {
      const danger = Math.min(1, (7 - stackTop) / 6);
      const dGrad = ctx.createLinearGradient(0, 0, 0, cell * 5);
      dGrad.addColorStop(0, `rgba(239,68,68,${0.28 * danger})`);
      dGrad.addColorStop(1, "rgba(239,68,68,0)");
      ctx.fillStyle = dGrad;
      ctx.fillRect(0, 0, w, cell * 5);
    }

    // Stack cells.
    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        const v = board.cells[y * BOARD_W + x];
        if (!v) continue;
        drawCell(ctx, x, y, cell, PIECE_COLOR[v] ?? "#888");
      }
    }

    // Highlight rows that just cleared (flash overlay handled by Phaser; here
    // we just draw a soft pulse so the row reads as "popping" pre-removal).
    if (highlightRows.length) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      for (const y of highlightRows) {
        ctx.fillRect(0, y * cell, w, cell);
      }
    }

    // Ghost piece (projected drop).
    const cur = board.cur;
    if (showGhost && cur?.type) {
      let gy = cur.y;
      while (canPlaceLocal(board.cells, cur.type, cur.rot, cur.x, gy + 1)) {
        gy += 1;
      }
      for (const [cx, cy] of occupiedCells(cur.type, cur.rot, cur.x, gy)) {
        if (cy < 0 || cy >= BOARD_H || cx < 0 || cx >= BOARD_W) continue;
        drawGhost(ctx, cx, cy, cell, PIECE_COLOR[cur.type] ?? "#fff");
      }
    }

    // Active piece — with a soft neon glow so it pops against the stack.
    if (cur?.type) {
      const color = PIECE_COLOR[cur.type] ?? "#fff";
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.max(6, cell * 0.55);
      for (const [cx, cy] of occupiedCells(cur.type, cur.rot, cur.x, cur.y)) {
        if (cy < 0 || cy >= BOARD_H || cx < 0 || cx >= BOARD_W) continue;
        drawCell(ctx, cx, cy, cell, color);
      }
      ctx.restore();
    }
  };

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: "pixelated",
          borderRadius: 4,
          boxShadow: "0 0 0 2px var(--panel-border, rgba(255,255,255,0.15))",
        }}
      />
    </div>
  );
});

export default Board;

// ───────── helpers ───────── //

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const px = x * size;
  const py = y * size;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  // Inner highlight — top/left lighter, bottom/right darker for chunky pixel feel.
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(px + 1, py + 1, size - 2, Math.max(1, Math.floor(size * 0.18)));
  ctx.fillRect(px + 1, py + 1, Math.max(1, Math.floor(size * 0.18)), size - 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(
    px + size - 1 - Math.max(1, Math.floor(size * 0.18)),
    py + 1,
    Math.max(1, Math.floor(size * 0.18)),
    size - 2,
  );
  ctx.fillRect(
    px + 1,
    py + size - 1 - Math.max(1, Math.floor(size * 0.18)),
    size - 2,
    Math.max(1, Math.floor(size * 0.18)),
  );
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const px = x * size;
  const py = y * size;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
  ctx.restore();
}

function canPlaceLocal(
  cells: number[],
  type: number,
  rot: number,
  x: number,
  y: number,
): boolean {
  for (const [cx, cy] of occupiedCells(type, rot, x, y)) {
    if (cx < 0 || cx >= BOARD_W) return false;
    if (cy >= BOARD_H) return false;
    if (cy < 0) continue;
    if (cells[cy * BOARD_W + cx]) return false;
  }
  return true;
}
