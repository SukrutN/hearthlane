package dev.hearth.traffic.app;

import dev.hearth.traffic.PlanRejection;

import java.util.List;

/** The fixture library carries no floor by that name. */
public class UnknownFixture extends PlanRejection {

    public UnknownFixture(String name) {
        super(List.of("No fixture answers to " + name + "; the library carries casting-hall."));
    }
}
