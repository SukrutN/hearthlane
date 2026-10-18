import { planAgent } from "./astar";
import { findConflicts, makespanOf, pathCost, sumOfCosts } from "./conflicts";
import { buildDiagram, loneCell, type Diagram } from "./mdd";
import { MinHeap } from "./heap";
import type { Conflict, ConflictKind, Constraint, Coord, EdgeConflict, Problem } from "./types";

export type SolveMode = "cbs" | "icbs";

export type ResolvedConflict = {
  conflict: Conflict;
  kind: ConflictKind | null;
  bypassed: boolean;
};

export type SolveResult = {
  ok: boolean;
  reason: string;
  paths: Coord[][];
  cost: number;
  makespan: number;
  highLevelExpanded: number;
  highLevelGenerated: number;
  lowLevelExpansions: number;
  runtimeMs: number;
  resolved: ResolvedConflict[];
  bypasses: number;
};

type Node = {
  id: number;
  constraints: Constraint[];
  paths: Coord[][];
  cost: number;
};

const HIGH_LEVEL_CAP = 5000;
const BYPASS_GUARD = 64;

/**
 * Conflict-Based Search (Sharon, Stern, Felner, Sturtevant) and
 * Improved CBS (Boyarski et al.).
 *
 * The high level is a best-first constraint tree ordered by the sum of
 * individual arrival times. The low level is space-time A*. A leaf with no
 * vertex or edge conflict is an optimal joint plan.
 *
 * ICBS adds two published improvements and nothing else:
 * conflicts are labeled cardinal, semi-cardinal, or non-cardinal from each
 * agent's optimal-path diagram, cardinal conflicts are split first, and a
 * same-cost replanned route that reduces the conflict count is adopted in
 * place (a bypass) instead of growing the tree.
 */
export function solve(problem: Problem, mode: SolveMode): SolveResult {
  const started = now();
  const stats = {
    highLevelExpanded: 0,
    highLevelGenerated: 0,
    lowLevelExpansions: 0,
    bypasses: 0,
    resolved: [] as ResolvedConflict[],
  };

  const rootPaths: Coord[][] = [];
  for (let agent = 0; agent < problem.agents.length; agent += 1) {
    const planned = planAgent(
      problem.grid,
      problem.agents[agent].start,
      problem.agents[agent].goal,
      agent,
      [],
    );
    if (!planned) {
      return finish(stats, started, [], false, `${problem.agents[agent].name} has no route around the walls.`);
    }
    stats.lowLevelExpansions += planned.expansions;
    rootPaths.push(planned.path);
  }

  let nextId = 1;
  const root: Node = {
    id: nextId++,
    constraints: [],
    paths: rootPaths,
    cost: sumOfCosts(rootPaths),
  };
  stats.highLevelGenerated = 1;

  const open = new MinHeap<Node>((a, b) => (a.cost === b.cost ? a.id < b.id : a.cost < b.cost));
  open.push(root);

  while (open.size > 0) {
    if (stats.highLevelExpanded >= HIGH_LEVEL_CAP) {
      return finish(stats, started, [], false, "The constraint tree passed the demo limit before a plan appeared.");
    }

    const node = open.pop();
    if (!node) break;
    stats.highLevelExpanded += 1;

    let bypassesHere = 0;
    let settled = false;
    while (!settled) {
      const conflicts = findConflicts(node.paths);
      if (conflicts.length === 0) {
        return finish(stats, started, node.paths, true, "Collision-free joint plan.");
      }

      const choice =
        mode === "icbs"
          ? preferCardinal(problem, node, conflicts)
          : { conflict: conflicts[0], kind: null as ConflictKind | null, must: [false, false] as [boolean, boolean] };

      if (mode === "icbs" && choice.kind !== "cardinal" && bypassesHere < BYPASS_GUARD) {
        const adopted = tryBypass(problem, node, choice.conflict, choice.must, stats);
        if (adopted) {
          bypassesHere += 1;
          stats.bypasses += 1;
          stats.resolved.push({ conflict: choice.conflict, kind: choice.kind, bypassed: true });
          continue;
        }
      }

      stats.resolved.push({ conflict: choice.conflict, kind: choice.kind, bypassed: false });
      const branches = branchConstraints(choice.conflict);
      for (const constraint of branches) {
        const childPaths = node.paths.slice();
        const planned = planAgent(
          problem.grid,
          problem.agents[constraint.agent].start,
          problem.agents[constraint.agent].goal,
          constraint.agent,
          [...node.constraints, constraint],
        );
        stats.lowLevelExpansions += planned?.expansions ?? 0;
        if (!planned) continue;
        childPaths[constraint.agent] = planned.path;
        const child: Node = {
          id: nextId++,
          constraints: [...node.constraints, constraint],
          paths: childPaths,
          cost: sumOfCosts(childPaths),
        };
        open.push(child);
        stats.highLevelGenerated += 1;
      }
      settled = true;
    }
  }

  return finish(stats, started, [], false, "No collision-free plan exists under these starts and goals.");
}

