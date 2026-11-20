package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Cardinal-conflict density, the planner's congestion signal: where and when
 * the conflict tree had to split, and how many sides at each split had no
 * cheaper way out. Buckets of four ticks.
 */
public record DensitySignal(String region, int tickFrom, int tickTo, int splits, int cardinal) {

    public static final int BUCKET = 4;

    public static List<DensitySignal> from(List<ConflictSolver.Split> splits, int horizon) {
        Map<String, Map<Integer, int[]>> byRegion = new TreeMap<>();
        for (ConflictSolver.Split split : splits) {
            int bucket = Math.min(split.tick() / BUCKET, horizon / BUCKET);
            byRegion.computeIfAbsent(split.region(), key -> new TreeMap<>())
                    .computeIfAbsent(bucket, key -> new int[2]);
            int[] counts = byRegion.get(split.region()).get(bucket);
            counts[0]++;
            if (split.cardinality() == 2) {
                counts[1]++;
            }
        }
        List<DensitySignal> out = new ArrayList<>();
        for (Map.Entry<String, Map<Integer, int[]>> region : byRegion.entrySet()) {
            for (Map.Entry<Integer, int[]> bucket : region.getValue().entrySet()) {
                int from = bucket.getKey() * BUCKET;
                out.add(new DensitySignal(region.getKey(), from, from + BUCKET - 1,
                        bucket.getValue()[0], bucket.getValue()[1]));
            }
        }
        return out;
    }

    public static Map<String, Integer> totals(List<DensitySignal> signals) {
        Map<String, Integer> out = new HashMap<>();
        for (DensitySignal signal : signals) {
            out.merge(signal.region(), signal.splits(), Integer::sum);
        }
        return out;
    }
}
