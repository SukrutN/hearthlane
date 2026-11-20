package dev.hearth.traffic;

import java.util.List;

/**
 * The window could not be served inside its service level. The report says
 * what the best achievable arrival would be — null when no route stands at
 * all — and spells out the reasons.
 */
public record SloViolation(String amr, Integer earliestArrival, List<String> reasons) {}
