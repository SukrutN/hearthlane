package dev.hearth.traffic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

/**
 * Proof at scale: the conflict tree facing a fleet, not a demonstration
 * batch. The floor is the planner's largest legal grid (64 x 64, every
 * column an aisle), carrying a hundred AMRs in same-direction spaced pairs
 * - the tree carries a hundred routes and closes at the root when the
 * floor spaces them, which is the measured case here (100 AMRs, 67 ms,
 * zero expansions). The dues are real, the repeat solve must agree path
 * for path, and the drift monitor must repair the whole fleet on plan.
 *
 * One property worth naming: an INFEASIBLE fleet at this size - say, a
 * trailing cart whose leader parks across its path in a one-wide aisle -
 * does not fail fast. The tree grinds for the better part of an hour
 * proving no plan exists (measured: 3,286 CPU-seconds before the run was
 * stopped). That is conflict-based search being conflict-based search;
 * a production gate would want a wall-clock cap on the tree, which the
 * engine does not carry today.
 */
class FleetScaleTest {

    private static final long BUDGET_MS = 120_000;

    /**
     * The fleet floor: 64 columns, each a full-height aisle; fifty columns
     * carry two AMRs each (same direction, staggered starts so the pairs
     * keep their spacing), a hundred in all. Deterministic by construction.
     */
    private static PlanInput fleet(int agents) {
        List<FloorGrid.Run> runs = new ArrayList<>();
        for (int col = 0; col < 64; col++) {
            runs.add(new FloorGrid.Run("Aisle " + col, null, col, 0, 63));
        }
        List<PlanAgent> manifest = new ArrayList<>();
        int id = 0;
        outer:
        for (int col = 0; col < 64; col++) {
            // two per column, both northbound, spaced so they never touch:
            // the near starter (row 31) takes the far goal (row 0); the far
            // starter (row 63) trails it the whole way and takes row 1. In a
            // one-wide aisle a trailing cart can never pass a parked one,
            // so the goals must order with the starts - the other way round
            // the leader would drive through the follower's parking spot.
            for (int[] pair : new int[][] {{31, 0, 63, 1}}) {
                for (int p = 0; p + 1 < pair.length; p += 2) {
                    int startRow = pair[p];
                    int goalRow = pair[p + 1];
                    if (id >= agents) {
                        break outer;
                    }
                    manifest.add(new PlanAgent(
                            String.format("F-%03d", id),
                            "Fleet " + (id % 10),
                            id % 5 == 0 ? "express" : id % 3 == 0 ? "bulk" : "standard",
                            new Cell(startRow, col),
                            new Cell(goalRow, col),
                            63 + (id % 7)));
                    id++;
                }
            }
        }
        return new PlanInput("fleet-64", "The generated fleet floor",
                FloorGrid.paint(64, 64, runs), manifest, 72, 2027);
    }

    @Test
    @Timeout(300)
    void aHundredAmrsSolveInsideTheBudgetAndRepeatExactly() {
        PlanInput input = fleet(100);
        assertEquals(100, input.agents().size());

        long started = System.nanoTime();
        ConflictSolver.Solution first = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve();
        long elapsedMs = (System.nanoTime() - started) / 1_000_000;
        System.out.printf("scale: 100 AMRs solved in %d ms (expanded %d, budget %d ms)%n",
                elapsedMs, first.expanded(), BUDGET_MS);

        assertTrue(first.solved(), "the fleet must be served: " + first.reason());
        assertTrue(elapsedMs < BUDGET_MS,
                "100 AMRs took " + elapsedMs + " ms; the budget is " + BUDGET_MS + " ms");
        assertEquals(100, first.paths().size());
        for (PlanAgent agent : input.agents()) {
            assertTrue(agent.due() >= first.paths().get(agent.id()).arrival(),
                    agent.id() + " misses its due at scale: arrival "
                            + first.paths().get(agent.id()).arrival() + " against due " + agent.due());
        }

        // the repeat must agree path for path
        ConflictSolver.Solution second = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve();
        assertEquals(first.paths(), second.paths());
    }

    @Test
    @Timeout(300)
    void theRepairHoldsAtFleetScale() {
        // a hundred on-plan observations at tick 5: the monitor reads them,
        // and the repair re-solves the fleet from where it stands
        PlanInput input = fleet(100);
        Map<String, PlanPath> paths =
                new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve().paths();

        List<DriftMonitor.Observation> seen = new ArrayList<>();
        for (Map.Entry<String, PlanPath> entry : paths.entrySet()) {
            seen.add(new DriftMonitor.Observation(entry.getKey(), 5, entry.getValue().positionAt(5)));
        }
        DriftMonitor.Reading reading = DriftMonitor.compare(paths, input, seen);
        assertEquals(100, reading.observed());
        assertEquals(0, reading.violations().size());

        long started = System.nanoTime();
        DriftMonitor.Repair repair = DriftMonitor.repair(paths, input, seen);
        long elapsedMs = (System.nanoTime() - started) / 1_000_000;
        System.out.printf("scale: the fleet repair took %d ms and %s%n",
                elapsedMs, repair.verdict());
        assertTrue(repair.lateIds().isEmpty(), "an on-plan fleet must not lose deadlines at scale");
    }
}
