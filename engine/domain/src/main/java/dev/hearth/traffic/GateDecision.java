package dev.hearth.traffic;

import java.util.List;

/**
 * The release gate's call on one window request: fire the AMR, or hesitate
 * and hold the manifest, with the journal of why, verbatim.
 */
public record GateDecision(String requestId, String decision, List<String> reasons, WindowVerdict verdict) {}
