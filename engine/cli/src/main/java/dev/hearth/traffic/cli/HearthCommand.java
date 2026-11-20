package dev.hearth.traffic.cli;

import dev.hearth.traffic.PlanRejection;
import dev.hearth.traffic.app.HearthJson;
import dev.hearth.traffic.app.PlanReading;
import dev.hearth.traffic.app.RunPlan;
import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Path;

/** `hearth plan <fixture.json>` and `hearth windows <fixture.json>` print what the planner owes. */
public final class HearthCommand {

    private HearthCommand() {}

    public static void main(String[] args) {
        System.exit(run(args, System.out, System.err));
    }

    public static int run(String[] args, PrintStream out, PrintStream err) {
        if (args.length == 1 && ("--help".equals(args[0]) || "-h".equals(args[0]) || "help".equals(args[0]))) {
            usage(out);
            return 0;
        }
        if (args.length == 2 && "plan".equals(args[0])) {
            return plan(args[1], out, err);
        }
        if (args.length == 2 && "windows".equals(args[0])) {
            return windows(args[1], out, err);
        }
        usage(err);
        return 2;
    }

    private static int plan(String arg, PrintStream out, PrintStream err) {
        try {
            out.print(PlanReading.render(RunPlan.plan(read(arg))));
            return 0;
        } catch (PlanRejection rejection) {
            err.println(rejection.getMessage());
            return 2;
        } catch (Exception exception) {
            err.println(exception.getMessage());
            return 2;
        }
    }

    private static int windows(String arg, PrintStream out, PrintStream err) {
        try {
            RunPlan.PlanReport report = RunPlan.plan(read(arg));
            StringBuilder text = new StringBuilder();
            for (RunPlan.WindowRow row : report.windows()) {
                text.append(row.id()).append("  ").append(row.decision());
                for (String reason : row.reasons()) {
                    text.append("  ").append(reason);
                }
                text.append("\n    ").append(row.amr()).append(" ").append(row.klass()).append(" ")
                        .append(row.origin()).append(" \u2192 ").append(row.destination());
                text.append("  window ").append(row.earliest()).append("..").append(row.latest());
                if (row.verdict().grant() != null) {
                    text.append("  granted: depart ").append(row.verdict().grant().depart());
                    text.append(", arrive ").append(row.verdict().grant().arrive());
                    text.append(", detour ").append(row.verdict().grant().detour());
                    text.append("\n    regions crossed: ")
                            .append(String.join(" \u00b7 ", row.verdict().grant().regions()));
                } else {
                    text.append("  refused");
                    for (String reason : row.verdict().slo().reasons()) {
                        text.append("\n    ").append(reason);
                    }
                }
                text.append("\n");
            }
            out.print(text);
            return 0;
        } catch (PlanRejection rejection) {
            err.println(rejection.getMessage());
            return 2;
        } catch (Exception exception) {
            err.println(exception.getMessage());
            return 2;
        }
    }

    private static dev.hearth.traffic.PlanInput read(String arg) throws Exception {
        Path path = Path.of(arg);
        if (!Files.isRegularFile(path)) {
            throw new PlanRejection(java.util.List.of("Could not read " + path + "."));
        }
        return HearthJson.parse(Files.readString(path));
    }

    private static void usage(PrintStream stream) {
        stream.println("usage: hearth plan <fixture.json> | hearth windows <fixture.json>");
    }
}
