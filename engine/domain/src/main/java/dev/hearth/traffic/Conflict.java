package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * A collision two routes would have: standing on the same cell at the same
 * tick, or swapping cells between two ticks. {@code cellPrev} is null for a
 * vertex conflict; for a swap it holds the cell the first AMR left, and the
 * tick is the arrival both share.
 */
public record Conflict(String a1, String a2, int tick, Cell cell, Cell cellPrev) {

    public boolean isVertex() {
        return cellPrev == null;
    }

    public int maxPriority(Map<String, PlanAgent> agents) {
        int p1 = agents.get(a1).priority();
        int p2 = agents.get(a2).priority();
        return Math.max(p1, p2);
    }

    public static List<Conflict> among(Map<String, PlanPath> paths, int horizon) {
        List<String> ids = new ArrayList<>(paths.keySet());
        ids.sort(Comparator.naturalOrder());
        List<Conflict> out = new ArrayList<>();
        for (int i = 0; i < ids.size(); i++) {
            for (int j = i + 1; j < ids.size(); j++) {
                out.addAll(between(ids.get(i), paths.get(ids.get(i)), ids.get(j), paths.get(ids.get(j)), horizon));
            }
        }
        out.sort(Comparator.comparingInt(Conflict::tick)
                .thenComparing(Conflict::a1)
                .thenComparing(Conflict::a2)
                .thenComparing((Conflict c) -> c.cellPrev == null ? "" : c.cellPrev.key()));
        return out;
    }

    public static List<Conflict> between(String id1, PlanPath p1, String id2, PlanPath p2, int horizon) {
        List<Conflict> out = new ArrayList<>();
        for (int tick = 0; tick <= horizon; tick++) {
            if (p1.positionAt(tick).equals(p2.positionAt(tick))) {
                out.add(new Conflict(id1, id2, tick, p1.positionAt(tick), null));
            }
        }
        for (int tick = 1; tick <= horizon; tick++) {
            Cell prev1 = p1.positionAt(tick - 1);
            Cell now1 = p1.positionAt(tick);
            Cell prev2 = p2.positionAt(tick - 1);
            Cell now2 = p2.positionAt(tick);
            if (!prev1.equals(now1) && prev1.equals(now2) && now1.equals(prev2)) {
                out.add(new Conflict(id1, id2, tick, now1, prev1));
            }
        }
        return out;
    }
}
