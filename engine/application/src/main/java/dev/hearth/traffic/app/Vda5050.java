package dev.hearth.traffic.app;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hearth.traffic.GateDecision;
import dev.hearth.traffic.WindowRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The VDA 5050 adapter: a fleet manager that speaks the German automotive
 * association's AGV protocol can ask hearthlane's gate without learning a
 * new vocabulary.
 *
 * The mapping, stated once and locked by tests:
 *
 *   - an order frame's serialNumber is the AMR, its orderId is the ask id;
 *   - the first node's position is the origin, the action node's position is
 *     the destination, with x mapping to the grid column and y to the row
 *     (both whole numbers; VDA 5050 positions are metres, hearthlane's grid
 *     is cells, and an integrator working in metres converts before sending
 *     or hearthlane refuses the fraction in words);
 *   - a node action of type traverseCorridor carries the window ask's
 *     parameters: earliest and latest (required), klass (optional,
 *     standard by default);
 *   - the gate's answer comes back as a VDA 5050 action state: RUNNING when
 *     the departure fires, PAUSED when the gate hesitates with its reasons
 *     as the result description, FAILED when the manifest itself cannot be
 *     served.
 */
public final class Vda5050 {

    private static final String ACTION_TYPE = "traverseCorridor";

    private Vda5050() {}

    /**
     * Reads one order frame into the window ask it carries. The frame needs
     * a serialNumber, an orderId, a first node (the origin), and a node
     * carrying a traverseCorridor action whose position is the destination
     * and whose parameters carry the window.
     */
    public static WindowRequest orderToAsk(JsonNode order) {
        List<String> reasons = new ArrayList<>();
        if (order == null || !order.isObject()) {
            throw new dev.hearth.traffic.PlanRejection(List.of("The order frame must be a JSON object."));
        }
        String serial = text(order, "serialNumber", reasons);
        String orderId = text(order, "orderId", reasons);
        if (order.has("headerId") && !order.path("headerId").isInt()) {
            reasons.add("headerId must be a whole number.");
        }
        JsonNode nodes = order.path("nodes");
        if (!nodes.isArray() || nodes.isEmpty()) {
            reasons.add("The order frame needs a nodes array with at least one node.");
        }
        if (!reasons.isEmpty()) {
            throw new dev.hearth.traffic.PlanRejection(reasons);
        }

        JsonNode first = nodes.get(0);
        CellPos origin = position(first, "the first node", reasons);
        JsonNode actionNode = null;
        JsonNode action = null;
        for (JsonNode node : nodes) {
            for (JsonNode candidate : node.path("actions")) {
                if (ACTION_TYPE.equals(candidate.path("actionType").asText())) {
                    actionNode = node;
                    action = candidate;
                }
            }
        }
        if (action == null) {
            reasons.add("The order carries no " + ACTION_TYPE + " action, so it asks nothing the gate can answer.");
        } else {
            String actionId = action.path("actionId").asText("");
            if (actionId.isBlank()) {
                reasons.add("The " + ACTION_TYPE + " action needs an actionId.");
            }
        }
        CellPos destination = actionNode != null
                ? position(actionNode, "the " + ACTION_TYPE + " node", reasons)
                : null;
        Integer earliest = null;
        Integer latest = null;
        String klass = "standard";
        if (action != null) {
            Map<String, String> parameters = new LinkedHashMap<>();
            for (JsonNode parameter : action.path("actionParameters")) {
                String key = parameter.path("key").asText("");
                JsonNode value = parameter.path("value");
                if (!key.isBlank() && value.isValueNode()) {
                    parameters.put(key, value.asText());
                }
            }
            earliest = whole(parameters.get("earliest"), "earliest", reasons);
            latest = whole(parameters.get("latest"), "latest", reasons);
            String given = parameters.get("klass");
            if (given != null && !List.of("express", "standard", "bulk").contains(given)) {
                reasons.add("The klass parameter must be express, standard, or bulk, not \"" + given + "\".");
            } else if (given != null) {
                klass = given;
            }
        }
        if (earliest == null && action != null && !hasWord(reasons, "earliest")) {
            reasons.add("The " + ACTION_TYPE + " action needs an earliest parameter: the tick the window opens.");
        }
        if (latest == null && action != null && !hasWord(reasons, "latest")) {
            reasons.add("The " + ACTION_TYPE + " action needs a latest parameter: the tick the window closes.");
        }
        if (origin == null || destination == null || earliest == null || latest == null || !reasons.isEmpty()) {
            reasons.add(0, "The order frame for " + (serial == null ? "an unnamed AMR" : serial) + " cannot become a window ask:");
            throw new dev.hearth.traffic.PlanRejection(reasons);
        }

        return new WindowRequest(
                orderId,
                serial,
                klass,
                new dev.hearth.traffic.Cell(origin.row(), origin.col()),
                new dev.hearth.traffic.Cell(destination.row(), destination.col()),
                earliest,
                latest);
    }

    /**
     * The gate's answer as one VDA 5050 action state block, ready for the
     * response body: RUNNING when the departure fires, PAUSED when the gate
     * hesitates, FAILED when there was no served plan to ask.
     */
    public static Map<String, Object> actionState(GateDecision decision, String actionId) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("actionId", actionId);
        state.put("actionType", ACTION_TYPE);
        String status;
        String result;
        if (decision == null) {
            status = "FAILED";
            result = "The manifest itself cannot be served, so the gate has no plan to answer from.";
        } else if ("fire".equals(decision.decision())) {
            status = "RUNNING";
            result = "The window is granted: " + grantWords(decision);
        } else {
            status = "PAUSED";
            result = "The gate hesitates: " + String.join(" ", decision.reasons());
        }
        state.put("actionStatus", status);
        state.put("resultDescription", result);
        return state;
    }

    private static String grantWords(GateDecision decision) {
        if (decision.verdict() != null && decision.verdict().grant() != null) {
            var grant = decision.verdict().grant();
            return grant.amr() + " departs at tick " + grant.depart()
                    + ", arrives at tick " + grant.arrive() + ", and pays "
                    + grant.detour() + " ticks of detour.";
        }
        return "the departure is released.";
    }

    private record CellPos(int row, int col) {}

    private static CellPos position(JsonNode node, String where, List<String> reasons) {
        JsonNode pos = node.path("nodePosition");
        if (!pos.isObject()) {
            reasons.add(where + " needs a nodePosition.");
            return null;
        }
        JsonNode x = pos.path("x");
        JsonNode y = pos.path("y");
        if (!x.isInt() || !y.isInt()) {
            reasons.add(where + "'s nodePosition needs whole-number x and y: the grid column and row. "
                    + "VDA 5050 positions are metres; convert to cells before sending.");
            return null;
        }
        return new CellPos(y.asInt(), x.asInt());
    }

    private static String text(JsonNode node, String field, List<String> reasons) {
        JsonNode value = node.path(field);
        if (!value.isTextual() || value.asText().isBlank()) {
            reasons.add("The order frame needs a textual " + field + ".");
            return null;
        }
        return value.asText();
    }

    private static Integer whole(String raw, String field, List<String> reasons) {
        if (raw == null) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException exception) {
            reasons.add("The " + field + " parameter must be a whole tick number, not \"" + raw + "\".");
            return null;
        }
    }

    private static boolean hasWord(List<String> reasons, String word) {
        return reasons.stream().anyMatch(reason -> reason.contains(word));
    }
}
