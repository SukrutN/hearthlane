import { describe, expect, it } from "vitest";
import { findConflicts } from "../lib/conflicts";
import { scenarios } from "../lib/scenarios";
import { solve } from "../lib/search";
import type { Coord, Problem } from "../lib/types";

function problemOf(id: string): Problem {
  const scenario = scenarios.find((item) => item.id === id);
  if (!scenario) throw new Error(`Missing scenario ${id}`);
  return { grid: scenario.grid, agents: scenario.agents };
}

describe("conflict detection", () => {
  it("flags a shared vertex and ignores the same cell at another minute", () => {
    const calm: Coord[][] = [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      [
        { x: 0, y: 1 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ],
    ];
    expect(findConflicts(calm)).toEqual([]);

    const crowded: Coord[][] = [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ],
    ];
    const hits = findConflicts(crowded);
    expect(hits.some((hit) => hit.kind === "vertex" && hit.time === 1 && hit.x === 1 && hit.y === 0)).toBe(true);
  });

  it("flags an edge swap and allows one agent to follow another", () => {
    const swap: Coord[][] = [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
    ];
    const edgeHits = findConflicts(swap).filter((hit) => hit.kind === "edge");
    expect(edgeHits).toHaveLength(1);
    expect(edgeHits[0]).toMatchObject({ time: 0, a: 0, b: 1 });

    const follow: Coord[][] = [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    ];
    expect(findConflicts(follow).some((hit) => hit.kind === "edge")).toBe(false);
  });

  it("keeps a finished agent on the goal so a late visitor still collides", () => {
    const sitting: Coord[][] = [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 2, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0 },
      ],
    ];
    const hits = findConflicts(sitting);
    expect(hits.some((hit) => hit.kind === "vertex" && hit.time === 2 && hit.x === 1 && hit.y === 0)).toBe(true);
  });
});

describe("optimal joint plan", () => {
  it("finds the cost-6 exchange and keeps both solvers collision-free", () => {
    // Manhattan sum is 4, but the only length-2 routes collide, and every
    // length-3 route still swaps or shares a cell. Six is the optimum.
    const problem = problemOf("exchange");
    const cbs = solve(problem, "cbs");
    const icbs = solve(problem, "icbs");
    expect(cbs.ok).toBe(true);
    expect(icbs.ok).toBe(true);
    expect(cbs.cost).toBe(6);
    expect(icbs.cost).toBe(6);
    expect(findConflicts(cbs.paths)).toEqual([]);
    expect(findConflicts(icbs.paths)).toEqual([]);
  });
});

describe("ICBS cardinal priority", () => {
  it("expands fewer high-level nodes than CBS when a cardinal cross sits beside a weave", () => {
    const problem = problemOf("crosscurrent");
    const cbs = solve(problem, "cbs");
    const icbs = solve(problem, "icbs");

    expect(cbs.ok).toBe(true);
    expect(icbs.ok).toBe(true);
    expect(findConflicts(cbs.paths)).toEqual([]);
    expect(findConflicts(icbs.paths)).toEqual([]);
    expect(cbs.cost).toBe(icbs.cost);
    expect(icbs.highLevelExpanded).toBeLessThan(cbs.highLevelExpanded);

    const firstSplit = icbs.resolved.find((item) => !item.bypassed);
    expect(firstSplit?.kind).toBe("cardinal");
    expect(firstSplit?.conflict.kind).toBe("vertex");
  });
});

describe("built-in rooms", () => {
  it("returns matching optimal costs from both searches", () => {
    for (const scenario of scenarios) {
      const problem = { grid: scenario.grid, agents: scenario.agents };
      const cbs = solve(problem, "cbs");
      const icbs = solve(problem, "icbs");
      expect(cbs.ok, scenario.id).toBe(true);
      expect(icbs.ok, scenario.id).toBe(true);
      expect(icbs.cost, scenario.id).toBe(cbs.cost);
      expect(findConflicts(cbs.paths), scenario.id).toEqual([]);
      expect(findConflicts(icbs.paths), scenario.id).toEqual([]);
    }
  });
});
