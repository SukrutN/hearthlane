package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The degraded rung: AMRs planned one at a time, high priority first, against
 * the reservations of the traffic already booked. Fast, honest, and not
 * always able to thread what the joint tree can.
 */
public final class PrioritizedSolver {

    /**
     * The answer, with the order used and the regions where earlier traffic
     * pushed later AMRs around. {@code served} counts the AMRs planned before
     * a failure; on success it equals the manifest size.
     */
    public record Outcome(Map<String, PlanPath> paths, int sum, int makespan, boolean solved, String reason,
            int served, List<String> order, Map<String, Integer> rejections, int expansions) {}

    private final PlanInput input;
    private final List<PlanAgent> order;

    public PrioritizedSolver(PlanInput input) {
        this(input, defaultOrder(input.agents()));
    }

    /** A specific order — the replication study feeds shuffles through here. */
    public PrioritizedSolver(PlanInput input, List<PlanAgent> order) {
        this.input = input;
        this.order = order;
    }

    public Outcome solve() {
        PlanRules.validate(input);
        ReservationTable table = new ReservationTable();
        Map<String, PlanPath> paths = new HashMap<>();
        Map<String, Integer> rejections = new HashMap<>();
        int sum = 0;
        int expansions = 0;
        for (PlanAgent agent : order) {
            SpaceTimePlanner planner = new SpaceTimePlanner(input.floor(), agent, AgentConstraints.none(), table,
                    input.horizon(), 0, agent.due());
            PlanPath path = planner.plan();
            expansions += planner.expansions();
            for (Map.Entry<String, Integer> entry : planner.rejections().entrySet()) {
                rejections.merge(entry.getKey(), entry.getValue(), Integer::sum);
            }
            if (path == null) {
                return new Outcome(Map.of(), 0, 0, false,
                        agent.amr() + " cannot reach its goal under the traffic booked ahead of it.",
                        paths.size(), ids(), Map.copyOf(rejections), expansions);
            }
            table.reserve(path, input.horizon());
            paths.put(agent.id(), path);
            sum += path.arrival();
        }
        int makespan = 0;
        for (PlanPath path : paths.values()) {
            makespan = Math.max(makespan, path.arrival());
        }
        return new Outcome(Map.copyOf(paths), sum, makespan, true, null, paths.size(), ids(),
                Map.copyOf(rejections), expansions);
    }

    private List<String> ids() {
        List<String> out = new ArrayList<>();
        for (PlanAgent agent : order) {
            out.add(agent.id());
        }
        return out;
    }

    /** Priority first; ties break on the manifest order of the ids. */
    public static List<PlanAgent> defaultOrder(List<PlanAgent> agents) {
        List<PlanAgent> out = new ArrayList<>(agents);
        out.sort(Comparator.comparingInt(PlanAgent::priority).reversed().thenComparing(PlanAgent::id));
        return out;
    }
}
