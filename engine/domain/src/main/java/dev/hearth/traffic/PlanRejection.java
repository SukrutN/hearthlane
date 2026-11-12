package dev.hearth.traffic;

import java.util.List;

/** The document could not become a plan. The reasons read like a planner's margin notes. */
public class PlanRejection extends RuntimeException {

    private final List<String> reasons;

    public PlanRejection(List<String> reasons) {
        super(String.join(" ", reasons));
        this.reasons = List.copyOf(reasons);
    }

    public List<String> reasons() {
        return reasons;
    }
}
