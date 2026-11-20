package dev.hearth.traffic.app;

import dev.hearth.traffic.DegradationLadder;
import dev.hearth.traffic.DensitySignal;
import dev.hearth.traffic.ReplicationStudy;

import java.util.List;

/** The report as a planner's margin sheet, for the CLI to print. */
public final class PlanReading {

    private PlanReading() {}

    public static String render(RunPlan.PlanReport report) {
        StringBuilder out = new StringBuilder();
        out.append(report.floorName()).append(" \u2014 ").append(report.floorId()).append("\n\n");

        out.append("Ladder\n");
        for (DegradationLadder.Rung rung : report.ladder()) {
            out.append("  ").append(pad(rung.solver(), 12));
            out.append("sum ").append(rung.solved() ? rung.sum() : "\u2014").append("  ");
            out.append("gap ").append(rung.gap() == null ? "\u2014" : rung.gap()).append("  ");
            out.append("expanded ").append(rung.expanded()).append("  ");
            if (rung.solved()) {
                out.append("solved");
            } else {
                out.append("unsolved: ").append(rung.reason());
            }
            out.append("\n");
        }

        out.append("\nArrivals\n");
        for (RunPlan.ArrivalRow row : report.arrivals()) {
            out.append("  ").append(pad(row.id() + " " + row.amr(), 16));
            out.append(pad(row.klass(), 9));
            out.append(row.start()).append(" \u2192 ").append(pad(row.goal(), 6));
            out.append("arrived ").append(row.arrived()).append(" of due ").append(row.due()).append("\n");
        }
        out.append("  served sum ").append(report.servedSum()).append(" \u00b7 makespan ")
                .append(report.makespan()).append("\n");

        out.append("\nDensity (buckets of 4 ticks)\n");
        for (DensitySignal row : report.density()) {
            out.append("  ").append(pad(row.region(), 15));
            out.append("ticks ").append(row.tickFrom()).append("\u2013").append(pad(row.tickTo() + "", 3));
            out.append("splits ").append(row.splits()).append("  cardinal ").append(row.cardinal()).append("\n");
        }

        out.append("\nReplications (8 seeded shuffles of the manifest order)\n");
        out.append("  correlation r = ").append(String.format("%.4f", report.replications().correlation()))
                .append(" between a region's density and its mean rejections\n");
        for (ReplicationStudy.RegionRow row : report.replications().regions()) {
            out.append("  ").append(pad(row.region(), 15));
            out.append("density ").append(row.density()).append("  mean rejections ")
                    .append(String.format("%.2f", row.meanRejections())).append("\n");
        }

        out.append("\nDeadline-hit rate by batch\n");
        for (RunPlan.CurveRow row : report.curve()) {
            out.append("  batch ").append(row.batch()).append("  ICBS ")
                    .append(row.icbsSolved() ? row.icbsSum() + " solved" : "unsolved");
            out.append("  prioritized ").append(row.prioritizedServed()).append("/").append(row.batch());
            out.append("  hit rate ").append(String.format("%.2f", row.hitRate())).append("\n");
        }

        out.append("\nGate journal\n");
        for (RunPlan.WindowRow row : report.windows()) {
            out.append("  ").append(row.id()).append("  ").append(row.decision());
            for (String reason : row.reasons()) {
                out.append("  ").append(reason);
            }
            out.append("\n      ").append(row.amr()).append(" ").append(row.klass()).append(" ")
                    .append(row.origin()).append(" \u2192 ").append(row.destination());
            out.append("  window ").append(row.earliest()).append("..").append(row.latest());
            if (row.verdict().grant() != null) {
                out.append("  granted: depart ").append(row.verdict().grant().depart());
                out.append(", arrive ").append(row.verdict().grant().arrive());
                out.append(", detour ").append(row.verdict().grant().detour());
            } else {
                out.append("  refused");
            }
            out.append("\n");
        }
        return out.toString();
    }

    private static String pad(String text, int width) {
        if (text.length() >= width) {
            return text + " ";
        }
        return text + " ".repeat(width - text.length());
    }
}
