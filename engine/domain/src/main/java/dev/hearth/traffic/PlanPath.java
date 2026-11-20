package dev.hearth.traffic;

import java.util.List;

/**
 * One AMR's route: a cell per tick until the goal is reached, then parked.
 * The arrival tick is the route's price; waits are free moves that spend time.
 */
public record PlanPath(List<Cell> stops, int arrival, int horizon) {

    public PlanPath {
        stops = List.copyOf(stops);
    }

    public Cell start() {
        return stops.getFirst();
    }

    public Cell goal() {
        return stops.getLast();
    }

    public Cell positionAt(int tick) {
        if (tick < 0 || tick > horizon) {
            throw new IllegalArgumentException("tick " + tick + " outside the horizon " + horizon);
        }
        return tick <= arrival ? stops.get(tick) : goal();
    }

    public int sumCost() {
        return arrival;
    }
}
