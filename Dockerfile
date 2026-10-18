# syntax=docker/dockerfile:1
# The hearthlane planner's image: build the shaded jar with the pinned
# toolchain, then ship only the JRE and the jar. The verify step runs the
# whole engine suite inside the build, so an image that exists is an image
# that passed.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY engine/ engine/
RUN mvn -B -f engine verify

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/engine/api/target/hearth-api.jar /app/hearth-api.jar
# The platform's probes should hit /health for liveness and /ready for
# readiness; both stay open alongside /metrics and the workbench page.
ENV PORT=8093
EXPOSE 8093
ENTRYPOINT ["java", "-jar", "/app/hearth-api.jar"]
