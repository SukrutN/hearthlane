package dev.hearth.traffic;

import java.util.List;

/**
 * A granted window: the AMR may leave at {@code depart}, lands at
 * {@code arrive}, pays {@code detour} ticks over the straight run, and the
 * regions it crosses are named in the order crossed.
 */
public record WindowGrant(String amr, int depart, int arrive, int detour, List<String> regions) {}
