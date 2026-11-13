package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** The structural checks a floor document must pass before any search runs. */
public final class PlanRules {

    private PlanRules() {}

    public static void validate(PlanInput input) {
        List<String> reasons = new ArrayList<>();
        if (input.floorId() == null || input.floorId().isBlank()) {
            reasons.add("The floor has no id.");
        }
        if (input.floor().width() < 1 || input.floor().width() > 64 || input.floor().height() < 1
                || input.floor().height() > 64) {
            reasons.add("The floor is not a grid the planner will walk.");
        }
        if (input.horizon() < 1 || input.horizon() > 512) {
            reasons.add("The horizon must sit between 1 and 512 ticks.");
        }
        Set<String> ids = new HashSet<>();
        Set<Cell> starts = new HashSet<>();
        Set<Cell> goals = new HashSet<>();
        int longest = 0;
        for (PlanAgent agent : input.agents()) {
            if (agent.id() == null || agent.id().isBlank()) {
                reasons.add("A task has no id.");
            } else if (!ids.add(agent.id())) {
                reasons.add("Two tasks answer to " + agent.id() + ".");
            }
            if (!Set.of("express", "standard", "bulk").contains(agent.klass())) {
                reasons.add(agent.id() + " carries an unknown class " + agent.klass() + ".");
            }
            if (!input.floor().open(agent.start())) {
                reasons.add("No open cell is marked " + agent.start().key() + " for " + agent.id() + " to start on.");
            }
            if (!input.floor().open(agent.goal())) {
                reasons.add("No open cell is marked " + agent.goal().key() + " for " + agent.id() + " to reach.");
            }
            if (!starts.add(agent.start())) {
                reasons.add("Two tasks start on " + agent.start().key() + ".");
            }
            if (!goals.add(agent.goal())) {
                reasons.add("Two tasks aim for " + agent.goal().key() + ".");
            }
            int solo = agent.start().manhattan(agent.goal());
            longest = Math.max(longest, solo);
            if (agent.due() != null && agent.due() < solo) {
                reasons.add(agent.amr() + " cannot beat a due of " + agent.due() + "; the run alone needs " + solo
                        + " ticks.");
            }
        }
        if (input.horizon() < longest) {
            reasons.add("The horizon cannot fit the longest run, which needs " + longest + " ticks.");
        }
        if (!reasons.isEmpty()) {
            throw new PlanRejection(reasons);
        }
    }
}
