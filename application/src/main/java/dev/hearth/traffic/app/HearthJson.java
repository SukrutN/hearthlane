package dev.hearth.traffic.app;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hearth.traffic.Cell;
import dev.hearth.traffic.FloorGrid;
import dev.hearth.traffic.PlanAgent;
import dev.hearth.traffic.PlanInput;
import dev.hearth.traffic.PlanRejection;
import dev.hearth.traffic.WindowRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * The face of a floor document. Strict: every field is expected, nothing is
 * guessed, and a malformed document is refused with reasons that name the
 * offending line of the ask.
 */
public final class HearthJson {

    private static final Set<String> FLOOR_FIELDS = Set.of("id", "name", "width", "height", "runs");
    private static final Set<String> RUN_FIELDS = Set.of("region", "row", "col", "from", "to");
    private static final Set<String> TASK_FIELDS = Set.of("id", "amr", "klass", "start", "goal", "due");
    private static final Set<String> TOP_FIELDS = Set.of("floor", "tasks", "horizon", "seed", "windows");
    private static final Set<String> WINDOW_FIELDS = Set.of("id", "amr", "klass", "origin", "destination",
            "earliest", "latest");

    private HearthJson() {}

    public static PlanInput parse(String text) {
        JsonNode root;
        try {
            root = new ObjectMapper().readTree(text);
        } catch (Exception e) {
            throw new PlanRejection(List.of("The document is not JSON the planner can read: " + e.getMessage()));
        }
        List<String> reasons = new ArrayList<>();
        if (root == null || !root.isObject()) {
            throw new PlanRejection(List.of("The document must be an object with floor, tasks, horizon, and seed."));
        }
        checkFields(root, TOP_FIELDS, "The document", reasons);
        if (!root.has("floor") || !root.get("floor").isObject()) {
            reasons.add("The document needs a floor object.");
        }
        if (!root.has("tasks") || !root.get("tasks").isArray() || root.get("tasks").isEmpty()) {
            reasons.add("The document needs a tasks array with at least one task.");
        }
        if (!root.has("horizon") || !root.get("horizon").isInt()) {
            reasons.add("The document needs an integer horizon.");
        }
        if (!root.has("seed") || !root.get("seed").isInt()) {
            reasons.add("The document needs an integer seed.");
        }
        if (!reasons.isEmpty()) {
            throw new PlanRejection(reasons);
        }

        JsonNode floorNode = root.get("floor");
        checkFields(floorNode, FLOOR_FIELDS, "The floor", reasons);
        if (!floorNode.has("id") || !floorNode.get("id").isTextual() || floorNode.get("id").asText().isBlank()) {
            reasons.add("The floor needs a textual id.");
        }
        if (!floorNode.has("name") || !floorNode.get("name").isTextual() || floorNode.get("name").asText().isBlank()) {
            reasons.add("The floor needs a textual name.");
        }
        if (!floorNode.has("width") || !floorNode.get("width").isInt()) {
            reasons.add("The floor needs an integer width.");
        }
        if (!floorNode.has("height") || !floorNode.get("height").isInt()) {
            reasons.add("The floor needs an integer height.");
        }
        if (!floorNode.has("runs") || !floorNode.get("runs").isArray() || floorNode.get("runs").isEmpty()) {
            reasons.add("The floor needs a runs array; every open cell comes from a run.");
        }
        if (!reasons.isEmpty()) {
            throw new PlanRejection(reasons);
        }

        int width = floorNode.get("width").asInt();
        int height = floorNode.get("height").asInt();
        List<FloorGrid.Run> runs = new ArrayList<>();
        int index = 0;
        for (JsonNode runNode : floorNode.get("runs")) {
            index++;
            checkFields(runNode, RUN_FIELDS, "Run " + index, reasons);
            if (!runNode.has("region") || !runNode.get("region").isTextual()
                    || runNode.get("region").asText().isBlank()) {
                reasons.add("Run " + index + " needs a textual region.");
            }
            boolean hasRow = runNode.has("row") && runNode.get("row").isInt();
            boolean hasCol = runNode.has("col") && runNode.get("col").isInt();
            if (hasRow == hasCol) {
                reasons.add("Run " + index + " needs exactly one of row or col.");
            }
            if (!runNode.has("from") || !runNode.get("from").isInt() || !runNode.has("to")
                    || !runNode.get("to").isInt()) {
                reasons.add("Run " + index + " needs integer from and to.");
            }
            if (hasRow) {
                int row = runNode.get("row").asInt();
                if (row < 0 || row >= height) {
                    reasons.add("Run " + index + " names row " + row + ", outside the floor of " + height + " rows.");
                }
            }
            if (hasCol) {
                int col = runNode.get("col").asInt();
                if (col < 0 || col >= width) {
                    reasons.add("Run " + index + " names col " + col + ", outside the floor of " + width + " cols.");
                }
            }
            if (runNode.has("from") && runNode.get("from").isInt() && runNode.has("to") && runNode.get("to").isInt()) {
                if (runNode.get("from").asInt() > runNode.get("to").asInt()) {
                    reasons.add("Run " + index + " runs from " + runNode.get("from").asInt() + " to "
                            + runNode.get("to").asInt() + ", backwards.");
                }
            }
            runs.add(new FloorGrid.Run(
                    runNode.path("region").asText(null),
                    hasRow ? runNode.get("row").asInt() : null,
                    hasCol ? runNode.get("col").asInt() : null,
                    runNode.path("from").asInt(0),
                    runNode.path("to").asInt(0)));
        }

        List<PlanAgent> tasks = new ArrayList<>();
        int taskIndex = 0;
        for (JsonNode taskNode : root.get("tasks")) {
            taskIndex++;
            checkFields(taskNode, TASK_FIELDS, "Task " + taskIndex, reasons);
            PlanAgent agent = null;
            if (taskNode.has("id") && taskNode.has("amr") && taskNode.has("klass") && taskNode.has("start")
                    && taskNode.has("goal") && taskNode.has("due")
                    && taskNode.get("start").isArray() && taskNode.get("start").size() == 2
                    && cellOk(taskNode.get("start"), height, width, reasons, "Task " + taskIndex + " start")
                    && cellOk(taskNode.get("goal"), height, width, reasons, "Task " + taskIndex + " goal")
                    && taskNode.get("due").isInt()) {
                agent = new PlanAgent(
                        taskNode.get("id").asText(),
                        taskNode.get("amr").asText(),
                        taskNode.get("klass").asText(),
                        new Cell(taskNode.get("start").get(0).asInt(), taskNode.get("start").get(1).asInt()),
                        new Cell(taskNode.get("goal").get(0).asInt(), taskNode.get("goal").get(1).asInt()),
                        taskNode.get("due").asInt());
            }
            if (agent != null) {
                tasks.add(agent);
            }
        }
        if (!reasons.isEmpty()) {
            throw new PlanRejection(reasons);
        }

        List<WindowRequest> windows = new ArrayList<>();
        if (root.has("windows")) {
            if (!root.get("windows").isArray()) {
                throw new PlanRejection(List.of("The windows field must be an array of window asks."));
            }
            int windowIndex = 0;
            for (JsonNode windowNode : root.get("windows")) {
                windowIndex++;
                checkFields(windowNode, WINDOW_FIELDS, "Window " + windowIndex, reasons);
                if (windowNode.has("id") && windowNode.has("amr") && windowNode.has("klass")
                        && cellOk(windowNode.path("origin"), height, width, reasons, "Window " + windowIndex
                                + " origin")
                        && cellOk(windowNode.path("destination"), height, width, reasons, "Window " + windowIndex
                                + " destination")
                        && windowNode.path("earliest").isInt() && windowNode.path("latest").isInt()) {
                    windows.add(new WindowRequest(
                            windowNode.get("id").asText(),
                            windowNode.get("amr").asText(),
                            windowNode.get("klass").asText(),
                            new Cell(windowNode.path("origin").get(0).asInt(),
                                    windowNode.path("origin").get(1).asInt()),
                            new Cell(windowNode.path("destination").get(0).asInt(),
                                    windowNode.path("destination").get(1).asInt()),
                            windowNode.path("earliest").asInt(),
                            windowNode.path("latest").asInt()));
                }
            }
        }
        if (!reasons.isEmpty()) {
            throw new PlanRejection(reasons);
        }
        return new PlanInput(floorNode.get("id").asText(), floorNode.get("name").asText(),
                FloorGrid.paint(width, height, runs), tasks,
                root.get("horizon").asInt(), root.get("seed").asInt(), windows);
    }

    private static boolean cellOk(JsonNode node, int height, int width, List<String> reasons, String what) {
        if (node == null || !node.isArray() || node.size() != 2) {
            reasons.add(what + " must be a [row, col] pair of integers.");
            return false;
        }
        if (node.get(0).asInt(-1) < 0 || node.get(0).asInt(-1) >= height) {
            reasons.add(what + " names row " + node.get(0).asInt() + ", outside the floor of " + height + " rows.");
            return false;
        }
        if (node.get(1).asInt(-1) < 0 || node.get(1).asInt(-1) >= width) {
            reasons.add(what + " names col " + node.get(1).asInt() + ", outside the floor of " + width + " cols.");
            return false;
        }
        return true;
    }

    private static void checkFields(JsonNode node, Set<String> expected, String what, List<String> reasons) {
        List<String> seen = new ArrayList<>();
        node.fieldNames().forEachRemaining(seen::add);
        for (String name : seen) {
            if (!expected.contains(name)) {
                reasons.add(what + " carries an unknown field " + name + ".");
            }
        }
    }
}
