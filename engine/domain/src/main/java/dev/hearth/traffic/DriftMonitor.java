package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The drift monitor: the plan's promise against the floor's reality.
 *
 * The plan says where each AMR stands at every tick. An observation says
 * where one AMR actually stood at one tick. The monitor compares the two
 * and names every disagreement in words: an AMR standing where its route
 * never goes (off-route), an AMR whose straight-line arrival now slips past
 * the plan's (late), an AMR ahead of its route (early, still worth saying),
 * and two AMRs sharing a cell the plan kept apart (a collision risk).
 *
 * The repair re-solves from the observations with the clock shifted: every
 * AMR starts from where it was last seen, every due loses the ticks already
 * spent, and the horizon shrinks by the same amount. An AMR whose due has
 * already passed is still planned, and named as late whatever the tree
 * finds, because that is the truth. The repair's delta is reported
 * honestly: the arrivals that moved, the AMRs now past their dues, and
 * whether the makespan grew.
 */
public final class DriftMonitor {

    /** One AMR's position as the floor saw it. */
    public record Observation(String id, int tick, Cell at) {}

    /** One disagreement between the plan and the floor. */
    public record Violation(String id, String kind, int tick, String detail) {}

    /** The comparison: the counts, every violation, and who has arrived. */
    public record Reading(int observed, int onPlan, List<Violation> violations, List<String> arrivedIds) {}

    /** The repair: the re-seeded plan, its paths, and the honest delta. */
    public record Repair(
            Map<String, PlanPath> paths,
            int servedSum,
            int makespan,
            List<String> lateIds,
            int oldMakespan,
            String verdict) {}

    private DriftMonitor() {}

    /**
     * Compares observations against the plan. Each AMR's latest observation
     * is its position; observations naming AMRs the plan does not carry, or
     * standing on cells the floor does not open, are refused in words.
     */
    public static Reading compare(Map<String, PlanPath> paths, PlanInput input, List<Observation> observations) {
        Map<String, Observation> latest = latestByAgent(observations);
        checkKnown(paths, input, latest);

        List<Violation> violations = new ArrayList<>();
        List<String> arrived = new ArrayList<>();
        int onPlan = 0;

        for (Map.Entry<String, Observation> entry : latest.entrySet()) {
            String id = entry.getKey();
            Observation seen = entry.getValue();
            PlanPath path = paths.get(id);

            if (seen.at().equals(path.goal())) {
                arrived.add(id);
                if (path.arrival() <= seen.tick()) {
                    onPlan++;
                    continue; // standing on the goal is the route's end
                }
                // on the goal but early: the plan has it arriving later
                violations.add(new Violation(id, "early", seen.tick(),
                        id + " is already standing on its goal " + seen.at().key()
                                + " at tick " + seen.tick() + ", ahead of the planned arrival of "
                                + path.arrival() + "."));
                continue;
            }

            Cell planned = path.positionAt(seen.tick());
            if (planned.equals(seen.at())) {
                onPlan++;
                continue;
            }

            int plannedArrival = path.arrival();
            int eta = seen.tick() + seen.at().manhattan(path.goal());
            if (path.stops().contains(seen.at())) {
                String kind = eta > plannedArrival ? "late" : "early";
                violations.add(new Violation(id, kind, seen.tick(),
                        id + " is " + kind + " on its route at tick " + seen.tick()
                                + " (" + seen.at().key() + " instead of " + planned.key()
                                + "); the straight-line arrival is now tick " + eta
                                + " against a planned arrival of " + plannedArrival + "."));
            } else {
                violations.add(new Violation(id, "off-route", seen.tick(),
                        id + " was observed at " + seen.at().key() + " at tick " + seen.tick()
                                + ", a cell its route never visits (the plan puts it at "
                                + planned.key() + "); the straight-line arrival is now tick " + eta + "."));
            }
        }

        // a collision the plan kept apart: two observed AMRs on one cell
        Map<Cell, List<String>> together = new LinkedHashMap<>();
        for (Map.Entry<String, Observation> entry : latest.entrySet()) {
            together.computeIfAbsent(entry.getValue().at(), cell -> new ArrayList<>())
                    .add(entry.getKey());
        }
        for (Map.Entry<Cell, List<String>> entry : together.entrySet()) {
            if (entry.getValue().size() > 1) {
                int tick = latest.get(entry.getValue().getFirst()).tick();
                violations.add(new Violation(
                        String.join("+", entry.getValue()),
                        "collision",
                        tick,
                        entry.getValue().size() + " AMRs (" + String.join(", ", entry.getValue())
                                + ") were observed sharing cell " + entry.getKey().key()
                                + ", which the plan kept apart."));
            }
        }

        return new Reading(latest.size(), onPlan, List.copyOf(violations), List.copyOf(arrived));
    }

