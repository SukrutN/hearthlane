package dev.hearth.traffic;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Hand-built floors, small grids, and what the solvers owe on each. */
class PlanEngineTest {

    private static FloorGrid grid(int width, int height, List<FloorGrid.Run> runs) {
        return FloorGrid.paint(width, height, runs);
    }

    /** A fully open rectangle named once per row, for the smallest hand cases. */
    private static FloorGrid hall(int width, int height) {
        List<FloorGrid.Run> runs = new java.util.ArrayList<>();
        for (int row = 0; row < height; row++) {
            runs.add(FloorGrid.Run.row("Hall", row, 0, width - 1));
        }
        return FloorGrid.paint(width, height, runs);
    }

    private static PlanInput input(FloorGrid floor, List<PlanAgent> agents, int horizon) {
        PlanInput input = new PlanInput("test", "Test floor", floor, agents, horizon, 7);
        PlanRules.validate(input);
        return input;
    }

    private static List<Conflict> conflictsOf(Map<String, PlanPath> paths, int horizon) {
        return Conflict.among(paths, horizon);
    }

    @Test
    void theSwapWaitsForThePocket() {
        // Two AMRs run one corridor head-on; only a side pocket breaks the tie.
        FloorGrid floor = grid(6, 2, List.of(
                FloorGrid.Run.row("Run", 0, 0, 5),
                FloorGrid.Run.row("Pocket", 1, 2, 2)));
        PlanAgent first = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(0, 5), 12);
        PlanAgent second = new PlanAgent("B", "AMR-4", "bulk", new Cell(0, 5), new Cell(0, 0), 12);
        PlanInput input = input(floor, List.of(first, second), 14);

        ConflictSolver.Solution cbs = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        assertTrue(cbs.solved(), cbs.reason());
        assertTrue(conflictsOf(cbs.paths(), 14).isEmpty());
        assertEquals(12, cbs.sum(), "the pocket run costs one wait on each side of the joint optimum");

