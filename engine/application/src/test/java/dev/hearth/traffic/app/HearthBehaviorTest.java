package dev.hearth.traffic.app;

import dev.hearth.traffic.DegradationLadder;
import dev.hearth.traffic.DensitySignal;
import dev.hearth.traffic.PlanInput;
import dev.hearth.traffic.PlanRejection;
import dev.hearth.traffic.ReplicationStudy;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The canonical reading of the Ferro &amp; Lume casting hall, locked line by
 * line: the engine's own figures, so the site cannot drift from the planner.
 */
class HearthBehaviorTest {

    private static RunPlan.PlanReport report() {
        return RunPlan.plan(PlanLibrary.load("casting-hall"));
    }

    @Test
    void theLadderStepsDownHonest() {
        List<DegradationLadder.Rung> ladder = report().ladder();
        assertEquals(3, ladder.size());

        DegradationLadder.Rung cbs = ladder.get(0);
        assertEquals("CBS", cbs.solver());
        assertEquals(69, cbs.sum());
        assertEquals(0, cbs.gap());
        assertEquals(34, cbs.expanded());
        assertTrue(cbs.solved());
        assertTrue(cbs.micros() > 0, "the CBS rung times itself");

        DegradationLadder.Rung icbs = ladder.get(1);
        assertEquals("ICBS", icbs.solver());
        assertEquals(69, icbs.sum(), "the improved tree stays optimal");
        assertEquals(0, icbs.gap());
        assertEquals(23, icbs.expanded(), "and expands fewer nodes than plain CBS");
        assertTrue(icbs.solved());
        assertTrue(icbs.micros() > 0);

        DegradationLadder.Rung greedy = ladder.get(2);
        assertEquals("prioritized", greedy.solver());
        assertFalse(greedy.solved());
        assertNull(greedy.sum(), "an unsolved rung reports no sum");
        assertNull(greedy.gap(), "no plan, no gap — the ladder is honest");
        assertEquals(72, greedy.expanded());
        assertTrue(greedy.reason().contains("Tinder"));
    }

    @Test
    void theJointTreeMeetsEveryDeadline() {
        RunPlan.PlanReport report = report();
        assertEquals(6, report.arrivals().size());

        List<Integer> expected = List.of(19, 19, 5, 9, 9, 8);
        for (int i = 0; i < report.arrivals().size(); i++) {
            RunPlan.ArrivalRow row = report.arrivals().get(i);
            assertEquals(expected.get(i), row.arrived(), row.id() + " arrival");
            assertTrue(row.arrived() <= row.due(), row.id() + " lands inside its due");
        }
        assertEquals(69, report.servedSum());
        assertEquals(19, report.makespan());
    }

    @Test
    void theDensityMapNamesWhereTheTreeSplit() {
        List<DensitySignal> density = report().density();
        assertEquals(6, density.size());

        List<DensitySignal> expected = List.of(
                new DensitySignal("Aisle Two", 4, 7, 4, 0),
                new DensitySignal("Dispatch Apron", 8, 11, 6, 0),
                new DensitySignal("Main Run", 4, 7, 3, 0),
                new DensitySignal("North Run", 12, 15, 1, 0),
                new DensitySignal("South Run", 4, 7, 8, 4),
                new DensitySignal("West Aisle", 4, 7, 1, 0));
        assertEquals(expected, density, "region by bucket, splits and cardinal sides");
    }

    @Test
    void theReplicationCorrelatesDensityWithRejections() {
        ReplicationStudy.Outcome replications = report().replications();
        assertEquals(8, replications.runs().size(), "eight seeded shuffles, seeds 2027 through 2034");
        for (int i = 0; i < 8; i++) {
            assertEquals(2027 + i, replications.runs().get(i).seed());
        }
        assertEquals(0.692131007171352, replications.correlation(), 1e-12);

        List<ReplicationStudy.RegionRow> expected = List.of(
                new ReplicationStudy.RegionRow("Aisle Two", 4, 0.75),
                new ReplicationStudy.RegionRow("Dispatch Apron", 6, 1.375),
                new ReplicationStudy.RegionRow("Main Run", 3, 4.25),
                new ReplicationStudy.RegionRow("North Run", 1, 0.625),
                new ReplicationStudy.RegionRow("South Run", 8, 7.25),
                new ReplicationStudy.RegionRow("West Aisle", 1, 0.625));
        assertEquals(expected, replications.regions());
    }

