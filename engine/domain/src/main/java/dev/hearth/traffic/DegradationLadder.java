package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.List;

/**
 * The honest ladder: every rung solves the same manifest — optimal CBS, the
 * improved tree, then the prioritized fallback — and each reports what it
 * cost, how long it took, and how far off the optimum it landed.
 */
public final class DegradationLadder {

    public record Rung(String solver, Integer sum, Integer gap, int expanded, long micros, boolean solved, String reason) {}

    private DegradationLadder() {}

    public static List<Rung> run(PlanInput input) {
        List<Rung> out = new ArrayList<>();
        long started = System.nanoTime();
        ConflictSolver cbs = new ConflictSolver(input, ConflictSolver.Mode.PLAIN);
        ConflictSolver.Solution plain = cbs.solve();
        long micros = microsSince(started);
        out.add(new Rung("CBS", plain.solved() ? plain.sum() : null, plain.solved() ? 0 : null, plain.expanded(),
                micros, plain.solved(), plain.reason()));

        started = System.nanoTime();
        ConflictSolver icbs = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED);
        ConflictSolver.Solution improved = icbs.solve();
        micros = microsSince(started);
        out.add(new Rung("ICBS", improved.solved() ? improved.sum() : null, improved.solved() ? 0 : null,
                improved.expanded(), micros, improved.solved(), improved.reason()));

        started = System.nanoTime();
        PrioritizedSolver prioritized = new PrioritizedSolver(input);
        PrioritizedSolver.Outcome greedy = prioritized.solve();
        micros = microsSince(started);
        Integer gap = null;
        if (greedy.solved() && plain.solved()) {
            gap = greedy.sum() - plain.sum();
        }
        out.add(new Rung("prioritized", greedy.solved() ? greedy.sum() : null, gap, greedy.expansions(), micros,
                greedy.solved(), greedy.reason()));
        return out;
    }

    private static long microsSince(long started) {
        return (System.nanoTime() - started) / 1_000;
    }
}
