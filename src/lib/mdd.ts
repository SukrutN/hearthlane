import { STEPS } from "./steps";
import type { Constraint, Coord, Grid } from "./types";

/**
 * A multi-valued decision diagram for one agent: every optimal path under the
 * current constraints, layered by time. A conflict is cardinal for the agent
 * when the contested cell (or edge) is the only survivor at that layer.
 */
export type Diagram = {
  levels: Map<number, Set<string>>;
};

export function buildDiagram(
  grid: Grid,
  start: Coord,
  goal: Coord,
  agent: number,
  constraints: Constraint[],
  cost: number,
): Diagram {
  const levels = new Map<number, Set<string>>();
  const forward: Array<Set<string>> = [];
  forward[0] = new Set([key(start.x, start.y)]);

  const vertexBan = new Set<string>();
  const edgeBan = new Set<string>();
  for (const constraint of constraints) {
    if (constraint.agent !== agent) continue;
    if (constraint.kind === "vertex") {
      vertexBan.add(`${constraint.x},${constraint.y},${constraint.time}`);
    } else {
      edgeBan.add(
        `${constraint.x1},${constraint.y1},${constraint.x2},${constraint.y2},${constraint.time}`,
      );
    }
  }

  for (let time = 0; time < cost; time += 1) {
    const next = new Set<string>();
    for (const token of forward[time]) {
      const [x, y] = fromKey(token);
      for (const step of STEPS) {
        const nx = x + step.x;
        const ny = y + step.y;
        const nt = time + 1;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        if (grid.blocked[ny * grid.width + nx]) continue;
        if (vertexBan.has(`${nx},${ny},${nt}`)) continue;
        if (edgeBan.has(`${x},${y},${nx},${ny},${time}`)) continue;
        const remain = Math.abs(nx - goal.x) + Math.abs(ny - goal.y);
        if (nt + remain > cost) continue;
        next.add(key(nx, ny));
      }
    }
    forward[time + 1] = next;
  }

  const goalToken = key(goal.x, goal.y);
  const keep: Array<Set<string>> = Array.from({ length: cost + 1 }, () => new Set<string>());
  if (forward[cost]?.has(goalToken)) {
    keep[cost].add(goalToken);
    for (let time = cost - 1; time >= 0; time -= 1) {
      for (const token of forward[time]) {
        const [x, y] = fromKey(token);
        for (const step of STEPS) {
          const nx = x + step.x;
          const ny = y + step.y;
          if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
          if (grid.blocked[ny * grid.width + nx]) continue;
          if (vertexBan.has(`${nx},${ny},${time + 1}`)) continue;
          if (edgeBan.has(`${x},${y},${nx},${ny},${time}`)) continue;
          if (!keep[time + 1].has(key(nx, ny))) continue;
          keep[time].add(token);
          break;
        }
      }
    }
  }

  for (let time = 0; time <= cost; time += 1) levels.set(time, keep[time]);
  return { levels };
}

export function loneCell(diagram: Diagram, time: number, x: number, y: number): boolean {
  const level = diagram.levels.get(time);
  if (!level || level.size !== 1) return false;
  return level.has(key(x, y));
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function fromKey(token: string): [number, number] {
  const [x, y] = token.split(",").map(Number);
  return [x, y];
}
