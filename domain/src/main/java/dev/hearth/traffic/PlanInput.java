package dev.hearth.traffic;

import java.util.List;

/** The whole ask: a floor, the tasks on it, and how long the plan may run. */
public record PlanInput(String floorId, String floorName, FloorGrid floor, List<PlanAgent> agents, int horizon, int seed) {}
