/**
 * The Ferro & Lume casting hall — a TypeScript port of the planner's canonical
 * fixture, `hearthline-plan/fixtures/casting-hall.json`. The site never invents
 * a figure: everything it renders is either this document or a locked engine
 * reading in `figures.ts`.
 */

export type Klass = "express" | "standard" | "bulk"

export type FloorTask = {
  id: string
  amr: string
  klass: Klass
  start: [number, number]
  goal: [number, number]
  due: number
}

export type CorridorRun =
  | { region: string; row: number; from: number; to: number }
  | { region: string; col: number; from: number; to: number }

export type WindowAsk = {
  id: string
  amr: string
  klass: Klass
  origin: [number, number]
  destination: [number, number]
  earliest: number
  latest: number
}

export type FloorDocument = {
  floor: {
    id: string
    name: string
    width: number
    height: number
    runs: CorridorRun[]
  }
  tasks: FloorTask[]
  horizon: number
  seed: number
  windows: WindowAsk[]
}

export const CASTING_HALL: FloorDocument = {
  floor: {
    id: "casting-hall",
    name: "Ferro & Lume casting hall",
    width: 12,
    height: 9,
    runs: [
      { region: "North Run", row: 0, from: 0, to: 11 },
      { region: "Main Run", row: 3, from: 0, to: 11 },
      { region: "South Run", row: 6, from: 0, to: 11 },
      { region: "Dispatch Apron", row: 8, from: 0, to: 11 },
      { region: "West Aisle", col: 0, from: 1, to: 7 },
      { region: "Aisle Two", col: 3, from: 1, to: 7 },
      { region: "Aisle Three", col: 6, from: 1, to: 7 },
      { region: "Aisle Four", col: 9, from: 1, to: 7 },
    ],
  },
  tasks: [
    { id: "T-01", amr: "Ember", klass: "express", start: [8, 0], goal: [0, 11], due: 22 },
    { id: "T-02", amr: "Brann", klass: "standard", start: [0, 0], goal: [8, 11], due: 25 },
    { id: "T-03", amr: "Tinder", klass: "standard", start: [3, 5], goal: [3, 0], due: 9 },
    { id: "T-04", amr: "Soot", klass: "bulk", start: [6, 9], goal: [6, 0], due: 14 },
    { id: "T-05", amr: "Cinder", klass: "express", start: [0, 3], goal: [8, 3], due: 11 },
    { id: "T-06", amr: "Slag", klass: "bulk", start: [8, 6], goal: [0, 6], due: 15 },
  ],
  horizon: 30,
  seed: 2027,
  windows: [
    { id: "W-1", amr: "Kiln", klass: "express", origin: [8, 9], destination: [0, 9], earliest: 0, latest: 25 },
    { id: "W-2", amr: "Ash", klass: "standard", origin: [3, 7], destination: [3, 10], earliest: 4, latest: 20 },
  ],
}

/**
 * Paint the floor the way the planner does: first paint wins, corridors before
 * aisles (the run order above). A cell is open iff some run paints it.
 */
export function paintFloor(document: FloorDocument): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: document.floor.height }, () =>
    Array.from({ length: document.floor.width }, () => null),
  )
  for (const run of document.floor.runs) {
    if ("row" in run) {
      for (let col = run.from; col <= run.to; col++) {
        if (grid[run.row][col] === null) grid[run.row][col] = run.region
      }
    } else {
      for (let row = run.from; row <= run.to; row++) {
        if (grid[row][run.col] === null) grid[row][run.col] = run.region
      }
    }
  }
  return grid
}

/** Open-cell count of the painted floor (the planner validates the same figure). */
export function openCells(grid: (string | null)[][]): number {
  let count = 0
  for (const rowCells of grid) {
    for (const cell of rowCells) {
      if (cell !== null) count++
    }
  }
  return count
}

/** The region painted at a cell, or the empty string for rack. */
export function regionAt(grid: (string | null)[][], row: number, col: number): string {
  return grid[row][col] ?? ""
}
