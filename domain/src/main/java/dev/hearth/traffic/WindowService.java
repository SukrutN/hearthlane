package dev.hearth.traffic;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The window desk: the orchestrator asks, the planner answers against the
 * traffic already booked, and the release gate turns the answer into a call —
 * fire the AMR, or hesitate and journal the reason.
 */
public final class WindowService {

    private WindowService() {}

    public static WindowVerdict verdict(PlanInput input, Map<String, PlanPath> snapshot, WindowRequest request) {
        List<String> reasons = new ArrayList<>();
        if (!input.floor().open(request.origin())) {
            reasons.add("No open cell is marked " + request.origin().key() + " for the run to start on.");
        }
        if (!input.floor().open(request.destination())) {
            reasons.add("No open cell is marked " + request.destination().key() + " for the run to reach.");
        }
        if (request.latest() > input.horizon()) {
            reasons.add("The window closes at tick " + request.latest() + ", past the horizon of "
                    + input.horizon() + ".");
        }
        if (request.earliest() > request.latest()) {
            reasons.add("The window opens after it closes.");
        }
        if (!reasons.isEmpty()) {
            return new WindowVerdict(false, null, new SloViolation(request.amr(), null, reasons));
        }
        ReservationTable table = new ReservationTable();
        for (PlanPath path : snapshot.values()) {
            table.reserve(path, input.horizon());
        }
        PlanAgent agent = new PlanAgent(request.id(), request.amr(), request.klass(), request.origin(),
                request.destination(), request.latest());
        PlanPath path = new SpaceTimePlanner(input.floor(), agent, AgentConstraints.none(), table,
                input.horizon(), request.earliest(), request.latest()).plan();
        if (path != null) {
            int depart = depart(path);
            int detour = path.arrival() - request.origin().manhattan(request.destination());
            return new WindowVerdict(true, new WindowGrant(request.amr(), depart, path.arrival(), detour,
                    regionsCrossed(input, path)), null);
        }
        PlanPath best = new SpaceTimePlanner(input.floor(), agent, AgentConstraints.none(), table,
                input.horizon(), request.earliest(), null).plan();
        Integer earliestArrival = best == null ? null : best.arrival();
        reasons.add("The window closes at tick " + request.latest() + " before the run can land.");
        if (earliestArrival != null) {
            reasons.add("Under today's traffic the earliest arrival is tick " + earliestArrival + ".");
        } else {
            reasons.add("No route stands open from " + request.origin().key() + " to "
                    + request.destination().key() + ".");
        }
        return new WindowVerdict(false, null, new SloViolation(request.amr(), earliestArrival, reasons));
    }

    /**
     * Fire iff the window is granted and the departure region carries no
     * cardinal density in the departure bucket; otherwise hesitate, with the
     * journal of why.
     */
    public static GateDecision gate(PlanInput input, Map<String, PlanPath> snapshot,
            List<ConflictSolver.Split> splits, WindowRequest request) {
        WindowVerdict verdict = verdict(input, snapshot, request);
        if (!verdict.granted()) {
            return new GateDecision(request.id(), "hesitate", verdict.slo().reasons(), verdict);
        }
        String region = input.floor().regionOf(request.origin());
        int bucket = verdict.grant().depart() / DensitySignal.BUCKET;
        int hottest = splits.stream()
                .filter(split -> split.region().equals(region) && split.tick() / DensitySignal.BUCKET == bucket)
                .mapToInt(ConflictSolver.Split::cardinality)
                .max()
                .orElse(0);
        if (hottest > 0) {
            int from = bucket * DensitySignal.BUCKET;
            String span = from + "\u2013" + (from + DensitySignal.BUCKET - 1);
            return new GateDecision(request.id(), "hesitate",
                    List.of("The " + region + " carries conflict density in ticks " + span + "."), verdict);
        }
        return new GateDecision(request.id(), "fire",
                List.of("The window is granted and the " + region + " is clear at the departure."), verdict);
    }

    private static int depart(PlanPath path) {
        Cell origin = path.start();
        for (int tick = 0; tick <= path.arrival(); tick++) {
            if (!path.positionAt(tick).equals(origin)) {
                return tick - 1 < 0 ? 0 : tick - 1;
            }
        }
        return 0;
    }

    private static List<String> regionsCrossed(PlanInput input, PlanPath path) {
        List<String> out = new ArrayList<>();
        for (int tick = 0; tick <= path.arrival(); tick++) {
            String region = input.floor().regionOf(path.positionAt(tick));
            if (!out.contains(region)) {
                out.add(region);
            }
        }
        return out;
    }
}
