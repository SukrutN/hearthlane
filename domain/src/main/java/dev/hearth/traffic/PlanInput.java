package dev.hearth.traffic;

import java.util.List;

/** The whole ask: a floor, the tasks on it, how long the plan may run, and the window asks to walk through. */
public record PlanInput(String floorId, String floorName, FloorGrid floor, List<PlanAgent> agents, int horizon,
        int seed, List<WindowRequest> windows) {

    public PlanInput(String floorId, String floorName, FloorGrid floor, List<PlanAgent> agents, int horizon, int seed) {
        this(floorId, floorName, floor, agents, horizon, seed, List.of());
    }

    public PlanInput {
        windows = List.copyOf(windows);
    }
}
