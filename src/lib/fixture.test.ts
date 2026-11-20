import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CASTING_HALL, openCells, paintFloor, regionAt } from "./fixture"

/** The document the site renders must be the planner's fixture, cell for cell. */
describe("the casting hall document", () => {
  const grid = paintFloor(CASTING_HALL)

  it("carries the planner's fixture shape", () => {
    assert.equal(CASTING_HALL.floor.id, "casting-hall")
    assert.equal(CASTING_HALL.floor.name, "Ferro & Lume casting hall")
    assert.equal(CASTING_HALL.floor.width, 12)
    assert.equal(CASTING_HALL.floor.height, 9)
    assert.equal(CASTING_HALL.tasks.length, 6)
    assert.equal(CASTING_HALL.windows.length, 2)
    assert.equal(CASTING_HALL.horizon, 30)
    assert.equal(CASTING_HALL.seed, 2027)
  })

  it("paints the same 68 open cells the planner validates", () => {
    assert.equal(openCells(grid), 68, "first paint wins: 48 corridor cells + 20 aisle cells")
  })

  it("names the corridors where the planner names them", () => {
    assert.equal(regionAt(grid, 0, 5), "North Run")
    assert.equal(regionAt(grid, 3, 5), "Main Run")
    assert.equal(regionAt(grid, 6, 5), "South Run")
    assert.equal(regionAt(grid, 8, 5), "Dispatch Apron")
    assert.equal(regionAt(grid, 5, 0), "West Aisle")
    assert.equal(regionAt(grid, 5, 3), "Aisle Two")
    assert.equal(regionAt(grid, 5, 6), "Aisle Three")
    assert.equal(regionAt(grid, 5, 9), "Aisle Four")
    assert.equal(regionAt(grid, 2, 2), "", "rack stays unpainted")
    assert.equal(regionAt(grid, 7, 11), "", "rack stays unpainted")
  })

  it("keeps the two window asks the gate journal answers", () => {
    const [w1, w2] = CASTING_HALL.windows
    assert.deepEqual(w1.origin, [8, 9])
    assert.deepEqual(w1.destination, [0, 9])
    assert.equal(w1.earliest, 0)
    assert.equal(w1.latest, 25)
    assert.deepEqual(w2.origin, [3, 7])
    assert.deepEqual(w2.destination, [3, 10])
    assert.equal(w2.earliest, 4)
    assert.equal(w2.latest, 20)
  })
})
