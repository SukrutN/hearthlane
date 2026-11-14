package dev.hearth.traffic.api;

import io.javalin.http.Context;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import net.logstash.logback.marker.Markers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The operations shell the engine service wears: a bearer-token gate, a
 * per-IP rate limit, a request body cap, and a metrics page, all hand-rolled
 * so the jar keeps its zero-dependency posture. The planning rules stay in
 * the domain; this class only guards and observes.
 *
 * The public routes stay open on purpose: /health and /ready for the
 * platform's probes, /metrics for the scraper, and / for the workbench page
 * itself. Everything else answers only when the operator has set a token,
 * and the workbench asks for it the first time it is refused.
 */
public final class OpsShell {

    private static final Logger log = LoggerFactory.getLogger(OpsShell.class);

    /** One refusal shape for every gate: status, a stable name, and words for the page. */
    public static final class Refusal extends RuntimeException {
        final int status;
        final String type;
        final String title;
        final String detail;
        final int retryAfterSeconds;

        Refusal(int status, String type, String title, String detail, int retryAfterSeconds) {
            super(title);
            this.status = status;
            this.type = type;
            this.title = title;
            this.detail = detail;
            this.retryAfterSeconds = retryAfterSeconds;
        }
    }

    /** Token (nullable), requests per client per minute, and the largest body accepted. */
    public record Options(String token, int requestsPerMinute, long maxBodyBytes) {

        static Options defaults() {
            return new Options(null, 600, 1024 * 1024);
        }

        /** Read the shell's knobs from the environment; blank means off or default. */
        static Options fromEnv(String prefix) {
            String token = System.getenv(prefix + "_TOKEN");
            String rate = System.getenv(prefix + "_RATE_LIMIT");
            String body = System.getenv(prefix + "_MAX_BODY");
            return new Options(
                    token == null || token.isBlank() ? null : token,
                    rate == null || rate.isBlank() ? 600 : Integer.parseInt(rate),
                    body == null || body.isBlank() ? 1024 * 1024 : Long.parseLong(body));
        }
    }

    private static final long[] LATENCY_BUCKETS_MS = {1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000};

    private final Options options;
    private final String prefix;
    private final long startedAtNanos = System.nanoTime();

    // requests: method|route|status -> count
    private final ConcurrentHashMap<String, LongAdder> requests = new ConcurrentHashMap<>();
    // latency: method|route -> {bucket counts..., sum, total}
    private final ConcurrentHashMap<String, long[]> latency = new ConcurrentHashMap<>();
    // refusals by gate: auth, rate, oversize
    private final ConcurrentHashMap<String, LongAdder> refusals = new ConcurrentHashMap<>();
    // engine work
    private final LongAdder planRuns = new LongAdder();
    private final LongAdder windowAsks = new LongAdder();
    // rate windows: ip -> {windowIndex, hits}
    private final ConcurrentHashMap<String, long[]> windows = new ConcurrentHashMap<>();

    public OpsShell(Options options, String prefix) {
        this.options = options;
        this.prefix = prefix;
    }

    /** The gate every request passes before any route runs. */
    public void gate(Context ctx) {
        String path = ctx.path();
        boolean open = path.equals("/health") || path.equals("/ready") || path.equals("/metrics") || path.equals("/");
        if (open) {
            return;
        }
        String lengthHeader = ctx.header("content-length");
        if (lengthHeader != null) {
            try {
                if (Long.parseLong(lengthHeader) > options.maxBodyBytes()) {
                    refused("oversize");
                    throw new Refusal(413, "urn:" + prefix + ":body-too-large", "The request body is too large",
                            "This engine accepts bodies up to " + options.maxBodyBytes() + " bytes.", 0);
                }
            } catch (NumberFormatException ignored) {
                // a malformed length is the transport's problem, not ours
            }
        }
        if (!allow(ctx.ip())) {
            refused("rate");
            throw new Refusal(429, "urn:" + prefix + ":rate-limited", "Too many requests",
                    "This engine serves " + options.requestsPerMinute() + " requests per client each minute.", 60);
        }
        if (options.token() != null) {
            String header = ctx.header("authorization");
            byte[] expected = ("Bearer " + options.token()).getBytes(StandardCharsets.UTF_8);
            if (header == null || !MessageDigest.isEqual(
                    header.getBytes(StandardCharsets.UTF_8), expected)) {
                refused("auth");
                throw new Refusal(401, "urn:" + prefix + ":token-required", "A token is required",
                        "Send the engine's token as a Bearer authorization header.", 0);
            }
        }
    }

    /** The observation every request passes on the way out: metrics and the structured log line. */
    public void observed(Context ctx) {
        String route = ctx.matchedPath();
        if (route == null || route.isBlank()) {
            route = "unmatched";
        }
        String method = ctx.method().name();
        int status = ctx.statusCode();
        requests.computeIfAbsent(method + "|" + route + "|" + status, key -> new LongAdder()).increment();

        Long started = ctx.attribute("startedNanos");
        long elapsedMs = started == null ? 0 : (System.nanoTime() - started) / 1_000_000L;
        // one slot per bucket, then the sum, then the total count
        long[] buckets = latency.computeIfAbsent(method + "|" + route, key -> new long[LATENCY_BUCKETS_MS.length + 2]);
        synchronized (buckets) {
            for (int i = 0; i < LATENCY_BUCKETS_MS.length; i++) {
                if (elapsedMs <= LATENCY_BUCKETS_MS[i]) {
                    buckets[i]++;
                }
            }
            buckets[LATENCY_BUCKETS_MS.length] += elapsedMs;
            buckets[LATENCY_BUCKETS_MS.length + 1]++;
        }

        log.info(
                Markers.append("method", method)
                        .and(Markers.append("route", route))
                        .and(Markers.append("path", ctx.path()))
                        .and(Markers.append("status", status))
                        .and(Markers.append("elapsedMs", elapsedMs)),
                "request");
    }