        PrioritizedSolver.Outcome greedy = new PrioritizedSolver(input).solve();
        // Express sweeps first and seals the corridor; the bulk AMR has no exit.
        assertFalse(greedy.solved());
        assertTrue(greedy.reason().contains("AMR-4"));
    }

    @Test
    void theCrossingYieldsByOneTick() {
        // A straight run and a turn cross at one cell; one AMR waits a tick.
        FloorGrid floor = hall(3, 3);
        PlanAgent east = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(0, 2), 5);
        PlanAgent south = new PlanAgent("B", "AMR-2", "bulk", new Cell(0, 2), new Cell(2, 2), 5);
        PlanInput input = input(floor, List.of(east, south), 6);

        ConflictSolver.Solution cbs = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        assertTrue(cbs.solved(), cbs.reason());
        assertTrue(conflictsOf(cbs.paths(), 6).isEmpty());
        assertEquals(4, cbs.sum(), "east lands at 2, south waits a tick and lands at 2+2");
    }

    @Test
    void theDeadlinePrunesWhatCannotLand() {
        // Express must land at tick 2; the bulk AMR parks on its only route.
        FloorGrid floor = hall(3, 3);
        PlanAgent express = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(0, 2), 2);
        PlanAgent parker = new PlanAgent("B", "AMR-4", "bulk", new Cell(1, 1), new Cell(0, 1), 1);
        PlanInput input = input(floor, List.of(express, parker), 6);

        ConflictSolver.Solution cbs = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        assertFalse(cbs.solved());
        assertTrue(cbs.reason().contains("due ticks"));

        PrioritizedSolver.Outcome greedy = new PrioritizedSolver(input).solve();
        assertFalse(greedy.solved());
        assertTrue(greedy.reason().contains("AMR-4"));
    }

    @Test
    void theDeadlineAcceptsWhatTheTreeCanRearrange() {
        // Same floor, but the parker owes a due of 2; the tree makes it wait.
        FloorGrid floor = hall(3, 3);
        PlanAgent express = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(0, 2), 2);
        PlanAgent parker = new PlanAgent("B", "AMR-4", "bulk", new Cell(1, 1), new Cell(0, 1), 2);
        PlanInput input = input(floor, List.of(express, parker), 6);

        ConflictSolver.Solution cbs = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        assertTrue(cbs.solved(), cbs.reason());
        assertEquals(4, cbs.sum(), "express lands at 2, the parker waits a tick and lands at 2");

        PrioritizedSolver.Outcome greedy = new PrioritizedSolver(input).solve();
        assertTrue(greedy.solved(), greedy.reason());
        assertEquals(4, greedy.sum());
    }

    @Test
    void theDueShorterThanTheRunIsRefused() {
        FloorGrid floor = hall(3, 3);
        PlanAgent impossible = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(2, 2), 3);
        PlanInput input = new PlanInput("test", "Test floor", floor, List.of(impossible), 6, 7);
        PlanRejection rejection = org.junit.jupiter.api.Assertions.assertThrows(PlanRejection.class,
                () -> PlanRules.validate(input));
        assertTrue(rejection.reasons().get(0).contains("cannot beat a due of 3"));
    }

    @Test
    void thePriorityFacesTheTangleFirst() {
        // Two same-tick tangles in separate halls; the express tangle is faced first.
        List<FloorGrid.Run> runs = new java.util.ArrayList<>();
        for (int row = 0; row < 3; row++) {
            runs.add(FloorGrid.Run.row("West Hall", row, 0, 2));
            runs.add(FloorGrid.Run.row("East Hall", row, 4, 6));
        }
        FloorGrid floor = grid(7, 3, runs);
        PlanAgent e1 = new PlanAgent("E1", "AMR-1", "express", new Cell(0, 0), new Cell(2, 2), 6);
        PlanAgent s1 = new PlanAgent("S1", "AMR-4", "bulk", new Cell(2, 0), new Cell(0, 2), 6);
        PlanAgent e2 = new PlanAgent("E2", "AMR-2", "standard", new Cell(0, 4), new Cell(2, 6), 6);
        PlanAgent s2 = new PlanAgent("S2", "AMR-6", "bulk", new Cell(2, 4), new Cell(0, 6), 6);
        PlanInput input = input(floor, List.of(e1, s1, e2, s2), 8);

        ConflictSolver.Solution cbs = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        assertTrue(cbs.solved(), cbs.reason());
        assertFalse(cbs.splits().isEmpty());
        // Both tangles land at tick 1; priority faces the express hall first.
        assertEquals(1, cbs.splits().getFirst().tick());
        assertEquals("West Hall", cbs.splits().getFirst().region());
    }

    @Test
    void theImprovedTreeRecordsCardinalSplits() {
        FloorGrid floor = grid(6, 2, List.of(
                FloorGrid.Run.row("Run", 0, 0, 5),
                FloorGrid.Run.row("Pocket", 1, 2, 2)));
        PlanAgent first = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(0, 5), 12);
        PlanAgent second = new PlanAgent("B", "AMR-4", "bulk", new Cell(0, 5), new Cell(0, 0), 12);
        PlanInput input = input(floor, List.of(first, second), 14);

        ConflictSolver.Solution plain = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        ConflictSolver.Solution improved = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve();
        assertTrue(plain.solved());
        assertTrue(improved.solved(), improved.reason());
        assertEquals(plain.sum(), improved.sum(), "both rungs stay optimal for the sum of arrivals");
        assertTrue(improved.splits().stream().anyMatch(split -> split.cardinality() == 2),
                "the head-on corridor split is cardinal on both sides");
        assertTrue(improved.expanded() <= plain.expanded(),
                "the improved tree never expands more than the plain one here");
    }

    @Test
    void theLadderReportsTheHonestGap() {
        FloorGrid floor = grid(6, 2, List.of(
                FloorGrid.Run.row("Run", 0, 0, 5),
                FloorGrid.Run.row("Pocket", 1, 2, 2)));
        PlanAgent first = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(0, 5), 12);
        PlanAgent second = new PlanAgent("B", "AMR-4", "bulk", new Cell(0, 5), new Cell(0, 0), 12);
        PlanInput input = input(floor, List.of(first, second), 14);

        List<DegradationLadder.Rung> rungs = DegradationLadder.run(input);
        assertEquals(3, rungs.size());
        assertEquals("CBS", rungs.get(0).solver());
        assertEquals(0, rungs.get(0).gap());
        assertEquals("ICBS", rungs.get(1).solver());
        assertEquals(0, rungs.get(1).gap());
        assertEquals("prioritized", rungs.get(2).solver());
        assertFalse(rungs.get(2).solved());
        assertNull(rungs.get(2).gap());
    }

    @Test
    void theWindowGrantsInsideTheSloAndRefusesOutside() {
        // AMR-4 sweeps row 0 westward and parks; eastbound windows pass through row 1.
        FloorGrid floor = hall(6, 2);
        PlanAgent booked = new PlanAgent("B", "AMR-4", "bulk", new Cell(0, 5), new Cell(0, 0), 10);
        PlanInput input = input(floor, List.of(booked), 12);
        ConflictSolver.Solution plan = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        assertTrue(plan.solved());

        WindowRequest early = new WindowRequest("W-1", "AMR-1", "express", new Cell(0, 0), new Cell(0, 5), 0, 10);
        WindowVerdict granted = WindowService.verdict(input, plan.paths(), early);
        assertTrue(granted.granted());
        assertNotNull(granted.grant());
        assertNull(granted.slo());
        // AMR-1 dips into row 1 to let the sweep pass, lands at 7, pays two waits.
        assertEquals(0, granted.grant().depart());
        assertEquals(7, granted.grant().arrive());
        assertEquals(2, granted.grant().detour(), "two waits behind the sweep");
        assertEquals(List.of("Hall"), granted.grant().regions());

        WindowRequest late = new WindowRequest("W-2", "AMR-2", "standard", new Cell(0, 0), new Cell(0, 5), 4, 6);
        WindowVerdict refused = WindowService.verdict(input, plan.paths(), late);
        assertFalse(refused.granted());
        assertNull(refused.grant());
        assertNotNull(refused.slo());
        assertEquals(11, refused.slo().earliestArrival(), "the dep-4 exit is swap-blocked; row 1 lands at 11");
        assertTrue(refused.slo().reasons().getFirst().contains("closes at tick 6"));
    }

    @Test
    void theGateFiresOnAClearRegionAndHesitatesOnAHotOne() {
        // Two AMRs run row 0 head-on; the tree splits once, in the Hall, at tick 3.
        FloorGrid floor = hall(6, 2);
        PlanAgent west = new PlanAgent("B", "AMR-4", "bulk", new Cell(0, 5), new Cell(0, 0), 10);
        PlanAgent east = new PlanAgent("A", "AMR-1", "express", new Cell(0, 0), new Cell(0, 5), 12);
        PlanInput input = input(floor, List.of(west, east), 12);
        ConflictSolver.Solution plan = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve();
        assertTrue(plan.solved());
        assertEquals(new ConflictSolver.Split("Hall", 3, 2), plan.splits().getFirst(),
                "the root tangle is the tick-3 swap, cardinal on both sides");
        assertTrue(plan.splits().stream().allMatch(split -> split.region().equals("Hall")));

        // A window leaving at tick 0 departs into the hot bucket.
        WindowRequest hot = new WindowRequest("G-1", "AMR-3", "standard", new Cell(0, 2), new Cell(1, 2), 0, 12);
        GateDecision hesitate = WindowService.gate(input, plan.paths(), plan.splits(), hot);
        assertEquals("hesitate", hesitate.decision());
        assertTrue(hesitate.reasons().getFirst().contains("carries conflict density in ticks 0 to 3"));

        // A window leaving at tick 8, after every split bucket, finds the region clear.
        WindowRequest clear = new WindowRequest("G-2", "AMR-3", "standard", new Cell(1, 0), new Cell(1, 3), 8, 12);
        GateDecision fire = WindowService.gate(input, plan.paths(), plan.splits(), clear);
        assertEquals("fire", fire.decision());
        assertTrue(fire.reasons().getFirst().contains("clear at the departure"));
    }
}
