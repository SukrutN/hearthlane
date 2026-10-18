import { MinHeap } from "./heap";
import { cellKey, manhattan, STEPS } from "./steps";
import type { Constraint, Coord, Grid } from "./types";

export type Plan = {
  path: Coord[];
  expansions: number;
};

type SearchNode = {
  x: number;
  y: number;
  t: number;
  g: number;
  f: number;
  h: number;
  seq: number;
  parent: string | null;
  key: string;
};

/**
 * Space-time A* on a 4-connected grid with unit costs and waits.
 * A state is a cell plus a time. The agent may finish only when it can remain
 * on the goal for every later minute — constraints name specific times, so
 * any forbidden minute on the goal at or after arrival rules that arrival out.
 */
export function planAgent(
  grid: Grid,
  start: Coord,
  goal: Coord,
  agent: number,
  constraints: Constraint[],
): Plan | null {
  const { width, height, blocked } = grid;
  if (!inside(grid, start) || !inside(grid, goal)) return null;
  if (blocked[start.y * width + start.x] || blocked[goal.y * width + goal.x]) return null;

  const vertexBan = new Set<string>();
  const edgeBan = new Set<string>();
  const goalBan = new Set<number>();
  let latest = -1;

  for (const constraint of constraints) {
    if (constraint.agent !== agent) continue;
    if (constraint.kind === "vertex") {
      vertexBan.add(`${constraint.x},${constraint.y},${constraint.time}`);
      latest = Math.max(latest, constraint.time);
      if (constraint.x === goal.x && constraint.y === goal.y) goalBan.add(constraint.time);
    } else {
      edgeBan.add(
        `${constraint.x1},${constraint.y1},${constraint.x2},${constraint.y2},${constraint.time}`,
      );
      latest = Math.max(latest, constraint.time);
    }
  }

  const seed = manhattan(start, goal);
  const span = width * height + seed;
  const maxTime = Math.max(seed, latest + 1) + span;
  const canStay = (time: number): boolean => {
    for (const banned of goalBan) {
      if (banned >= time) return false;
    }
    return true;
  };

  const heap = new MinHeap<SearchNode>((a, b) =>
    a.f === b.f ? (a.h === b.h ? a.seq < b.seq : a.h < b.h) : a.f < b.f,
  );
  const bestG = new Map<string, number>();
  const trail = new Map<string, SearchNode>();
  let seq = 0;

  const originKey = `${start.x},${start.y},0`;
  const origin: SearchNode = {
    x: start.x,
    y: start.y,
    t: 0,
    g: 0,
    h: seed,
    f: seed,
    seq: seq++,
    parent: null,
    key: originKey,
  };
  heap.push(origin);
  bestG.set(originKey, 0);
  trail.set(originKey, origin);

  let expansions = 0;
  const expansionCap = (maxTime + 1) * width * height + 8;

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current || current.g !== bestG.get(current.key)) continue;
    expansions += 1;
    if (expansions > expansionCap) return null;

    if (current.x === goal.x && current.y === goal.y && canStay(current.t)) {
      return { path: rebuild(trail, current.key), expansions };
    }
    if (current.t >= maxTime) continue;

    for (const step of STEPS) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      const time = current.t + 1;
      if (!inside(grid, { x, y })) continue;
      if (blocked[y * width + x]) continue;
      if (vertexBan.has(`${x},${y},${time}`)) continue;
      if (edgeBan.has(`${current.x},${current.y},${x},${y},${current.t}`)) continue;

      const key = `${x},${y},${time}`;
      const g = current.g + 1;
      const known = bestG.get(key);
      if (known !== undefined && known <= g) continue;

      const h = manhattan({ x, y }, goal);
      const next: SearchNode = {
        x,
        y,
        t: time,
        g,
        h,
        f: g + h,
        seq: seq++,
        parent: current.key,
        key,
      };
      bestG.set(key, g);
      trail.set(key, next);
      heap.push(next);
    }
  }

  return null;
}

function rebuild(trail: Map<string, SearchNode>, key: string): Coord[] {
  const path: Coord[] = [];
  let cursor: string | null = key;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const node = trail.get(cursor);
    if (!node) break;
    path.push({ x: node.x, y: node.y });
    cursor = node.parent;
  }
  path.reverse();
  return path;
}

function inside(grid: Grid, cell: Coord): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < grid.width && cell.y < grid.height;
}

export function indexOf(grid: Grid, cell: Coord): number {
  return cell.y * grid.width + cell.x;
}

export { cellKey };
