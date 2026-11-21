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
                {"fixture":"casting-hall","request":{"id":"W-1","amr":"Kiln","klass":"express",
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
                {"fixture":"casting-hall","request":{"id":"W-2","amr":"Ash","klass":"standard",
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
                "{\"fixture\":\"casting-hall\",\"request\":{\"id\":7,\"amr\":\"Kiln\",\"klass\":\"express\","
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
