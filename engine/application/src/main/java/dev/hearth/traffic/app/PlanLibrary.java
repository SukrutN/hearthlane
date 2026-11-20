package dev.hearth.traffic.app;

import dev.hearth.traffic.PlanInput;
import dev.hearth.traffic.PlanRejection;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** The floors the engine ships with, read from the classpath. */
public final class PlanLibrary {

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
}
