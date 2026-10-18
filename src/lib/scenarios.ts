import type { Agent, Coord, Grid } from "./types";

export type Scenario = {
  id: string;
  name: string;
  kicker: string;
  blurb: string;
  grid: Grid;
  agents: Agent[];
};

function floor(width: number, height: number, walls: Coord[] = []): Grid {
  const blocked = Array.from({ length: width * height }, () => false);
  for (const wall of walls) blocked[wall.y * width + wall.x] = true;
  return { width, height, blocked };
}

export const scenarios: Scenario[] = [
  {
    id: "crosscurrent",
    name: "Crosscurrent",
    kicker: "Cardinal first",
    blurb:
      "Ada and Bo can weave around each other at no extra cost. Cal and Dee must cross one shared square, and every shortest route uses it. ICBS splits that cardinal clash before it bothers with the weave.",
    grid: floor(10, 5),
    agents: [
      { name: "Ada", start: { x: 6, y: 4 }, goal: { x: 8, y: 3 } },
      { name: "Bo", start: { x: 8, y: 4 }, goal: { x: 6, y: 3 } },
      { name: "Cal", start: { x: 1, y: 2 }, goal: { x: 3, y: 2 } },
      { name: "Dee", start: { x: 2, y: 1 }, goal: { x: 2, y: 3 } },
    ],
  },
  {
    id: "exchange",
    name: "Exchange",
    kicker: "A small optimum",
    blurb:
      "Two people and a row above them. The straight swap collides, and a single extra wait still trades places through the same edge. The joint plan takes the long way over the top.",
    grid: floor(3, 2),
    agents: [
      { name: "Ada", start: { x: 0, y: 1 }, goal: { x: 2, y: 1 } },
      { name: "Bo", start: { x: 2, y: 1 }, goal: { x: 0, y: 1 } },
    ],
  },
  {
    id: "pocket",
    name: "Pocket",
    kicker: "A shelf to slip past",
    blurb:
      "Ivo and Jun walk toward each other through a room with two shelves. Waiting in the gap, or stepping into the open row, is how a head-on meeting becomes a plan.",
    grid: floor(9, 5, [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 5, y: 1 },
      { x: 6, y: 1 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 5, y: 3 },
      { x: 6, y: 3 },
    ]),
    agents: [
      { name: "Ivo", start: { x: 0, y: 2 }, goal: { x: 8, y: 2 } },
      { name: "Jun", start: { x: 8, y: 2 }, goal: { x: 0, y: 2 } },
    ],
  },
  {
    id: "atrium",
    name: "Atrium",
    kicker: "Three across a column",
    blurb:
      "A broken column splits the room. Three travelers still have to arrive, and the search is allowed to wait — never to cut a corner.",
    grid: floor(7, 7, [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 4 },
      { x: 3, y: 5 },
    ]),
    agents: [
      { name: "Ada", start: { x: 0, y: 0 }, goal: { x: 6, y: 6 } },
      { name: "Bo", start: { x: 6, y: 0 }, goal: { x: 0, y: 6 } },
      { name: "Cal", start: { x: 0, y: 3 }, goal: { x: 6, y: 3 } },
    ],
  },
  {
    id: "blank",
    name: "Blank floor",
    kicker: "Paint your own",
    blurb:
      "An empty eight-by-eight. Add walls, move the starts, and send both searches across whatever room you leave them.",
    grid: floor(8, 8),
    agents: [
      { name: "Ada", start: { x: 1, y: 1 }, goal: { x: 6, y: 6 } },
      { name: "Bo", start: { x: 6, y: 1 }, goal: { x: 1, y: 6 } },
    ],
  },
];

export function cloneScenario(scenario: Scenario): { grid: Grid; agents: Agent[] } {
  return {
    grid: {
      width: scenario.grid.width,
      height: scenario.grid.height,
      blocked: scenario.grid.blocked.slice(),
    },
    agents: scenario.agents.map((agent) => ({
      name: agent.name,
      start: { ...agent.start },
      goal: { ...agent.goal },
    })),
  };
}
