package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/**
 * The conflict tree. Plain CBS is optimal for the sum of arrivals; the improved
 * variant measures how cardinal each split is — how many sides have no cheaper
 * way out — and takes the bypasses it can. When two conflicts share a tick,
 * the one involving the higher-priority classes is faced first.
 */
public final class ConflictSolver {

    public enum Mode {
        /** Plain CBS. Splits are recorded, cardinality is not measured. */
        PLAIN,
        /** Improved CBS: cardinal measurement, bypass, cardinal splits first. */
        IMPROVED
    }

    /** A split the tree performed: where, when, and how many sides had no better option. */
    public record Split(String region, int tick, int cardinality) {}

    /**
     * The tree's answer. On failure the reason says which AMR or which wall
     * ended the search; {@code paths} is empty and {@code sum} is 0.
     */
    public record Solution(Map<String, PlanPath> paths, int sum, int makespan, int expanded,
            List<Split> splits, boolean solved, String reason) {}

    private record Node(Map<String, PlanPath> paths, Map<String, AgentConstraints> constraints,
            int sum, int cardinality, long order) {}

    private static final int CAP = 100_000;

    private final PlanInput input;
    private final Mode mode;

    public ConflictSolver(PlanInput input, Mode mode) {
        this.input = input;
        this.mode = mode;
    }

    public Solution solve() {
        PlanRules.validate(input);
        Map<String, PlanPath> paths = new HashMap<>();
        Map<String, AgentConstraints> constraints = new HashMap<>();
        int sum = 0;
        for (PlanAgent agent : input.agents()) {
            PlanPath path = planAlone(agent, AgentConstraints.none());
            if (path == null) {
                return failure("The conflict tree never opened: " + agent.amr() + " cannot reach its goal even with"
                        + " the floor to itself.");
            }
            paths.put(agent.id(), path);
            constraints.put(agent.id(), AgentConstraints.none());
            sum += path.arrival();
        }
        PriorityQueue<Node> open = new PriorityQueue<>(comparator());
        open.add(new Node(paths, constraints, sum, 0, 0));
        int expanded = 0;
        long order = 1;
        List<Split> splits = new ArrayList<>();
        while (!open.isEmpty()) {
            Node node = open.poll();
            List<Conflict> conflicts = Conflict.among(node.paths(), input.horizon());
            if (conflicts.isEmpty()) {
                return new Solution(node.paths(), node.sum(), makespan(node.paths()), expanded,
                        List.copyOf(splits), true, null);
            }
            Conflict first = faceFirst(conflicts, node.paths());
            PlanPath replan1 = replan(node, first.a1(), constraintFor(first, first.a1()));
            PlanPath replan2 = replan(node, first.a2(), constraintFor(first, first.a2()));
            int cardinality = mode == Mode.IMPROVED
                    ? costRise(replan1, node, first.a1()) + costRise(replan2, node, first.a2())
                    : 0;
            splits.add(new Split(input.floor().regionOf(first.cell()), first.tick(), cardinality));
            expanded++;
            if (expanded > CAP) {
                return failure("The conflict tree grew past its cap without a plan.");
            }
            order = grow(open, node, first.a1(), constraintFor(first, first.a1()), replan1, cardinality,
                    conflicts.size(), order);
            order = grow(open, node, first.a2(), constraintFor(first, first.a2()), replan2, cardinality,
                    conflicts.size(), order);
        }
        return failure("Every branch of the tree died: no plan keeps all the due ticks and routes.");
    }

    /** The AMR's route under the new constraint, or null when the branch is dead. */
    private PlanPath replan(Node node, String id, Constraint constraint) {
        AgentConstraints own = node.constraints().get(id).with(constraint);
        return planAlone(agentOf(id), own);
    }

    /**
     * Push the child, or — on an equal-cost route that clears more conflicts —
     * take the parent's place instead. Returns the next free order key.
     */
    private long grow(PriorityQueue<Node> open, Node node, String id, Constraint constraint, PlanPath replanned,
            int cardinality, int parentConflicts, long order) {
        if (replanned == null) {
            return order;
        }
        Map<String, PlanPath> childPaths = new HashMap<>(node.paths());
        childPaths.put(id, replanned);
        int childSum = childSum(childPaths);
        int childConflicts = Conflict.among(childPaths, input.horizon()).size();
        if (mode == Mode.IMPROVED && replanned.arrival() == node.paths().get(id).arrival()
                && childConflicts < parentConflicts) {
            open.add(new Node(childPaths, withConstraint(node, id, constraint), childSum, cardinality, node.order()));
            return order;
        }
        open.add(new Node(childPaths, withConstraint(node, id, constraint), childSum, cardinality, order));
        return order + 1;
    }

    private Map<String, AgentConstraints> withConstraint(Node node, String id, Constraint constraint) {
        Map<String, AgentConstraints> out = new HashMap<>(node.constraints());
        out.put(id, node.constraints().get(id).with(constraint));
        return out;
    }

    private int costRise(PlanPath replanned, Node node, String id) {
        if (replanned == null) {
            return 1;
        }
        return replanned.arrival() > node.paths().get(id).arrival() ? 1 : 0;
    }

    /** Priority breaks the tie: the tree faces the higher-priority tangle first. */
    private Conflict faceFirst(List<Conflict> conflicts, Map<String, PlanPath> paths) {
        Map<String, PlanAgent> agents = new HashMap<>();
        for (PlanAgent agent : input.agents()) {
            agents.put(agent.id(), agent);
        }
        List<Conflict> sorted = new ArrayList<>(conflicts);
        sorted.sort(Comparator.comparingInt(Conflict::tick)
                .thenComparing((Conflict c) -> -c.maxPriority(agents))
                .thenComparing(Conflict::a1)
                .thenComparing(Conflict::a2));
        return sorted.getFirst();
    }

    private Constraint constraintFor(Conflict conflict, String id) {
        if (conflict.isVertex()) {
            return new Constraint.Vertex(id, conflict.cell(), conflict.tick());
        }
        Cell from = id.equals(conflict.a1()) ? conflict.cellPrev() : conflict.cell();
        Cell to = id.equals(conflict.a1()) ? conflict.cell() : conflict.cellPrev();
        return new Constraint.Edge(id, from, to, conflict.tick() - 1);
    }

    private PlanPath planAlone(PlanAgent agent, AgentConstraints constraints) {
        return new SpaceTimePlanner(input.floor(), agent, constraints, null, input.horizon(), 0, agent.due()).plan();
    }

    private PlanAgent agentOf(String id) {
        for (PlanAgent agent : input.agents()) {
            if (agent.id().equals(id)) {
                return agent;
            }
        }
        throw new IllegalArgumentException(id);
    }

    private int childSum(Map<String, PlanPath> paths) {
        int sum = 0;
        for (PlanPath path : paths.values()) {
            sum += path.arrival();
        }
        return sum;
    }

    private int makespan(Map<String, PlanPath> paths) {
        int worst = 0;
        for (PlanPath path : paths.values()) {
            worst = Math.max(worst, path.arrival());
        }
        return worst;
    }

    private Comparator<Node> comparator() {
        return Comparator.comparingInt(Node::sum)
                .thenComparing(Comparator.comparingInt(Node::cardinality).reversed())
                .thenComparingLong(Node::order);
    }

    private Solution failure(String reason) {
        return new Solution(Map.of(), 0, 0, 0, List.of(), false, reason);
    }
}
