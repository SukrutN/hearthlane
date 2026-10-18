import type { Coord } from "./types";

/** 4-connected moves plus wait. East and west are generated before north and south so ties are stable. */
export const STEPS: readonly Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 0, y: 0 },
];

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function sameCell(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
