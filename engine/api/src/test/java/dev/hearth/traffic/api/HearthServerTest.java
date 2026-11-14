package dev.hearth.traffic.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.Javalin;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HearthServerTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newHttpClient();
    private Javalin app;
    private String base;

    @BeforeEach
    void start() {
        app = HearthServer.create();
        app.start(0);
        base = "http://127.0.0.1:" + app.port();
    }

    @AfterEach
    void stop() {
        app.stop();
    }

    private HttpResponse<String> send(String method, String path, String body) throws Exception {
        return send(base, method, path, body);
    }

    private HttpResponse<String> send(String base, String method, String path, String body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(base + path));
        switch (method) {
            case "GET" -> request.GET();
            case "POST" -> request.header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
            default -> throw new IllegalArgumentException(method);
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void healthAndOpenApi() throws Exception {
        HttpResponse<String> health = send("GET", "/health", null);
        assertEquals(200, health.statusCode());
        assertEquals("up", mapper.readTree(health.body()).get("status").asText());

        HttpResponse<String> spec = send("GET", "/v1/openapi.yaml", null);
        assertEquals(200, spec.statusCode());
        assertTrue(spec.body().contains("/v1/plan"));
        assertTrue(spec.body().contains("/v1/windows"));
        assertTrue(spec.body().contains("/v1/fixtures"));
    }

    @Test
    void metricsAreServedInPrometheusText() throws Exception {
        send("GET", "/health", null);
        HttpResponse<String> metrics = send("GET", "/metrics", null);
        assertEquals(200, metrics.statusCode());
        assertTrue(metrics.headers().firstValue("content-type").orElse("").contains("text/plain"));
        String body = metrics.body();
        assertTrue(body.contains("# TYPE hearth_http_requests_total counter"));
        assertTrue(body.contains("hearth_http_requests_total{"));
        assertTrue(body.contains("hearth_uptime_seconds"));
    }

    @Test
    void readinessReportsThePublishedFloors() throws Exception {
        HttpResponse<String> response = send("GET", "/ready", null);
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals("ready", body.get("status").asText());
        assertTrue(body.get("floors").asInt() > 0);
    }

    @Test
    void aTokenLocksTheApiAndKeepsThePublicRoutesOpen() throws Exception {
        Javalin tokened = HearthServer.create(new OpsShell.Options("sesame", 600, 1024 * 1024));
        tokened.start(0);
        String tokenBase = "http://127.0.0.1:" + tokened.port();
        try {
            HttpResponse<String> refused = send(tokenBase, "POST", "/v1/plan", "{\"fixture\":\"casting-hall\"}");
            assertEquals(401, refused.statusCode());
            assertTrue(refused.headers().firstValue("content-type").orElse("").contains("application/problem+json"));
            assertTrue(mapper.readTree(refused.body()).get("title").asText().contains("token"));

            HttpRequest allowed = HttpRequest.newBuilder(URI.create(tokenBase + "/v1/plan"))
                    .header("authorization", "Bearer sesame")
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{\"fixture\":\"casting-hall\"}"))
                    .build();
            assertEquals(200, client.send(allowed, HttpResponse.BodyHandlers.ofString()).statusCode());

            for (String open : java.util.List.of("/health", "/ready", "/metrics", "/")) {
                HttpResponse<String> page = send(tokenBase, "GET", open, null);
                assertEquals(200, page.statusCode(), open + " should stay open for probes and the workbench page");
            }
        } finally {
            tokened.stop();
        }
    }

    @Test
    void theRateLimitRefusesWithRetryAfter() throws Exception {
        Javalin limited = HearthServer.create(new OpsShell.Options(null, 3, 1024 * 1024));
        limited.start(0);
        String limitedBase = "http://127.0.0.1:" + limited.port();
        try {
            for (int i = 0; i < 3; i++) {
                assertEquals(200, send(limitedBase, "GET", "/v1/fixtures", null).statusCode());
            }
            HttpResponse<String> fourth = send(limitedBase, "GET", "/v1/fixtures", null);
            assertEquals(429, fourth.statusCode());
            assertTrue(Integer.parseInt(fourth.headers().firstValue("Retry-After").orElse("0")) > 0);
            assertEquals("Too many requests", mapper.readTree(fourth.body()).get("title").asText());
        } finally {
            limited.stop();
        }
    }

    @Test
    void anOversizeBodyIsRefusedBeforeItIsRead() throws Exception {
        Javalin capped = HearthServer.create(new OpsShell.Options(null, 600, 512));
        capped.start(0);
        String cappedBase = "http://127.0.0.1:" + capped.port();
        try {
            HttpResponse<String> response = send(cappedBase, "POST", "/v1/plan", "x".repeat(2048));
            assertEquals(413, response.statusCode());
            assertEquals("The request body is too large",
                    mapper.readTree(response.body()).get("title").asText());
        } finally {
            capped.stop();
        }
    }

    @Test
    void theWorkbenchPageIsServed() throws Exception {
        HttpResponse<String> page = send("GET", "/", null);
        assertEquals(200, page.statusCode());
        assertTrue(page.headers().firstValue("content-type").orElse("").contains("text/html"));
        assertTrue(page.body().contains("traffic workbench"));
        assertTrue(page.body().contains("<h1>"));
    }

    @Test
    void theFixtureListNamesTheCastingHall() throws Exception {
        HttpResponse<String> response = send("GET", "/v1/fixtures", null);
        assertEquals(200, response.statusCode());
        JsonNode floors = mapper.readTree(response.body()).get("floors");
        assertTrue(floors.isArray());
        assertTrue(floors.size() >= 1);
        assertTrue(floors.toString().contains("casting-hall"));
    }

    @Test
    void theCastingHallPlanReadsTheLadder() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/plan", "{\"fixture\":\"casting-hall\"}");
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());

        assertEquals("casting-hall", body.get("floorId").asText());
        assertEquals("Ferro & Lume casting hall", body.get("floorName").asText());

        JsonNode ladder = body.get("ladder");
        assertEquals(3, ladder.size());
        JsonNode cbs = rung(ladder, "CBS");
        assertTrue(cbs.get("solved").asBoolean());
        assertEquals(69, cbs.get("sum").asInt());
        JsonNode icbs = rung(ladder, "ICBS");
        assertTrue(icbs.get("solved").asBoolean());
        assertEquals(69, icbs.get("sum").asInt());
        JsonNode greedy = rung(ladder, "prioritized");
        assertFalse(greedy.get("solved").asBoolean());
        assertTrue(greedy.get("sum").isNull());

        assertEquals(69, body.get("servedSum").asInt());
        assertTrue(body.get("makespan").asInt() > 0);
        assertEquals(6, body.get("arrivals").size());
        assertEquals(2, body.get("windows").size());
        assertEquals(6, body.get("curve").size());
        assertTrue(body.get("density").size() > 0);
        double correlation = body.get("replications").get("correlation").asDouble();
        assertTrue(correlation >= -1.0 && correlation <= 1.0);
    }

    @Test
    void theFirstRecordedWindowFires() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/windows", """
                {"fixture":"casting-hall","request":{"id":"W-1","amr":"AMR-7","klass":"express",
                 "origin":[8,9],"destination":[0,9],"earliest":0,"latest":25}}""");
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals("W-1", body.get("request").asText());
        assertEquals("fire", body.get("decision").asText());
        assertTrue(body.get("verdict").get("granted").asBoolean());
        assertTrue(body.get("verdict").get("grant").get("depart").isInt());
    }

    @Test
    void theSecondRecordedWindowHesitates() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/windows", """
                {"fixture":"casting-hall","request":{"id":"W-2","amr":"AMR-8","klass":"standard",
                 "origin":[3,7],"destination":[3,10],"earliest":4,"latest":20}}""");
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals("W-2", body.get("request").asText());
        // The window itself is servable, so the verdict grants it. The gate
        // still hesitates: the departure region carries conflict density in
        // the departure bucket, and the reason is journaled.
        assertEquals("hesitate", body.get("decision").asText());
        assertTrue(body.get("verdict").get("granted").asBoolean());
        assertTrue(body.get("reasons").toString().contains("conflict density"));
    }

    @Test
    void theMonitorReadsACleanFloorAndKeepsTheDeadlines() throws Exception {
        // every AMR standing on its start at tick 0, which is exactly where
        // the plan puts them: the floor matches, the repair holds
        String observations = "["
                + "{\"id\":\"T-01\",\"tick\":0,\"at\":[8,0]},"
                + "{\"id\":\"T-02\",\"tick\":0,\"at\":[0,0]},"
                + "{\"id\":\"T-03\",\"tick\":0,\"at\":[3,5]},"
                + "{\"id\":\"T-04\",\"tick\":0,\"at\":[6,9]},"
                + "{\"id\":\"T-05\",\"tick\":0,\"at\":[0,3]},"
                + "{\"id\":\"T-06\",\"tick\":0,\"at\":[8,6]}"
                + "]";

        HttpResponse<String> response = send("POST", "/v1/monitor",
                "{\"fixture\":\"casting-hall\",\"observations\":" + observations + "}");
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals(6, body.get("reading").get("observed").asInt());
        assertEquals(6, body.get("reading").get("onPlan").asInt());
        assertEquals(0, body.get("reading").get("violations").size());
        assertTrue(body.get("repair").get("verdict").asText().contains("keeps every deadline"));
    }

    @Test
    void theMonitorNamesAHeldBackAmrAndTheRepairLosesItsDeadline() throws Exception {
        // AMR-3 still standing on its start at tick 8: its due is 9
        HttpResponse<String> response = send("POST", "/v1/monitor",
                "{\"fixture\":\"casting-hall\",\"observations\":[{\"id\":\"T-03\",\"tick\":8,\"at\":[3,5]}]}");
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals(1, body.get("reading").get("violations").size());
        assertEquals("T-03", body.get("reading").get("violations").get(0).get("id").asText());
        assertTrue(body.get("repair").get("late").toString().contains("T-03"));
        assertTrue(body.get("repair").get("verdict").asText().contains("cannot keep every deadline"));
    }

    @Test
    void theMonitorRefusesAnUnknownAmrInWords() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/monitor",
                "{\"fixture\":\"casting-hall\",\"observations\":[{\"id\":\"T-99\",\"tick\":1,\"at\":[0,0]}]}");
        assertEquals(400, response.statusCode());
        assertTrue(mapper.readTree(response.body()).get("reasons").toString().contains("T-99"));
    }

    @Test
    void theMonitorRefusesAnObservationOnRack() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/monitor",
                "{\"fixture\":\"casting-hall\",\"observations\":[{\"id\":\"T-01\",\"tick\":1,\"at\":[1,1]}]}");
        assertEquals(400, response.statusCode());
        assertTrue(mapper.readTree(response.body()).get("reasons").toString().contains("not an open cell"));
    }

    @Test
    void theMonitorRefusesMalformedObservations() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/monitor",
                "{\"fixture\":\"casting-hall\",\"observations\":[{\"id\":\"T-01\",\"tick\":1}]}");
        assertEquals(400, response.statusCode());
        assertTrue(mapper.readTree(response.body()).get("reasons").toString().contains("at"));
    }

    @Test
    void aVda5050OrderFiresAndAnswersInTheProtocolShape() throws Exception {
        // AMR-7's recorded ask, spoken as a fleet manager would: an order with
        // a traverseCorridor action carrying the window as parameters
        HttpResponse<String> response = send("POST", "/v1/vda5050/orders", """
                {"fixture":"casting-hall","order":{
                  "headerId":4711,
                  "version":"2.0.0",
                  "manufacturer":"MarrowControl",
                  "serialNumber":"AMR-7",
                  "orderId":"corridor-pass-1",
                  "nodes":[
                    {"nodeId":"n1","sequenceId":1,
                     "nodePosition":{"x":9,"y":8},
                     "actions":[]},
                    {"nodeId":"n2","sequenceId":2,
                     "nodePosition":{"x":9,"y":0},
                     "actions":[
                       {"actionId":"act-77","actionType":"traverseCorridor","blockingType":"HARD",
                        "actionParameters":[
                          {"key":"earliest","value":"0"},
                          {"key":"latest","value":"25"},
                          {"key":"klass","value":"express"}]}]}
                  ],
                  "edges":[]}}
                """);
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals(4711, body.get("headerId").asInt());
        assertEquals("AMR-7", body.get("serialNumber").asText());
        JsonNode state = body.get("actionStates").get(0);
        assertEquals("act-77", state.get("actionId").asText());
        assertEquals("RUNNING", state.get("actionStatus").asText());
        assertTrue(state.get("resultDescription").asText().contains("departs at tick"));
    }

    @Test
    void aVda5050OrderIntoCongestionPausesWithTheReasons() throws Exception {
        // AMR-8's ask into the congested Main Run: the gate holds it, and the
        // protocol's word for held is PAUSED
        HttpResponse<String> response = send("POST", "/v1/vda5050/orders", """
                {"fixture":"casting-hall","order":{
                  "headerId":4712,
                  "version":"2.0.0",
                  "serialNumber":"AMR-8",
                  "orderId":"corridor-pass-2",
                  "nodes":[
                    {"nodeId":"n1","sequenceId":1,"nodePosition":{"x":7,"y":3},"actions":[]},
                    {"nodeId":"n2","sequenceId":2,"nodePosition":{"x":10,"y":3},
                     "actions":[
                       {"actionId":"act-78","actionType":"traverseCorridor","blockingType":"HARD",
                        "actionParameters":[
                          {"key":"earliest","value":"4"},
                          {"key":"latest","value":"20"},
                          {"key":"klass","value":"standard"}]}]}
                  ],
                  "edges":[]}}
                """);
        assertEquals(200, response.statusCode());
        JsonNode state = mapper.readTree(response.body()).get("actionStates").get(0);
        assertEquals("PAUSED", state.get("actionStatus").asText());
        assertTrue(state.get("resultDescription").asText().contains("conflict density"));
    }

    @Test
    void aVda5050OrderWithNoWindowParametersRefusesNamingThem() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/vda5050/orders", """
                {"fixture":"casting-hall","order":{
                  "headerId":4713,"version":"2.0.0","serialNumber":"AMR-7","orderId":"corridor-pass-3",
                  "nodes":[
                    {"nodeId":"n1","sequenceId":1,"nodePosition":{"x":9,"y":8},"actions":[]},
                    {"nodeId":"n2","sequenceId":2,"nodePosition":{"x":9,"y":0},
                     "actions":[{"actionId":"act-79","actionType":"traverseCorridor","blockingType":"HARD",
                                  "actionParameters":[]}]}
                  ],
                  "edges":[]}}
                """);
        assertEquals(400, response.statusCode());
        String reasons = mapper.readTree(response.body()).get("reasons").toString();
        assertTrue(reasons.contains("earliest"), reasons);
        assertTrue(reasons.contains("latest"), reasons);
    }

    @Test
    void aVda5050OrderWithFractionalPositionsRefusesWithTheConversion() throws Exception {
        // VDA 5050 positions are metres; hearthlane's grid is cells, and an
        // integrator must convert before sending
        HttpResponse<String> response = send("POST", "/v1/vda5050/orders", """
                {"fixture":"casting-hall","order":{
                  "headerId":4714,"version":"2.0.0","serialNumber":"AMR-7","orderId":"corridor-pass-4",
                  "nodes":[
                    {"nodeId":"n1","sequenceId":1,"nodePosition":{"x":9.5,"y":8.2},"actions":[]},
                    {"nodeId":"n2","sequenceId":2,"nodePosition":{"x":9,"y":0},
                     "actions":[{"actionId":"act-80","actionType":"traverseCorridor","blockingType":"HARD",
                                  "actionParameters":[
                                    {"key":"earliest","value":"0"},
                                    {"key":"latest","value":"25"}]}]}
                  ],
                  "edges":[]}}
                """);
        assertEquals(400, response.statusCode());
        assertTrue(mapper.readTree(response.body()).get("reasons").toString().contains("metres"));
    }

    @Test
    void anUnknownFixtureIsAProblemAndNotAReport() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/plan", "{\"fixture\":\"no-such-floor\"}");
        assertEquals(400, response.statusCode());
        assertTrue(response.headers().firstValue("content-type").orElse("").contains("application/problem+json"));
        JsonNode body = mapper.readTree(response.body());
        assertEquals("Unknown fixture", body.get("title").asText());
        assertTrue(body.get("detail").asText().contains("no-such-floor"));
        assertFalse(body.has("ladder"));
        assertFalse(body.has("arrivals"));
    }

    @Test
    void invalidJsonIsAProblem() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/plan", "not json at all");
        assertEquals(400, response.statusCode());
        assertTrue(mapper.readTree(response.body()).get("detail").asText().contains("not valid JSON"));
    }

    @Test
    void unknownRequestFieldsAreNamed() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/plan", "{\"fixture\":\"casting-hall\",\"extra\":1}");
        assertEquals(400, response.statusCode());
        assertTrue(mapper.readTree(response.body()).get("reasons").toString().contains("extra"));
    }

    @Test
    void anInlineDocumentPlansLikeTheFixture() throws Exception {
        InputStream source = getClass().getClassLoader().getResourceAsStream("fixtures/casting-hall.json");
        assertNotNull(source, "the casting hall fixture should be on the classpath");
        String fixture;
        try (InputStream input = source) {
            fixture = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        ObjectNode body = mapper.createObjectNode();
        body.set("document", mapper.readTree(fixture));
        HttpResponse<String> response = send("POST", "/v1/plan", mapper.writeValueAsString(body));
        assertEquals(200, response.statusCode());
        assertEquals("casting-hall", mapper.readTree(response.body()).get("floorId").asText());
    }

    @Test
    void aWindowAskWithoutATextualIdIsRefused() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/windows",
                "{\"fixture\":\"casting-hall\",\"request\":{\"id\":7,\"amr\":\"AMR-7\",\"klass\":\"express\","
                        + "\"origin\":[8,9],\"destination\":[0,9],\"earliest\":0,\"latest\":25}}");
        assertEquals(400, response.statusCode());
        assertTrue(mapper.readTree(response.body()).get("reasons").toString().contains("textual id"));
    }

    private static JsonNode rung(JsonNode ladder, String solver) {
        for (JsonNode node : ladder) {
            if (solver.equals(node.get("solver").asText())) {
                return node;
            }
        }
        throw new AssertionError("the ladder is missing the " + solver + " rung");
    }
}
