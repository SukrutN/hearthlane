package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/**
 * The low-level search: one AMR, space and time, waiting allowed. Constraints
 * from the conflict tree and reservations from earlier traffic both apply.
 * A due tick prunes every state that could no longer arrive in time.
 */
public final class SpaceTimePlanner {

    private final FloorGrid floor;
    private final PlanAgent agent;
    private final AgentConstraints constraints;
    private final ReservationTable reservations;
    private final int horizon;
    private final int notBefore;
    private final Integer due;
    private final Map<String, Integer> rejections = new HashMap<>();
    private int expansions;

    public SpaceTimePlanner(
            FloorGrid floor,
            PlanAgent agent,
            AgentConstraints constraints,
            ReservationTable reservations,
            int horizon,
            int notBefore,
            Integer due) {
        this.floor = floor;
        this.agent = agent;
        this.constraints = constraints;
        this.reservations = reservations;
        this.horizon = horizon;
        this.notBefore = notBefore;
        this.due = due;
    }

    /** The route, or null when nothing inside the deadline reaches the goal. */
    public PlanPath plan() {
        Map<String, String> parent = new HashMap<>();
        Map<String, Integer> best = new HashMap<>();
        PriorityQueue<int[]> open = new PriorityQueue<>((a, b) -> {
            if (a[2] != b[2]) {
                return a[2] - b[2];
            }
            if (a[3] != b[3]) {
                return a[3] - b[3];
            }
            return a[4] - b[4];
        });
        Cell start = agent.start();
        Cell goal = agent.goal();
        open.add(state(start, 0, goal));
        best.put(start.key() + "@" + 0, 0);
        while (!open.isEmpty()) {
            int[] current = open.poll();
            Cell cell = new Cell(current[0], current[1]);
            int tick = current[5];
            String key = cell.key() + "@" + tick;
            if (best.getOrDefault(key, Integer.MAX_VALUE) < tick) {
                continue;
            }
            if (isGoal(cell, tick, goal)) {
                List<Cell> stops = rebuild(parent, key, cell);
                return new PlanPath(stops, tick, horizon);
            }
            expansions++;
            for (Cell next : nextCells(cell, tick)) {
                int arrive = tick + 1;
                if (arrive > horizon) {
                    continue;
                }
                if (!floor.open(next)) {
                    continue;
                }
                if (due != null && arrive + next.manhattan(agent.goal()) > due) {
                    continue;
                }
                if (constraints.vertexForbidden(next, arrive)) {
                    continue;
                }
                if (constraints.edgeForbidden(cell, next, tick)) {
                    continue;
                }
                if (reservations != null) {
                    if (reservations.vertexClaimed(next, arrive)) {
                        reject(floor.regionOf(next));
                        continue;
                    }
                    if (reservations.edgeClaimed(cell, next, tick) || reservations.edgeClaimed(next, cell, tick)) {
                        reject(floor.regionOf(cell));
                        continue;
                    }
                    if (reservations.goalClaimed(next, arrive) && !next.equals(goal)) {
                        reject(floor.regionOf(next));
                        continue;
                    }
                }
                String nextKey = next.key() + "@" + arrive;
                if (best.getOrDefault(nextKey, Integer.MAX_VALUE) <= arrive) {
                    continue;
                }
                best.put(nextKey, arrive);
                parent.put(nextKey, key);
                open.add(state(next, arrive, goal));
            }
        }
        return null;
    }

    public int expansions() {
        return expansions;
    }

    /** Where earlier traffic pushed this AMR around, by region. */
    public Map<String, Integer> rejections() {
        return Map.copyOf(rejections);
    }

    private void reject(String region) {
        rejections.merge(region, 1, Integer::sum);
    }

    private boolean isGoal(Cell cell, int tick, Cell goal) {
        if (!cell.equals(goal)) {
            return false;
        }
        if (due != null && tick > due) {
            return false;
        }
        for (int later = tick; later <= horizon; later++) {
            if (constraints.vertexForbidden(goal, later)) {
                return false;
            }
        }
        if (reservations != null && reservations.goalClaimed(goal, horizon)) {
            return false;
        }
        return true;
    }

    private List<Cell> nextCells(Cell cell, int tick) {
        List<Cell> moves = new ArrayList<>();
        moves.add(cell);
        if (tick >= notBefore) {
            moves.addAll(floor.neighbors(cell));
        }
        return moves;
    }

    private int[] state(Cell cell, int tick, Cell goal) {
        int manhattan = cell.manhattan(goal);
        int dueBound = due == null ? horizon : due;
        return new int[] {cell.row(), cell.col(), tick + manhattan, manhattan, expansions, tick};
    }

    private List<Cell> rebuild(Map<String, String> parent, String key, Cell cell) {
        List<Cell> stops = new ArrayList<>();
        stops.add(cell);
        String at = key;
        while (parent.containsKey(at)) {
            at = parent.get(at);
            String[] parts = at.split("@");
            String[] rc = parts[0].split(",");
            stops.add(new Cell(Integer.parseInt(rc[0]), Integer.parseInt(rc[1])));
        }
        return reversed(stops);
    }

    private static List<Cell> reversed(List<Cell> stops) {
        List<Cell> out = new ArrayList<>();
        for (int index = stops.size() - 1; index >= 0; index--) {
            out.add(stops.get(index));
        }
        return out;
    }
}
