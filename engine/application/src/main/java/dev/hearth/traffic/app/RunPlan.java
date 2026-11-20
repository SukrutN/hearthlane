package dev.hearth.traffic.app;

import dev.hearth.traffic.AgentConstraints;
import dev.hearth.traffic.ConflictSolver;
import dev.hearth.traffic.DegradationLadder;
import dev.hearth.traffic.DensitySignal;
import dev.hearth.traffic.GateDecision;
import dev.hearth.traffic.PlanAgent;
import dev.hearth.traffic.PlanInput;
import dev.hearth.traffic.PlanPath;
import dev.hearth.traffic.PlanRules;
import dev.hearth.traffic.PrioritizedSolver;
import dev.hearth.traffic.ReplicationStudy;
import dev.hearth.traffic.WindowService;
import dev.hearth.traffic.WindowVerdict;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The planner at work: solve the manifest with the improved tree, read the
 * deadline curve off the batch prefixes, read the density map off the splits,
 * replay the shuffled orders for the correlation, and walk the gate on the
 * fixture's window asks.
 */
public final class RunPlan {

    public record ArrivalRow(String id, String amr, String klass, String start, String goal, int due, int arrived) {}

    public record CurveRow(int batch, boolean icbsSolved, int icbsSum, int prioritizedServed, double hitRate) {}

    public record WindowRow(String id, String amr, String klass, String origin, String destination, int earliest,
            int latest, String decision, List<String> reasons, WindowVerdict verdict) {}

    /**
     * The full reading of one manifest. {@code ladder} carries the three rungs;
     * {@code arrivals} the served times against the dues; {@code density} the
     * cardinal map; {@code replications} the seeded correlation; {@code curve}
     * the deadline-hit rate by batch size; {@code windows} the gate journal.
     */
    public record PlanReport(String floorId, String floorName, List<DegradationLadder.Rung> ladder,
            List<ArrivalRow> arrivals, int servedSum, int makespan, List<DensitySignal> density,
            ReplicationStudy.Outcome replications, List<CurveRow> curve, List<WindowRow> windows) {}

    private RunPlan() {}

    public static PlanReport plan(PlanInput input) {
        PlanRules.validate(input);

        long started = System.nanoTime();
        ConflictSolver.Solution cbs = new ConflictSolver(input, ConflictSolver.Mode.PLAIN).solve();
        long cbsMicros = microsSince(started);

        started = System.nanoTime();
        ConflictSolver.Solution icbs = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve();
        long icbsMicros = microsSince(started);

        started = System.nanoTime();
        PrioritizedSolver.Outcome greedy = new PrioritizedSolver(input).solve();
        long greedyMicros = microsSince(started);

        Integer greedyGap = greedy.solved() && cbs.solved() ? greedy.sum() - cbs.sum() : null;
        List<DegradationLadder.Rung> ladder = List.of(
                new DegradationLadder.Rung("CBS", cbs.solved() ? cbs.sum() : null, cbs.solved() ? 0 : null,
                        cbs.expanded(), cbsMicros, cbs.solved(), cbs.reason()),
                new DegradationLadder.Rung("ICBS", icbs.solved() ? icbs.sum() : null, icbs.solved() ? 0 : null,
                        icbs.expanded(), icbsMicros, icbs.solved(), icbs.reason()),
                new DegradationLadder.Rung("prioritized", greedy.solved() ? greedy.sum() : null, greedyGap,
                        greedy.expansions(), greedyMicros, greedy.solved(), greedy.reason()));

        if (!icbs.solved()) {
            throw new IllegalStateException("The served tree failed: " + icbs.reason());
        }
        Map<String, PlanPath> paths = icbs.paths();
        List<ArrivalRow> arrivals = new ArrayList<>();
        for (PlanAgent agent : input.agents()) {
            PlanPath path = paths.get(agent.id());
            arrivals.add(new ArrivalRow(agent.id(), agent.amr(), agent.klass(),
                    agent.start().key(), agent.goal().key(), agent.due(), path.arrival()));
        }

        List<DensitySignal> density = DensitySignal.from(icbs.splits(), input.horizon());
        ReplicationStudy.Outcome replications = ReplicationStudy.run(input, icbs.splits(), 8);
        List<CurveRow> curve = deadlineCurve(input);
        List<WindowRow> windows = walkTheGate(input, paths, icbs.splits());

        int servedSum = 0;
        int makespan = 0;
        for (PlanPath path : paths.values()) {
            servedSum += path.arrival();
            makespan = Math.max(makespan, path.arrival());
        }
        return new PlanReport(input.floorId(), input.floorName(), ladder, arrivals, servedSum, makespan,
                density, replications, curve, windows);
    }

    /** Release the tasks in manifest order, one more each round, and read who lands on time. */
    public static List<CurveRow> deadlineCurve(PlanInput input) {
        List<CurveRow> curve = new ArrayList<>();
        List<PlanAgent> agents = input.agents();
        for (int batch = 1; batch <= agents.size(); batch++) {
            PlanInput prefix = new PlanInput(input.floorId(), input.floorName(), input.floor(),
                    agents.subList(0, batch), input.horizon(), input.seed());
            ConflictSolver.Solution icbs = new ConflictSolver(prefix, ConflictSolver.Mode.IMPROVED).solve();
            PrioritizedSolver.Outcome greedy = new PrioritizedSolver(prefix).solve();
            curve.add(new CurveRow(batch, icbs.solved(), icbs.sum(), greedy.served(),
                    (double) greedy.served() / batch));
        }
        return curve;
    }

    /** Every window ask the fixture carries, run through the desk and the gate. */
    public static List<WindowRow> walkTheGate(PlanInput input, Map<String, PlanPath> snapshot,
            List<ConflictSolver.Split> splits) {
        List<WindowRow> rows = new ArrayList<>();
        for (dev.hearth.traffic.WindowRequest request : input.windows()) {
            GateDecision decision = WindowService.gate(input, snapshot, splits, request);
            rows.add(new WindowRow(request.id(), request.amr(), request.klass(),
                    request.origin().key(), request.destination().key(), request.earliest(), request.latest(),
                    decision.decision(), decision.reasons(), decision.verdict()));
        }
        return rows;
    }

    private static long microsSince(long started) {
        return (System.nanoTime() - started) / 1_000;
    }
}