function preferCardinal(
  problem: Problem,
  node: Node,
  conflicts: Conflict[],
): { conflict: Conflict; kind: ConflictKind; must: [boolean, boolean] } {
  const diagrams = new Map<number, Diagram>();
  const diagramFor = (agent: number): Diagram => {
    const cached = diagrams.get(agent);
    if (cached) return cached;
    const built = buildDiagram(
      problem.grid,
      problem.agents[agent].start,
      problem.agents[agent].goal,
      agent,
      node.constraints,
      pathCost(node.paths[agent]),
    );
    diagrams.set(agent, built);
    return built;
  };

  let best: { conflict: Conflict; kind: ConflictKind; must: [boolean, boolean]; rank: number } | null = null;
  for (const conflict of conflicts) {
    const mustA = forced(node.paths[conflict.a], diagramFor(conflict.a), conflict, "a");
    const mustB = forced(node.paths[conflict.b], diagramFor(conflict.b), conflict, "b");
    const kind: ConflictKind =
      mustA && mustB ? "cardinal" : mustA || mustB ? "semi-cardinal" : "non-cardinal";
    const rank = kind === "cardinal" ? 0 : kind === "semi-cardinal" ? 1 : 2;
    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && conflictBefore(conflict, best.conflict))
    ) {
      best = { conflict, kind, must: [mustA, mustB], rank };
    }
  }
  if (!best) throw new Error("Conflict list was empty.");
  return best;
}

function forced(path: Coord[], diagram: Diagram, conflict: Conflict, side: "a" | "b"): boolean {
  const cost = pathCost(path);
  if (conflict.kind === "vertex") {
    if (conflict.time > cost) {
      const last = path[path.length - 1];
      return last.x === conflict.x && last.y === conflict.y;
    }
    return loneCell(diagram, conflict.time, conflict.x, conflict.y);
  }
  const from = side === "a" ? conflict.aFrom : conflict.bFrom;
  const to = side === "a" ? conflict.aTo : conflict.bTo;
  if (conflict.time >= cost) return false;
  return loneCell(diagram, conflict.time, from.x, from.y) && loneCell(diagram, conflict.time + 1, to.x, to.y);
}

function tryBypass(
  problem: Problem,
  node: Node,
  conflict: Conflict,
  must: [boolean, boolean],
  stats: { lowLevelExpansions: number },
): boolean {
  const order: number[] = [];
  if (!must[0]) order.push(conflict.a);
  if (!must[1]) order.push(conflict.b);
  const before = findConflicts(node.paths).length;

  for (const agent of order) {
    const constraint = constraintFor(conflict, agent);
    const planned = planAgent(
      problem.grid,
      problem.agents[agent].start,
      problem.agents[agent].goal,
      agent,
      [...node.constraints, constraint],
    );
    stats.lowLevelExpansions += planned?.expansions ?? 0;
    if (!planned) continue;
    if (pathCost(planned.path) !== pathCost(node.paths[agent])) continue;
    const trial = node.paths.slice();
    trial[agent] = planned.path;
    if (findConflicts(trial).length < before) {
      node.paths = trial;
      node.cost = sumOfCosts(trial);
      return true;
    }
  }
  return false;
}

function branchConstraints(conflict: Conflict): Constraint[] {
  return [constraintFor(conflict, conflict.a), constraintFor(conflict, conflict.b)];
}

function constraintFor(conflict: Conflict, agent: number): Constraint {
  if (conflict.kind === "vertex") {
    return { kind: "vertex", agent, x: conflict.x, y: conflict.y, time: conflict.time };
  }
  const edge = conflict as EdgeConflict;
  if (agent === edge.a) {
    return {
      kind: "edge",
      agent,
      x1: edge.aFrom.x,
      y1: edge.aFrom.y,
      x2: edge.aTo.x,
      y2: edge.aTo.y,
      time: edge.time,
    };
  }
  return {
    kind: "edge",
    agent,
    x1: edge.bFrom.x,
    y1: edge.bFrom.y,
    x2: edge.bTo.x,
    y2: edge.bTo.y,
    time: edge.time,
  };
}

function conflictBefore(left: Conflict, right: Conflict): boolean {
  if (left.time !== right.time) return left.time < right.time;
  if (left.a !== right.a) return left.a < right.a;
  if (left.b !== right.b) return left.b < right.b;
  if (left.kind !== right.kind) return left.kind === "vertex";
  return false;
}

function finish(
  stats: {
    highLevelExpanded: number;
    highLevelGenerated: number;
    lowLevelExpansions: number;
    bypasses: number;
    resolved: ResolvedConflict[];
  },
  started: number,
  paths: Coord[][],
  ok: boolean,
  reason: string,
): SolveResult {
  return {
    ok,
    reason,
    paths,
    cost: ok ? sumOfCosts(paths) : 0,
    makespan: ok ? makespanOf(paths) : 0,
    highLevelExpanded: stats.highLevelExpanded,
    highLevelGenerated: stats.highLevelGenerated,
    lowLevelExpansions: stats.lowLevelExpansions,
    runtimeMs: now() - started,
    resolved: stats.resolved,
    bypasses: stats.bypasses,
  };
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function validateProblem(problem: Problem): string | null {
  const { grid, agents } = problem;
  if (agents.length === 0) return "Place at least one traveler.";
  const starts = new Set<string>();
  const goals = new Set<string>();
  for (const agent of agents) {
    for (const cell of [agent.start, agent.goal]) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= grid.width || cell.y >= grid.height) {
        return `${agent.name} sits outside the floor.`;
      }
      if (grid.blocked[cell.y * grid.width + cell.x]) {
        return `${agent.name} is standing on a wall.`;
      }
    }
    const startKey = `${agent.start.x},${agent.start.y}`;
    const goalKey = `${agent.goal.x},${agent.goal.y}`;
    if (starts.has(startKey)) return "Two travelers share a start.";
    if (goals.has(goalKey)) return "Two travelers share a goal, so neither can stay.";
    starts.add(startKey);
    goals.add(goalKey);
  }
  return null;
}
