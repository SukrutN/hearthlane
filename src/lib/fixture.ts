/**
 * The Ferro & Lume casting hall, read from the planner's canonical fixture,
 * `engine/fixtures/casting-hall.json`, instead of a transcription. The site
 * never invents a figure: everything it renders is either this document or a
 * locked engine reading in `figures.ts`.
 */
import castingHallJson from "../../engine/fixtures/casting-hall.json"

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

/**
 * The planner's published document, exactly as the engine reads it. The one
 * assertion narrows the JSON import's widened strings and arrays back to the
 * document types; every field the engine's strict parse rejects is rejected
 * there first.
 */
export const CASTING_HALL = castingHallJson as FloorDocument

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
