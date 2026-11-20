package dev.hearth.traffic;

/**
 * Exactly one of the two halves is present: a grant when the window could be
 * reserved, an SLO report when it could not.
 */
public record WindowVerdict(boolean granted, WindowGrant grant, SloViolation slo) {}