    /** One floor planned. */
    public void planRun() {
        planRuns.increment();
    }

    /** One window ask answered. */
    public void windowAsk() {
        windowAsks.increment();
    }

    /** The metrics page, in Prometheus text exposition format. */
    public String render() {
        StringBuilder out = new StringBuilder(2048);

        out.append("# HELP ").append(prefix).append("_http_requests_total Requests served, by route, method, and status.\n")
                .append("# TYPE ").append(prefix).append("_http_requests_total counter\n");
        for (Map.Entry<String, LongAdder> row : new TreeMap<>(requests).entrySet()) {
            String[] parts = row.getKey().split("\\|", 3);
            out.append(prefix).append("_http_requests_total{method=\"").append(label(parts[0]))
                    .append("\",path=\"").append(label(parts[1]))
                    .append("\",status=\"").append(label(parts[2]))
                    .append("\"} ").append(row.getValue().sum()).append('\n');
        }

        out.append("# HELP ").append(prefix).append("_http_request_latency_ms Request latency in milliseconds, by route and method.\n")
                .append("# TYPE ").append(prefix).append("_http_request_latency_ms histogram\n");
        for (Map.Entry<String, long[]> row : new TreeMap<>(latency).entrySet()) {
            String[] parts = row.getKey().split("\\|", 2);
            long[] buckets = row.getValue();
            synchronized (buckets) {
                for (int i = 0; i < LATENCY_BUCKETS_MS.length; i++) {
                    out.append(prefix).append("_http_request_latency_ms_bucket{method=\"").append(label(parts[0]))
                            .append("\",path=\"").append(label(parts[1]))
                            .append("\",le=\"").append(LATENCY_BUCKETS_MS[i]).append("\"} ")
                            .append(buckets[i]).append('\n');
                }
                long count = buckets[LATENCY_BUCKETS_MS.length + 1];
                out.append(prefix).append("_http_request_latency_ms_bucket{method=\"").append(label(parts[0]))
                        .append("\",path=\"").append(label(parts[1]))
                        .append("\",le=\"+Inf\"} ").append(count).append('\n');
                out.append(prefix).append("_http_request_latency_ms_count{method=\"").append(label(parts[0]))
                        .append("\",path=\"").append(label(parts[1])).append("\"} ").append(count).append('\n');
                out.append(prefix).append("_http_request_latency_ms_sum{method=\"").append(label(parts[0]))
                        .append("\",path=\"").append(label(parts[1])).append("\"} ")
                        .append(buckets[LATENCY_BUCKETS_MS.length]).append('\n');
            }
        }

        out.append("# HELP ").append(prefix).append("_refusals_total Requests refused at the gate, by reason.\n")
                .append("# TYPE ").append(prefix).append("_refusals_total counter\n");
        for (Map.Entry<String, LongAdder> row : new TreeMap<>(refusals).entrySet()) {
            out.append(prefix).append("_refusals_total{reason=\"").append(label(row.getKey()))
                    .append("\"} ").append(row.getValue().sum()).append('\n');
        }

        out.append("# HELP ").append(prefix).append("_plan_runs_total Floors planned.\n")
                .append("# TYPE ").append(prefix).append("_plan_runs_total counter\n")
                .append(prefix).append("_plan_runs_total ").append(planRuns.sum()).append('\n');
        out.append("# HELP ").append(prefix).append("_window_asks_total Window asks answered by the gate.\n")
                .append("# TYPE ").append(prefix).append("_window_asks_total counter\n")
                .append(prefix).append("_window_asks_total ").append(windowAsks.sum()).append('\n');
        out.append("# HELP ").append(prefix).append("_uptime_seconds Seconds this process has been serving.\n")
                .append("# TYPE ").append(prefix).append("_uptime_seconds gauge\n")
                .append(prefix).append("_uptime_seconds ")
                .append(String.format(java.util.Locale.ROOT, "%.3f", (System.nanoTime() - startedAtNanos) / 1e9))
                .append('\n');
        return out.toString();
    }

    private void refused(String reason) {
        refusals.computeIfAbsent(reason, key -> new LongAdder()).increment();
    }

    /** Fixed one-minute window per client; honest and cheap, which is the point here. */
    private boolean allow(String ip) {
        long window = System.currentTimeMillis() / 1000 / 60;
        long[] cell = windows.compute(ip, (key, old) -> {
            if (old == null || old[0] != window) {
                return new long[] {window, 1};
            }
            old[1]++;
            return old;
        });
        return cell[0] == window && cell[1] <= options.requestsPerMinute();
    }

    private String label(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
