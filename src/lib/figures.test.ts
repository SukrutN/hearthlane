import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ARRIVALS,
  BUCKETS,
  CORRELATION,
  CURVE,
  DENSITY,
  HORIZON,
  JOURNAL,
  LADDER,
  MAKESPAN,
  REPLICATION_REGIONS,
  REPLICATION_SEEDS,
  SERVED_SUM,
  bucketLabel,
  regionTotal,
  splitsAt,
} from "./figures"

/**
 * The site's half of the characterization contract. Each `it` mirrors an
 * assertion in hearthline-plan's HearthBehaviorTest, so the page cannot drift
 * from the engine's canonical reading of the casting hall.
 */
describe("canonical figures", () => {
  it("steps the ladder down honestly", () => {
    assert.equal(LADDER.length, 3)
    const [cbs, icbs, greedy] = LADDER
    assert.deepEqual(cbs, { solver: "CBS", sum: 69, gap: 0, expanded: 34, solved: true, reason: null })
    assert.deepEqual(icbs, { solver: "ICBS", sum: 69, gap: 0, expanded: 23, solved: true, reason: null })
    assert.equal(greedy.solver, "prioritized")
    assert.equal(greedy.solved, false)
    assert.equal(greedy.sum, null, "an unsolved rung reports no sum")
    assert.equal(greedy.gap, null, "no plan, no gap — the ladder is honest")
    assert.equal(greedy.expanded, 72)
    assert.ok(greedy.reason?.includes("Tinder"))
  })

  it("lands every task inside its due", () => {
    assert.equal(ARRIVALS.length, 6)
    const expected = [19, 19, 5, 9, 9, 8]
    ARRIVALS.forEach((row, index) => {
      assert.equal(row.arrived, expected[index], `${row.id} arrival`)
      assert.ok(row.arrived <= row.due, `${row.id} lands inside its due`)
    })
    assert.equal(SERVED_SUM, 69)
    assert.equal(MAKESPAN, 19)
  })

  it("names where the tree split, region by bucket", () => {
    assert.equal(DENSITY.length, 6)
    const expected = [
      { region: "Aisle Two", tickFrom: 4, tickTo: 7, splits: 4, cardinal: 0 },
      { region: "Dispatch Apron", tickFrom: 8, tickTo: 11, splits: 6, cardinal: 0 },
      { region: "Main Run", tickFrom: 4, tickTo: 7, splits: 3, cardinal: 0 },
      { region: "North Run", tickFrom: 12, tickTo: 15, splits: 1, cardinal: 0 },
      { region: "South Run", tickFrom: 4, tickTo: 7, splits: 8, cardinal: 4 },
      { region: "West Aisle", tickFrom: 4, tickTo: 7, splits: 1, cardinal: 0 },
    ]
    assert.deepEqual(DENSITY, expected)
    // The heatmap helpers must agree with the rows.
    assert.equal(splitsAt(DENSITY, "South Run", 1)?.splits, 8)
    assert.equal(splitsAt(DENSITY, "South Run", 0), null)
    assert.equal(regionTotal(DENSITY, "Dispatch Apron"), 6)
  })

  it("correlates density with rejections across eight seeded shuffles", () => {
    assert.deepEqual(REPLICATION_SEEDS, [2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034])
    assert.ok(Math.abs(CORRELATION - 0.692131007171352) < 1e-12)
    const expected = [
      { region: "Aisle Two", density: 4, meanRejections: 0.75 },
      { region: "Dispatch Apron", density: 6, meanRejections: 1.375 },
      { region: "Main Run", density: 3, meanRejections: 4.25 },
      { region: "North Run", density: 1, meanRejections: 0.625 },
      { region: "South Run", density: 8, meanRejections: 7.25 },
      { region: "West Aisle", density: 1, meanRejections: 0.625 },
    ]
    assert.deepEqual(REPLICATION_REGIONS, expected)
  })

  it("shows where prioritized breaks on the deadline curve", () => {
    assert.equal(CURVE.length, 6)
    const expectedSums = [19, 38, 43, 52, 61, 69]
    const expectedRates = [1, 1, 2 / 3, 0.5, 0.6, 0.5]
    const expectedServed = [1, 2, 2, 2, 3, 3]
    CURVE.forEach((row, index) => {
      assert.equal(row.batch, index + 1)
      assert.equal(row.icbsSolved, true, `batch ${row.batch} stays solved under ICBS`)
      assert.equal(row.icbsSum, expectedSums[index])
      assert.equal(row.prioritizedServed, expectedServed[index])
      assert.ok(Math.abs(row.hitRate - expectedRates[index]) < 1e-12)
    })
  })

  it("fires and hesitates in the gate journal", () => {
    assert.equal(JOURNAL.length, 2)
    const [fire, hesitate] = JOURNAL
    assert.equal(fire.decision, "fire")
    assert.deepEqual(fire.reasons, ["The window is granted and the Dispatch Apron is clear at the departure."])
    assert.deepEqual(fire.grant, {
      amr: "Kiln",
      depart: 0,
      arrive: 8,
      detour: 0,
      regions: ["Dispatch Apron", "Aisle Four", "South Run", "Main Run", "North Run"],
    })
    assert.equal(hesitate.decision, "hesitate")
    assert.deepEqual(hesitate.reasons, ["The Main Run carries conflict density in ticks 4–7."])
    assert.deepEqual(hesitate.grant, {
      amr: "Ash",
      depart: 4,
      arrive: 7,
      detour: 4,
      regions: ["Main Run"],
    })
  })

  it("buckets the horizon into eight columns of four ticks", () => {
    assert.equal(HORIZON, 30)
    assert.equal(BUCKETS, 8)
    assert.equal(bucketLabel(0), "0–3")
    assert.equal(bucketLabel(1), "4–7")
    assert.equal(bucketLabel(7), "28–31")
  })
})
