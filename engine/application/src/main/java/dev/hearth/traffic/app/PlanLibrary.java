package dev.hearth.traffic.app;

import dev.hearth.traffic.PlanInput;
import dev.hearth.traffic.PlanRejection;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** The floors the engine ships with, read from the classpath. */
public final class PlanLibrary {

    private static final java.util.regex.Pattern PUBLISHED_NAME =
            java.util.regex.Pattern.compile("^([a-z0-9-]+)\\.json\\b");

    private PlanLibrary() {}

    public static PlanInput load(String name) {
        String resource = "fixtures/" + name + ".json";
        InputStream stream = PlanLibrary.class.getClassLoader().getResourceAsStream(resource);
        if (stream == null) {
            throw new UnknownFixture(name);
        }
        try (InputStream source = stream) {
            return HearthJson.parse(new String(source.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new PlanRejection(List.of("The fixture " + name + " could not be read: " + e.getMessage()));
        }
    }

    /**
     * The published floor names, read from the fixture index the engine ships,
     * so a client can offer the floors without guessing at them.
     */
    public static List<String> names() {
        InputStream stream = PlanLibrary.class.getClassLoader().getResourceAsStream("fixtures/INDEX.txt");
        if (stream == null) {
            throw new IllegalStateException("fixtures/INDEX.txt is missing from the classpath");
        }
        try (InputStream source = stream) {
            List<String> names = new ArrayList<>();
            for (String line : new String(source.readAllBytes(), StandardCharsets.UTF_8).lines().toList()) {
                java.util.regex.Matcher match = PUBLISHED_NAME.matcher(line.trim());
                if (match.find()) {
                    names.add(match.group(1));
                }
            }
            return List.copyOf(names);
        } catch (IOException e) {
            throw new IllegalStateException("fixtures/INDEX.txt could not be read", e);
        }
    }
}
