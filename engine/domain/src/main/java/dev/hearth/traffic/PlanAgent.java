package dev.hearth.traffic;

/**
 * One move on the manifest: an AMR carries its load from a cell to a cell.
 * The class sets the priority and the due tick sets the deadline.
 */
public record PlanAgent(String id, String amr, String klass, Cell start, Cell goal, Integer due) {

    public int priority() {
        return switch (klass) {
            case "express" -> 2;
            case "standard" -> 1;
            case "bulk" -> 0;
            default -> throw new IllegalStateException(klass);
        };
    }
}
