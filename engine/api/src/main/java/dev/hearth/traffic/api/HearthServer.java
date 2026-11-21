package dev.hearth.traffic.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hearth.traffic.Cell;
import dev.hearth.traffic.ConflictSolver;
import dev.hearth.traffic.DriftMonitor;
import dev.hearth.traffic.GateDecision;
import dev.hearth.traffic.PlanInput;
import dev.hearth.traffic.PlanPath;
import dev.hearth.traffic.PlanRejection;
import dev.hearth.traffic.WindowRequest;
import dev.hearth.traffic.WindowService;
import dev.hearth.traffic.app.HearthJson;
import dev.hearth.traffic.app.PlanLibrary;
import dev.hearth.traffic.app.RunPlan;
import dev.hearth.traffic.app.UnknownFixture;
import io.javalin.Javalin;
import io.javalin.http.Context;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import net.logstash.logback.marker.Markers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * HTTP adapter. The planning rules live in the domain, not in these routes:
 * a named fixture or an inline document goes in, the manifest's reading or a
 * window's gate decision comes out.
 */
public final class HearthServer {

    private static final Logger log = LoggerFactory.getLogger(HearthServer.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> PLAN_FIELDS = Set.of("fixture", "document");
    private static final Set<String> WINDOW_FIELDS = Set.of("fixture", "document", "request");
    private static final Set<String> REQUEST_FIELDS = Set.of("id", "amr", "klass", "origin", "destination",
            "earliest", "latest");
    private static final Set<String> MONITOR_FIELDS = Set.of("fixture", "document", "observations");
    private static final Set<String> OBSERVATION_FIELDS = Set.of("id", "tick", "at");

    private HearthServer() {}

    public static void main(String[] args) {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8093"));
        create(OpsShell.Options.fromEnv("HEARTH")).start("0.0.0.0", port);
    }

    public static Javalin create() {
        return create(OpsShell.Options.defaults());
    }

    public static Javalin create(OpsShell.Options options) {
        String openApi = loadOpenApi();
        OpsShell shell = new OpsShell(options, "hearth");
        Javalin app = Javalin.create(config -> {
            config.showJavalinBanner = false;
            // the same cap the gate announces, enforced by the server itself
            // for bodies that lie about their length
            config.http.maxRequestSize = options.maxBodyBytes();
        });
        app.before(ctx -> {
            ctx.attribute("startedNanos", System.nanoTime());
            shell.gate(ctx);
        });
        app.after(shell::observed);
        app.exception(OpsShell.Refusal.class, (exception, ctx) -> {
            if (exception.retryAfterSeconds > 0) {
                ctx.header("Retry-After", String.valueOf(exception.retryAfterSeconds));
            }
            problem(ctx, exception.status, exception.type, exception.title, exception.detail, List.of());
        });
        app.exception(UnknownFixture.class, (exception, ctx) -> problem(
                ctx, 400, "urn:hearth:unknown-fixture", "Unknown fixture", exception.getMessage(), List.of()));
        app.exception(PlanRejection.class, (exception, ctx) -> problem(
                ctx, 400, "urn:hearth:rejection", "The ask was refused", exception.getMessage(),
                exception.reasons()));
        app.exception(Exception.class, (exception, ctx) -> {
            log.error(Markers.append("path", ctx.path()), "request failed", exception);
            problem(ctx, 500, "urn:hearth:internal", "Internal error",
                    "The manifest could not be read.", List.of());
        });
        app.get("/health", ctx -> ctx.json(Map.of("status", "up")));
        app.get("/ready", ctx -> {
            boolean ready = !PlanLibrary.names().isEmpty();
            ctx.status(ready ? 200 : 503).json(Map.of(
                    "status", ready ? "ready" : "not-ready",
                    "floors", PlanLibrary.names().size()));
        });
        app.get("/metrics", ctx -> ctx
                .contentType("text/plain; version=0.0.4; charset=utf-8")
                .result(shell.render()));
        app.get("/v1/openapi.yaml", ctx -> ctx.contentType("application/yaml").result(openApi));
        app.get("/v1/fixtures", ctx -> ctx.json(Map.of("floors", PlanLibrary.names())));
        app.get("/", ctx -> ctx.contentType("text/html").result(loadWorkbench()));
        app.post("/v1/plan", ctx -> {
            var report = RunPlan.plan(inputOf(readBody(ctx, PLAN_FIELDS)));
            shell.planRun();
            ctx.json(report);
        });
        app.post("/v1/windows", ctx -> {
            JsonNode body = readBody(ctx, WINDOW_FIELDS);
            PlanInput input = inputOf(body);
            WindowRequest request = requestOf(body.get("request"), input);
            ConflictSolver.Solution served = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve();
            if (!served.solved()) {
                throw new PlanRejection(List.of(
                        "The manifest itself cannot be served: " + served.reason()
                                + " The gate needs a served plan to answer a window."));
            }
            GateDecision decision = WindowService.gate(input, served.paths(), served.splits(), request);
            shell.windowAsk();
            ctx.json(Map.of(
                    "floor", input.floorId(),
                    "request", request.id(),
                    "decision", decision.decision(),
                    "reasons", decision.reasons(),
                    "verdict", decision.verdict()));
        });
        app.post("/v1/monitor", ctx -> {
            JsonNode body = readBody(ctx, MONITOR_FIELDS);
            PlanInput input = inputOf(body);
            List<DriftMonitor.Observation> observations = observationsOf(body.get("observations"));
            ConflictSolver.Solution served = new ConflictSolver(input, ConflictSolver.Mode.IMPROVED).solve();
            if (!served.solved()) {
                throw new PlanRejection(List.of(
                        "The manifest itself cannot be served: " + served.reason()
                                + " The monitor needs a served plan to watch."));
            }
            DriftMonitor.Reading reading = DriftMonitor.compare(served.paths(), input, observations);
            DriftMonitor.Repair repair = DriftMonitor.repair(served.paths(), input, observations);
            shell.planRun();
            Map<String, Object> arrivals = new LinkedHashMap<>();
            for (Map.Entry<String, PlanPath> entry : repair.paths().entrySet()) {
                arrivals.put(entry.getKey(), entry.getValue().arrival());
            }
            ctx.json(Map.of(
                    "floor", input.floorId(),
                    "reading", Map.of(
                            "observed", reading.observed(),
                            "onPlan", reading.onPlan(),
                            "violations", reading.violations(),
                            "arrived", reading.arrivedIds()),
                    "repair", Map.of(
                            "servedSum", repair.servedSum(),
                            "makespan", repair.makespan(),
                            "oldMakespan", repair.oldMakespan(),
                            "late", repair.lateIds(),
                            "arrivals", arrivals,
                            "verdict", repair.verdict())));
        });
        return app;
    }

    private static JsonNode readBody(Context ctx, Set<String> allowed) {
        if (ctx.body().isBlank()) {
            throw new PlanRejection(List.of("Send a fixture name or a floor document."));
        }
        JsonNode node;
        try {
            node = MAPPER.readTree(ctx.body());
        } catch (JsonProcessingException exception) {
            throw new PlanRejection(List.of("The request is not valid JSON."));
        }
        if (!node.isObject()) {
            throw new PlanRejection(List.of("The request must be a JSON object."));
        }
        List<String> reasons = new ArrayList<>();
        Iterator<String> names = node.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!allowed.contains(name)) {
                reasons.add("Request has unknown field " + name + ".");
            }
        }
        if (!reasons.isEmpty()) {
            throw new PlanRejection(reasons);
        }
        return node;
    }

    private static PlanInput inputOf(JsonNode node) {
        boolean named = node.hasNonNull("fixture");
        boolean inline = node.has("document");
        if (named && inline) {
            throw new PlanRejection(List.of("Send a fixture name or a floor document, not both."));
        }
        if (!named && !inline) {
            throw new PlanRejection(List.of("Send a fixture name or a floor document."));
        }
        if (named) {
            JsonNode fixture = node.get("fixture");
            if (!fixture.isTextual()) {
                throw new PlanRejection(List.of("fixture must be a string."));
            }
            return PlanLibrary.load(fixture.asText());
        }
        return HearthJson.parse(node.get("document"));
    }

    /** Parses and validates the observation list: id, tick, and a [row, col] cell. */
    private static List<DriftMonitor.Observation> observationsOf(JsonNode node) {
        if (node == null || !node.isArray() || node.isEmpty()) {
            throw new PlanRejection(List.of(
                    "The monitor needs observations: a list of {id, tick, at: [row, col]}."));
        }
        List<DriftMonitor.Observation> observations = new ArrayList<>();
        int index = 0;
        for (JsonNode item : node) {
            String path = "observations[" + index++ + "]";
            if (!item.isObject()) {
                throw new PlanRejection(List.of(path + " must be an object."));
            }
            List<String> reasons = new ArrayList<>();
            Iterator<String> names = item.fieldNames();
            while (names.hasNext()) {
                String name = names.next();
                if (!OBSERVATION_FIELDS.contains(name)) {
                    reasons.add(path + " carries an unknown field " + name + ".");
                }
            }
            if (!item.path("id").isTextual()) {
                reasons.add(path + " needs a textual id.");
            }
            if (!item.path("tick").isInt() || item.path("tick").asInt() < 0) {
                reasons.add(path + " needs a whole tick of zero or more.");
            }
            JsonNode at = item.path("at");
            if (!at.isArray() || at.size() != 2 || !at.get(0).isInt() || !at.get(1).isInt()) {
                reasons.add(path + " needs at as a [row, col] pair of integers.");
            }
            if (!reasons.isEmpty()) {
                throw new PlanRejection(reasons);
            }
            observations.add(new DriftMonitor.Observation(
                    item.path("id").asText(),
                    item.path("tick").asInt(),
                    new Cell(at.get(0).asInt(), at.get(1).asInt())));
        }
        return observations;
    }

    private static WindowRequest requestOf(JsonNode node, PlanInput input) {        if (node == null || !node.isObject()) {
            throw new PlanRejection(List.of("The windows ask needs a request object with id, amr, klass,"
                    + " origin, destination, earliest, and latest."));
        }
        List<String> reasons = new ArrayList<>();
        Iterator<String> names = node.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!REQUEST_FIELDS.contains(name)) {
                reasons.add("The window ask carries an unknown field " + name + ".");
            }
        }
        for (String field : List.of("id", "amr", "klass")) {
            if (!node.path(field).isTextual()) {
                reasons.add("The window ask needs a textual " + field + ".");
            }
        }
        for (String field : List.of("origin", "destination")) {
            JsonNode cell = node.path(field);
            if (!cell.isArray() || cell.size() != 2 || !cell.get(0).isInt() || !cell.get(1).isInt()) {
                reasons.add("The window ask needs " + field + " as a [row, col] pair of integers.");
            }
        }
        if (!node.path("earliest").isInt() || !node.path("latest").isInt()) {
            reasons.add("The window ask needs integer earliest and latest.");
        }
        if (!reasons.isEmpty()) {
            throw new PlanRejection(reasons);
        }
        return new WindowRequest(
                node.path("id").asText(),
                node.path("amr").asText(),
                node.path("klass").asText(),
                new Cell(node.path("origin").get(0).asInt(), node.path("origin").get(1).asInt()),
                new Cell(node.path("destination").get(0).asInt(), node.path("destination").get(1).asInt()),
                node.path("earliest").asInt(),
                node.path("latest").asInt());
    }

    private static void problem(Context ctx, int status, String type, String title, String detail, List<String> reasons) {
        ctx.status(status).json(Map.of(
                "type", type,
                "title", title,
                "status", status,
                "detail", detail,
                "instance", ctx.path(),
                "reasons", reasons));
        ctx.contentType("application/problem+json");
    }

    private static String loadOpenApi() {
        try (InputStream input = HearthServer.class.getResourceAsStream("/openapi.yaml")) {
            if (input == null) {
                throw new IllegalStateException("openapi.yaml is missing");
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("openapi.yaml could not be read", exception);
        }
    }

    /** The single-file workbench this jar serves at "/", so the planner has a face of its own. */
    private static String loadWorkbench() {
        try (InputStream input = HearthServer.class.getResourceAsStream("/web/index.html")) {
            if (input == null) {
                throw new IllegalStateException("web/index.html is missing");
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("web/index.html could not be read", exception);
        }
    }
}