    /**
     * Re-solves from the observations with the clock shifted to the latest
     * observed tick: starts become the observed cells, dues and the horizon
     * lose the spent ticks, and an AMR already past its due is planned with
     * the tightest due the floor can still honor and named as late.
     */
    public static Repair repair(Map<String, PlanPath> paths, PlanInput input, List<Observation> observations) {
        Map<String, Observation> latest = latestByAgent(observations);
        checkKnown(paths, input, latest);
        int atTick = latest.values().stream().mapToInt(Observation::tick).max().orElse(0);

        List<PlanAgent> reseeded = new ArrayList<>();
        for (PlanAgent agent : input.agents()) {
            Observation seen = latest.get(agent.id());
            Cell start = seen != null ? seen.at() : paths.get(agent.id()).positionAt(atTick);
            int solo = start.manhattan(agent.goal());
            // the remaining budget; an already-spent due tightens to the
            // floor's minimum so the search can still run, and the verdict
            // names the AMR as late regardless
            Integer due = agent.due() == null ? null : Math.max(agent.due() - atTick, solo);
            reseeded.add(new PlanAgent(agent.id(), agent.amr(), agent.klass(), start, agent.goal(), due));
        }

        int horizon = Math.max(input.horizon() - atTick, 1);
        PlanInput next = new PlanInput(input.floorId(), input.floorName(), input.floor(),
                reseeded, horizon, input.seed());
        ConflictSolver.Solution solved = new ConflictSolver(next, ConflictSolver.Mode.IMPROVED).solve();
        if (!solved.solved()) {
            throw new PlanRejection(List.of(
                    "The repair itself cannot be served: " + solved.reason()
                            + " The floor cannot keep the manifest from where the AMRs now stand."));
        }

        Map<String, PlanPath> repaired = solved.paths();
        int newSum = repaired.values().stream().mapToInt(PlanPath::sumCost).sum();
        int newMakespan = repaired.values().stream().mapToInt(PlanPath::sumCost).max().orElse(0);
        int oldMakespan = paths.values().stream().mapToInt(PlanPath::sumCost).max().orElse(0);
        List<String> late = new ArrayList<>();
        for (PlanAgent agent : input.agents()) {
            int arrival = repaired.get(agent.id()).arrival();
            int budget = agent.due() == null ? Integer.MAX_VALUE : agent.due() - atTick;
            if (arrival > budget) {
                late.add(agent.id());
            }
        }
        String verdict;
        String span = "the remaining makespan is " + newMakespan + " tick"
                + (newMakespan == 1 ? "" : "s") + " against the original " + oldMakespan
                + ", with " + atTick + " already spent";
        if (late.isEmpty() && newMakespan <= oldMakespan) {
            verdict = "The repair keeps every deadline; " + span + ".";
        } else if (late.isEmpty()) {
            verdict = "The repair keeps every deadline, but the work lengthens: "
                    + "the remaining makespan is " + newMakespan + " against the original "
                    + oldMakespan + ", with " + atTick + " ticks already spent.";
        } else {
            verdict = "The repair cannot keep every deadline: " + String.join(", ", late)
                    + " now lands past its due, and " + span + ".";
        }
        return new Repair(repaired, newSum, newMakespan, List.copyOf(late), oldMakespan, verdict);
    }

    private static void checkKnown(Map<String, PlanPath> paths, PlanInput input, Map<String, Observation> latest) {
        for (Map.Entry<String, Observation> entry : latest.entrySet()) {
            String id = entry.getKey();
            Observation seen = entry.getValue();
            if (!paths.containsKey(id)) {
                throw new PlanRejection(List.of(
                        "An observation names " + id + ", which the plan does not carry."));
            }
            if (!input.floor().open(seen.at())) {
                throw new PlanRejection(List.of(
                        id + " was observed on cell " + seen.at().key()
                                + ", which is not an open cell on this floor."));
            }
        }
    }

    /** Each AMR's latest observation; later observations win, blanks refuse. */
    private static Map<String, Observation> latestByAgent(List<Observation> observations) {
        if (observations == null || observations.isEmpty()) {
            throw new PlanRejection(List.of(
                    "Send at least one observation: the AMR id, the tick, and the cell it stood on."));
        }
        Map<String, Observation> latest = new LinkedHashMap<>();
        for (Observation seen : observations) {
            if (seen.id() == null || seen.id().isBlank()) {
                throw new PlanRejection(List.of("Every observation needs an AMR id."));
            }
            if (seen.at() == null) {
                throw new PlanRejection(List.of("The observation for " + seen.id() + " carries no cell."));
            }
            if (seen.tick() < 0) {
                throw new PlanRejection(List.of(
                        "The observation for " + seen.id() + " carries a negative tick."));
            }
            Observation prior = latest.get(seen.id());
            if (prior == null || prior.tick() <= seen.tick()) {
                latest.put(seen.id(), seen);
            }
        }
        return latest;
    }
}
