package dev.hearth.traffic;

/** What one agent is forbidden to do at one moment. */
public sealed interface Constraint {

    /** The agent may not stand on the cell at the tick. */
    record Vertex(String agent, Cell cell, int tick) implements Constraint {}

    /** The agent may not leave the first cell toward the second at the tick. */
    record Edge(String agent, Cell from, Cell to, int tick) implements Constraint {}
}
