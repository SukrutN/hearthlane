/**
 * The canonical reading of the Ferro & Lume casting hall, ported verbatim from
 * `hearthline-plan`'s application test (`HearthBehaviorTest`) and its CLI
 * reading. Every number here is asserted by `figures.test.ts`, which is the
 * site's half of the characterization contract: if the engine's figures move,
 * these do not move until the engine test says so.
 */

import type { Klass } from "./fixture"

export type Rung = {
  solver: "CBS" | "ICBS" | "prioritized"
  sum: number | null
  gap: number | null
  expanded: number
  solved: boolean
  reason: string | null
}

export type ArrivalRow = {
  id: string
  amr: string
  klass: Klass
  start: [number, number]
  goal: [number, number]
  due: number
  arrived: number
}

export type DensityRow = {
  region: string
  tickFrom: number
  tickTo: number
  splits: number
  cardinal: number
}

export type RegionRow = {
  region: string
  density: number
  meanRejections: number
}

export type CurveRow = {
  batch: number
  icbsSolved: boolean
  icbsSum: number
  prioritizedServed: number
  hitRate: number
}

export type Grant = {
  amr: string
  depart: number
  arrive: number
  detour: number
  regions: string[]
}

export type JournalRow = {
  id: string
  amr: string
  klass: Klass
  origin: [number, number]
  destination: [number, number]
  earliest: number
  latest: number
  decision: "fire" | "hesitate"
  reasons: string[]
  grant: Grant | null
}

/** The degradation ladder as the engine reports it: honest about the third rung. */
export const LADDER: Rung[] = [
  { solver: "CBS", sum: 69, gap: 0, expanded: 34, solved: true, reason: null },
  { solver: "ICBS", sum: 69, gap: 0, expanded: 23, solved: true, reason: null },
  {
    solver: "prioritized",
    sum: null,
    gap: null,
    expanded: 72,
    solved: false,
    reason: "Tinder cannot reach its goal under the traffic booked ahead of it.",
  },
]

/** Served arrivals against their dues (the ICBS plan the ladder settles on). */
export const ARRIVALS: ArrivalRow[] = [
  { id: "T-01", amr: "Ember", klass: "express", start: [8, 0], goal: [0, 11], due: 22, arrived: 19 },
  { id: "T-02", amr: "Brann", klass: "standard", start: [0, 0], goal: [8, 11], due: 25, arrived: 19 },
  { id: "T-03", amr: "Tinder", klass: "standard", start: [3, 5], goal: [3, 0], due: 9, arrived: 5 },
  { id: "T-04", amr: "Soot", klass: "bulk", start: [6, 9], goal: [6, 0], due: 14, arrived: 9 },
  { id: "T-05", amr: "Cinder", klass: "express", start: [0, 3], goal: [8, 3], due: 11, arrived: 9 },
  { id: "T-06", amr: "Slag", klass: "bulk", start: [8, 6], goal: [0, 6], due: 15, arrived: 8 },
]

export const SERVED_SUM = 69
export const MAKESPAN = 19

/** Cardinal-conflict density: every nonzero region × bucket cell the ICBS tree met. */
export const DENSITY: DensityRow[] = [
  { region: "Aisle Two", tickFrom: 4, tickTo: 7, splits: 4, cardinal: 0 },
  { region: "Dispatch Apron", tickFrom: 8, tickTo: 11, splits: 6, cardinal: 0 },
  { region: "Main Run", tickFrom: 4, tickTo: 7, splits: 3, cardinal: 0 },
  { region: "North Run", tickFrom: 12, tickTo: 15, splits: 1, cardinal: 0 },
  { region: "South Run", tickFrom: 4, tickTo: 7, splits: 8, cardinal: 4 },
  { region: "West Aisle", tickFrom: 4, tickTo: 7, splits: 1, cardinal: 0 },
]

/** Eight seeded shuffles of the manifest order, seeds 2027–2034 (prioritized rung). */
export const REPLICATION_SEEDS = [2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034]
export const CORRELATION = 0.692131007171352
export const REPLICATION_REGIONS: RegionRow[] = [
  { region: "Aisle Two", density: 4, meanRejections: 0.75 },
  { region: "Dispatch Apron", density: 6, meanRejections: 1.375 },
  { region: "Main Run", density: 3, meanRejections: 4.25 },
  { region: "North Run", density: 1, meanRejections: 0.625 },
  { region: "South Run", density: 8, meanRejections: 7.25 },
  { region: "West Aisle", density: 1, meanRejections: 0.625 },
]

/** Deadline-hit-rate curve: ICBS prefixes stay solved; prioritized breaks at batch 3. */
export const CURVE: CurveRow[] = [
  { batch: 1, icbsSolved: true, icbsSum: 19, prioritizedServed: 1, hitRate: 1.0 },
  { batch: 2, icbsSolved: true, icbsSum: 38, prioritizedServed: 2, hitRate: 1.0 },
  { batch: 3, icbsSolved: true, icbsSum: 43, prioritizedServed: 2, hitRate: 2 / 3 },
  { batch: 4, icbsSolved: true, icbsSum: 52, prioritizedServed: 2, hitRate: 0.5 },
  { batch: 5, icbsSolved: true, icbsSum: 61, prioritizedServed: 3, hitRate: 0.6 },
  { batch: 6, icbsSolved: true, icbsSum: 69, prioritizedServed: 3, hitRate: 0.5 },
]

/** The release-gate journal: two asks from the fixture's own window list. */
export const JOURNAL: JournalRow[] = [
  {
    id: "W-1",
    amr: "Kiln",
    klass: "express",
    origin: [8, 9],
    destination: [0, 9],
    earliest: 0,
    latest: 25,
    decision: "fire",
    reasons: ["The window is granted and the Dispatch Apron is clear at the departure."],
    grant: {
      amr: "Kiln",
      depart: 0,
      arrive: 8,
      detour: 0,
      regions: ["Dispatch Apron", "Aisle Four", "South Run", "Main Run", "North Run"],
    },
  },
  {
    id: "W-2",
    amr: "Ash",
    klass: "standard",
    origin: [3, 7],
    destination: [3, 10],
    earliest: 4,
    latest: 20,
    decision: "hesitate",
    reasons: ["The Main Run carries conflict density in ticks 4–7."],
    grant: {
      amr: "Ash",
      depart: 4,
      arrive: 7,
      detour: 4,
      regions: ["Main Run"],
    },
  },
]

/** The horizon and seed behind every figure above (fixture-locked). */
export const HORIZON = 30
export const SEED = 2027

/** Buckets of four ticks across the horizon; the heatmap's columns. */
export const BUCKET = 4
export const BUCKETS = Math.ceil(HORIZON / BUCKET)

export function bucketLabel(bucket: number): string {
  const from = bucket * BUCKET
  return `${from}–${from + BUCKET - 1}`
}

/** Splits a region carries in a bucket, or 0 when the tree never split there. */
export function splitsAt(rows: DensityRow[], region: string, bucket: number): DensityRow | null {
  const from = bucket * BUCKET
  return rows.find((row) => row.region === region && row.tickFrom === from) ?? null
}

/** The region's total split count across the whole horizon. */
export function regionTotal(rows: DensityRow[], region: string): number {
  return rows.filter((row) => row.region === region).reduce((sum, row) => sum + row.splits, 0)
}
