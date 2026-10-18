import { sameCell } from "./steps";
import type { Conflict, Coord } from "./types";

export function positionAt(path: Coord[], time: number): Coord {
  if (path.length === 0) {
    throw new Error("A path must include its start cell.");
  }
  return time < path.length ? path[time] : path[path.length - 1];
}

export function pathCost(path: Coord[]): number {
  return path.length - 1;
}

export function sumOfCosts(paths: Coord[][]): number {
  return paths.reduce((total, path) => total + pathCost(path), 0);
}

export function makespanOf(paths: Coord[][]): number {
  return paths.reduce((span, path) => Math.max(span, pathCost(path)), 0);
}

/**
 * Vertex conflicts: two agents on one cell at one time.
 * Edge conflicts: two agents traverse the same corridor in opposite directions
 * between time t and t+1 (a swap). Following traffic is not a conflict.
 * After a path ends, the agent stays on its last cell.
 */
export function findConflicts(paths: Coord[][]): Conflict[] {
  const found: Conflict[] = [];
  const count = paths.length;
  if (count === 0) return found;
  const horizon = makespanOf(paths);

  for (let time = 0; time <= horizon; time += 1) {
    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        const here = positionAt(paths[a], time);
        const there = positionAt(paths[b], time);
        if (sameCell(here, there)) {
          found.push({ kind: "vertex", a, b, x: here.x, y: here.y, time });
        }
      }
    }
  }

  for (let time = 0; time < horizon; time += 1) {
    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        const aFrom = positionAt(paths[a], time);
        const bFrom = positionAt(paths[b], time);
        const aTo = positionAt(paths[a], time + 1);
        const bTo = positionAt(paths[b], time + 1);
        const swapped = sameCell(aFrom, bTo) && sameCell(bFrom, aTo);
        const actuallyMoved = !sameCell(aFrom, aTo);
        if (swapped && actuallyMoved) {
          found.push({
            kind: "edge",
            a,
            b,
            time,
            aFrom,
            aTo,
            bFrom,
            bTo,
          });
        }
      }
    }
  }

  return found;
}

export function conflictLabel(conflict: Conflict, names: string[]): string {
  const left = names[conflict.a] ?? `Agent ${conflict.a + 1}`;
  const right = names[conflict.b] ?? `Agent ${conflict.b + 1}`;
  if (conflict.kind === "vertex") {
    return `${left} and ${right} both claim (${conflict.x}, ${conflict.y}) at minute ${conflict.time}`;
  }
  return `${left} and ${right} swap through each other at minute ${conflict.time}`;
}