    @Test
    void theDeadlineCurveShowsWherePrioritizedBreaks() {
        List<RunPlan.CurveRow> curve = report().curve();
        assertEquals(6, curve.size());

        List<RunPlan.CurveRow> expected = List.of(
                new RunPlan.CurveRow(1, true, 19, 1, 1.0),
                new RunPlan.CurveRow(2, true, 38, 2, 1.0),
                new RunPlan.CurveRow(3, true, 43, 2, 0.6666666666666666),
                new RunPlan.CurveRow(4, true, 52, 2, 0.5),
                new RunPlan.CurveRow(5, true, 61, 3, 0.6),
                new RunPlan.CurveRow(6, true, 69, 3, 0.5));
        for (int i = 0; i < curve.size(); i++) {
            assertEquals(expected.get(i), curve.get(i), "batch " + (i + 1));
        }
    }

    @Test
    void theGateWalkthroughFiresAndHesitates() {
        List<RunPlan.WindowRow> windows = report().windows();
        assertEquals(2, windows.size());

        RunPlan.WindowRow fire = windows.get(0);
        assertEquals("W-1", fire.id());
        assertEquals("fire", fire.decision());
        assertEquals(List.of("The window is granted and the Dispatch Apron is clear at the departure."),
                fire.reasons());
        assertNotNull(fire.verdict().grant());
        assertNull(fire.verdict().slo());
        assertEquals("Kiln", fire.verdict().grant().amr());
        assertEquals(0, fire.verdict().grant().depart());
        assertEquals(8, fire.verdict().grant().arrive());
        assertEquals(0, fire.verdict().grant().detour());
        assertEquals(List.of("Dispatch Apron", "Aisle Four", "South Run", "Main Run", "North Run"),
                fire.verdict().grant().regions());

        RunPlan.WindowRow hesitate = windows.get(1);
        assertEquals("W-2", hesitate.id());
        assertEquals("hesitate", hesitate.decision());
        assertEquals(List.of("The Main Run carries conflict density in ticks 4\u20137."), hesitate.reasons());
        assertNotNull(hesitate.verdict().grant());
        assertEquals("Ash", hesitate.verdict().grant().amr());
        assertEquals(4, hesitate.verdict().grant().depart());
        assertEquals(7, hesitate.verdict().grant().arrive());
        assertEquals(4, hesitate.verdict().grant().detour());
        assertEquals(List.of("Main Run"), hesitate.verdict().grant().regions());
    }

    @Test
    void theReaderIsStrictAboutDocuments() {
        PlanRejection unknownField = org.junit.jupiter.api.Assertions.assertThrows(PlanRejection.class,
                () -> HearthJson.parse("{\"floor\":{},\"tasks\":[],\"horizon\":1,\"seed\":1,\"mood\":\"eager\"}"));
        assertTrue(unknownField.reasons().get(0).contains("unknown field mood"));

        PlanRejection unknownFixture = org.junit.jupiter.api.Assertions.assertThrows(PlanRejection.class,
                () -> PlanLibrary.load("no-such-hall"));
        assertTrue(unknownFixture.reasons().get(0).contains("No fixture answers to no-such-hall"));
    }

    @Test
    void theWindowDeskRefusesWhatCannotLand() {
        PlanInput input = PlanLibrary.load("casting-hall");
        // A window closing past the horizon is refused before any routing.
        dev.hearth.traffic.WindowRequest late = new dev.hearth.traffic.WindowRequest(
                "W-X", "Ember", "express", new dev.hearth.traffic.Cell(0, 11), new dev.hearth.traffic.Cell(8, 0),
                0, 40);
        dev.hearth.traffic.WindowVerdict verdict = dev.hearth.traffic.WindowService.verdict(
                input, java.util.Map.of(), late);
        assertFalse(verdict.granted());
        assertNull(verdict.grant());
        assertNotNull(verdict.slo());
        assertTrue(verdict.slo().reasons().get(0).contains("past the horizon of 30"));
    }
}
