package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeSet;

/**
 * Does the planner's congestion signal predict real congestion? The study
 * replays the prioritized planner under seeded shuffles of the manifest order,
 * counts the reservation rejections each region suffers, and correlates the
 * mean against the density signal per region.
 */
public final class ReplicationStudy {

    /** One replay: the seed, the shuffled order, and what the floor cost. */
    public record Run(int seed, List<String> order, int sum, boolean solved, Map<String, Integer> rejections) {}

    public record RegionRow(String region, int density, double meanRejections) {}

    /**
     * The runs, the per-region rows, and the Pearson correlation between the
     * density a region carries and the mean rejections it suffers. A region
     * with nothing to correlate reads as 0.
     */
    public record Outcome(List<Run> runs, double correlation, List<RegionRow> regions) {}

    private ReplicationStudy() {}

    public static Outcome run(PlanInput input, List<ConflictSolver.Split> splits, int runs) {
        List<PlanAgent> base = PrioritizedSolver.defaultOrder(input.agents());
        List<Run> replays = new ArrayList<>();
        for (int index = 0; index < runs; index++) {
            int seed = input.seed() + index;
            List<PlanAgent> shuffled = new ArrayList<>(base);
            Collections.shuffle(shuffled, new Random(seed));
            PrioritizedSolver.Outcome outcome = new PrioritizedSolver(input, shuffled).solve();
            replays.add(new Run(seed, outcome.order(), outcome.sum(), outcome.solved(), outcome.rejections()));
        }
        Map<String, Integer> density = DensitySignal.totals(DensitySignal.from(splits, input.horizon()));
        TreeSet<String> regions = new TreeSet<>();
        regions.addAll(density.keySet());
        for (Run replay : replays) {
            regions.addAll(replay.rejections().keySet());
        }
        List<RegionRow> rows = new ArrayList<>();
        List<Double> xs = new ArrayList<>();
        List<Double> ys = new ArrayList<>();
        for (String region : regions) {
            double mean = 0;
            for (Run replay : replays) {
                mean += replay.rejections().getOrDefault(region, 0);
            }
            mean = mean / replays.size();
            int card = density.getOrDefault(region, 0);
            rows.add(new RegionRow(region, card, mean));
            xs.add((double) card);
            ys.add(mean);
        }
        return new Outcome(replays, pearson(xs, ys), rows);
    }

    /** Pearson r; a region list with no variance cannot correlate, so 0. */
    static double pearson(List<Double> xs, List<Double> ys) {
        if (xs.isEmpty() || xs.size() != ys.size()) {
            return 0.0;
        }
        double meanX = 0;
        double meanY = 0;
        for (int i = 0; i < xs.size(); i++) {
            meanX += xs.get(i);
            meanY += ys.get(i);
        }
        meanX /= xs.size();
        meanY /= ys.size();
        double cov = 0;
        double varX = 0;
        double varY = 0;
        for (int i = 0; i < xs.size(); i++) {
            double dx = xs.get(i) - meanX;
            double dy = ys.get(i) - meanY;
            cov += dx * dy;
            varX += dx * dx;
            varY += dy * dy;
        }
        if (varX == 0 || varY == 0) {
            return 0.0;
        }
        return cov / Math.sqrt(varX * varY);
    }
}
