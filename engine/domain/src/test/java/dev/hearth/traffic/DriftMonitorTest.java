package dev.hearth.traffic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The drift monitor, tested the way a supervisor meets it: the floor
 * matching the plan, the floor disagreeing, and the repair that keeps or
 * loses the deadlines honestly.
 */
class DriftMonitorTest {

    /** the casting hall built from records: the same shape the fixture paints */
    private static PlanInput castingHall() {
        List<FloorGrid.Run> runs = List.of(
                new FloorGrid.Run("North Run", 0, null, 0, 11),
                new FloorGrid.Run("Main Run", 3, null, 0, 11),
                new FloorGrid.Run("South Run", 6, null, 0, 11),
                new FloorGrid.Run("Dispatch Apron", 8, null, 0, 11),
                new FloorGrid.Run("West Aisle", null, 0, 1, 7),
                new FloorGrid.Run("Aisle Two", null, 3, 1, 7),
                new FloorGrid.Run("Aisle Three", null, 6, 1, 7),
                new FloorGrid.Run("Aisle Four", null, 9, 1, 7));
        List<PlanAgent> agents = List.of(
                new PlanAgent("T-01", "AMR-1", "express", new Cell(8, 0), new Cell(0, 11), 22),
                new PlanAgent("T-02", "AMR-2", "standard", new Cell(0, 0), new Cell(8, 11), 25),
                new PlanAgent("T-03", "AMR-3", "standard", new Cell(3, 5), new Cell(3, 0), 9),
                new PlanAgent("T-04", "AMR-4", "bulk", new Cell(6, 9), new Cell(6, 0), 14),
                new PlanAgent("T-05", "AMR-5", "express", new Cell(0, 3), new Cell(8, 3), 11),
                new PlanAgent("T-06", "AMR-6", "bulk", new Cell(8, 6), new Cell(0, 6), 15));
        return new PlanInput("casting-hall", "Ferro & Lume casting hall",
                FloorGrid.paint(12, 9, runs), agents, 30, 2027);
    }

    private static Map<String, PlanPath> planOf(PlanInput input) {
        return new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve().paths();
    }

    @Test
    void theFloorMatchingThePlanReadsClean() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        List<DriftMonitor.Observation> seen = new ArrayList<>();
        for (Map.Entry<String, PlanPath> entry : paths.entrySet()) {
            seen.add(new DriftMonitor.Observation(entry.getKey(), 3, entry.getValue().positionAt(3)));
        }

        DriftMonitor.Reading reading = DriftMonitor.compare(paths, hall, seen);

