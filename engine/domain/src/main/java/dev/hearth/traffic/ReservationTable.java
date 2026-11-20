package dev.hearth.traffic;

import java.util.HashSet;
import java.util.Set;

/**
 * What already-planned traffic holds: cells claimed at ticks, moves claimed
 * between ticks, and goals claimed from an arrival onward. The prioritized
 * planner and the window desk read one of these.
 */
public final class ReservationTable {

    private record VertexClaim(Cell cell, int tick) {}
    private record EdgeClaim(Cell from, Cell to, int tick) {}
    private record GoalClaim(Cell cell, int from) {}

    private final Set<VertexClaim> vertices = new HashSet<>();
    private final Set<EdgeClaim> edges = new HashSet<>();
    private final Set<GoalClaim> goals = new HashSet<>();

    public void reserve(PlanPath path, int horizon) {
        Cell cell = path.positionAt(0);
        vertices.add(new VertexClaim(cell, 0));
        for (int tick = 1; tick <= horizon; tick++) {
            Cell next = path.positionAt(tick);
            if (!next.equals(cell)) {
                edges.add(new EdgeClaim(cell, next, tick - 1));
            }
            vertices.add(new VertexClaim(next, tick));
            cell = next;
        }
        goals.add(new GoalClaim(path.goal(), path.arrival()));
    }

    public boolean vertexClaimed(Cell cell, int tick) {
        return vertices.contains(new VertexClaim(cell, tick));
    }

    public boolean edgeClaimed(Cell from, Cell to, int tick) {
        return edges.contains(new EdgeClaim(from, to, tick));
    }

    public boolean goalClaimed(Cell cell, int atOrAfter) {
        return goals.stream().anyMatch(claim -> claim.cell().equals(cell) && claim.from() <= atOrAfter);
    }
}
