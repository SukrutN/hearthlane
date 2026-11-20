package dev.hearth.traffic;

/**
 * One ask from the orchestrator: a class of AMR wants to run a route between
 * the given ticks. The id names the ask; the class sets the priority.
 */
public record WindowRequest(String id, String amr, String klass, Cell origin, Cell destination,
        int earliest, int latest) {}
