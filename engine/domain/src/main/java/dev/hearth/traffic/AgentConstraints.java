package dev.hearth.traffic;

import java.util.HashSet;
import java.util.Set;

/** The constraints one agent carries in one CBS node. Small copies; the trees are shallow. */
public record AgentConstraints(Set<Constraint> items) {

    public static AgentConstraints none() {
        return new AgentConstraints(new HashSet<>());
    }

    public AgentConstraints with(Constraint constraint) {
        Set<Constraint> items = new HashSet<>(this.items);
        items.add(constraint);
        return new AgentConstraints(items);
    }

    public boolean vertexForbidden(Cell cell, int tick) {
        for (Constraint item : items) {
            if (item instanceof Constraint.Vertex vertex && vertex.cell().equals(cell) && vertex.tick() == tick) {
                return true;
            }
        }
        return false;
    }

    public boolean edgeForbidden(Cell from, Cell to, int tick) {
        for (Constraint item : items) {
            if (item instanceof Constraint.Edge edge && edge.from().equals(from) && edge.to().equals(to)
                    && edge.tick() == tick) {
                return true;
            }
        }
        return false;
    }
}