        assertEquals(6, reading.observed());
        assertEquals(6, reading.onPlan());
        assertEquals(0, reading.violations().size());
        assertEquals(0, reading.arrivedIds().size());
    }

    @Test
    void anAgentStandingOffItsRouteIsNamedWithTheCell() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        // T-05's route runs row 0 to row 8; standing on the North Run far
        // from where the plan puts it at tick 4 is drift whichever way the
        // solver routed it
        List<DriftMonitor.Observation> seen = List.of(
                new DriftMonitor.Observation("T-05", 4, new Cell(0, 11)));

        DriftMonitor.Reading reading = DriftMonitor.compare(paths, hall, seen);

        assertEquals(1, reading.violations().size());
        DriftMonitor.Violation violation = reading.violations().get(0);
        assertEquals("T-05", violation.id());
        assertTrue(violation.detail().contains("tick 4"),
                "the detail should carry the tick: " + violation.detail());
        assertTrue(violation.detail().contains("0,11"),
                "the detail should carry the observed cell: " + violation.detail());
    }

    @Test
    void anAgentArrivedReadsAsArrivedNotAsDrift() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        // T-05 arrives at tick 9 in the published plan; standing on its goal
        // at tick 10 is the route's end, not drift
        List<DriftMonitor.Observation> seen = List.of(
                new DriftMonitor.Observation("T-05", 10, paths.get("T-05").goal()));

        DriftMonitor.Reading reading = DriftMonitor.compare(paths, hall, seen);

        assertEquals(0, reading.violations().size());
        assertTrue(reading.arrivedIds().contains("T-05"));
        assertEquals(1, reading.onPlan());
    }

    @Test
    void twoAgentsSharingACellIsACollisionRisk() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        List<DriftMonitor.Observation> seen = List.of(
                new DriftMonitor.Observation("T-01", 5, new Cell(8, 0)),
                new DriftMonitor.Observation("T-06", 5, new Cell(8, 0)));

        DriftMonitor.Reading reading = DriftMonitor.compare(paths, hall, seen);

        boolean collision = reading.violations().stream()
                .anyMatch(violation -> violation.kind().equals("collision")
                        && violation.detail().contains("T-01, T-06"));
        assertTrue(collision, "the pair should be named: " + reading.violations());
    }

    @Test
    void anUnknownAmrRefusesInWords() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        PlanRejection refusal = assertThrows(PlanRejection.class,
                () -> DriftMonitor.compare(paths, hall,
                        List.of(new DriftMonitor.Observation("T-99", 1, new Cell(0, 0)))));
        assertTrue(refusal.reasons().get(0).contains("T-99"));
    }

    @Test
    void anObservationOnRackRefusesInWords() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        // [1,1] is rack between the North Run and Aisle Two
        PlanRejection refusal = assertThrows(PlanRejection.class,
                () -> DriftMonitor.compare(paths, hall,
                        List.of(new DriftMonitor.Observation("T-01", 1, new Cell(1, 1)))));
        assertTrue(refusal.reasons().get(0).contains("not an open cell"));
    }

    @Test
    void aRepairFromThePlanKeepsTheDeadlines() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        List<DriftMonitor.Observation> seen = new ArrayList<>();
        for (Map.Entry<String, PlanPath> entry : paths.entrySet()) {
            seen.add(new DriftMonitor.Observation(entry.getKey(), 3, entry.getValue().positionAt(3)));
        }

        DriftMonitor.Repair repair = DriftMonitor.repair(paths, hall, seen);

        assertTrue(repair.verdict().contains("keeps every deadline"),
                "the verdict should hold: " + repair.verdict());
        assertTrue(repair.makespan() <= repair.oldMakespan(),
                "from on-plan positions the remaining makespan should not lengthen: "
                        + repair.makespan() + " vs " + repair.oldMakespan());
        assertEquals(0, repair.lateIds().size());
    }

    @Test
    void aHeldBackAgentLosesItsDeadlineAndTheRepairSaysSo() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        // AMR-3 still standing on its start at tick 8: its due is 9, so
        // the remaining budget is one tick while the run alone needs five
        List<DriftMonitor.Observation> seen = List.of(
                new DriftMonitor.Observation("T-03", 8, new Cell(3, 5)));

        DriftMonitor.Reading reading = DriftMonitor.compare(paths, hall, seen);
        assertTrue(reading.violations().stream().anyMatch(v -> v.id().equals("T-03")),
                "T-03 should read as drift: " + reading.violations());

        DriftMonitor.Repair repair = DriftMonitor.repair(paths, hall, seen);
        assertTrue(repair.lateIds().contains("T-03"),
                "T-03 should be named as late: " + repair.lateIds());
        assertTrue(repair.verdict().contains("cannot keep every deadline"),
                "the verdict should say it: " + repair.verdict());
        assertTrue(repair.verdict().contains("T-03"));
    }

    @Test
    void anArrivedAgentStandsOnItsGoalThroughTheRepair() throws Exception {
        PlanInput hall = castingHall();
        Map<String, PlanPath> paths = planOf(hall);

        // T-05 arrives at 9; at tick 12 it stands on its goal, and the
        // repair keeps it there as a standing obstacle
        List<DriftMonitor.Observation> seen = List.of(
                new DriftMonitor.Observation("T-05", 12, paths.get("T-05").goal()));

        DriftMonitor.Repair repair = DriftMonitor.repair(paths, hall, seen);

        assertEquals(0, repair.paths().get("T-05").arrival(),
                "an arrived agent's repair path is standing still");
        assertEquals(paths.get("T-05").goal(), repair.paths().get("T-05").start());
    }
}
