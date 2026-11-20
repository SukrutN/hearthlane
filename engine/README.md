# Hearthline plan

Hearthline plans a fixed set of AMR tasks across one floor. You send a floor
document — corridors, aisles, tasks with priority classes and due ticks — and
it returns a joint plan: when each robot departs, when it arrives, where the
conflict tree had to split, and whether every deadline can be met at once.

It does not keep a fleet, an order stream, or a vehicle simulator. Nothing is
stored after the response. This planner lives at `engine/` in the
[hearthlane](https://github.com/SukrutN/hearthlane) site repository, its full
history carried over from the old `hearthline-plan` repository. The site's
pages are a visual walkthrough of one fictional hall. The figures on that site
are locked to the reading this engine prints.

**Fiction disclaimer.** The Ferro & Lume casting hall is invented — the floor,
the tasks, the fleet names, and every figure. The method they demonstrate is
not, and its sources are cited below.

## Run the tests

Java 21 and Maven 3.9 or newer. From the repository root (or from `engine/`,
with the paths dropped):

```bash
mvn -B -f engine verify
```

The domain tests are hand cases (swap, pocket, crossing, deadline prune, priority
tie-break, cardinal splits, gate fire/hesitate). The application tests lock the
canonical reading of the casting hall fixture, figure by figure.

## Plan a floor from a file

```bash
mvn -B -f engine -DskipTests package
java -jar engine/cli/target/hearth.jar plan engine/fixtures/casting-hall.json
```

The reading prints the degradation ladder, the arrivals against their dues, the
conflict-density map, the replication study, the deadline curve, and the gate
journal. `hearth windows engine/fixtures/casting-hall.json` prints just the gate
journal. The document format is [docs/windows.md](docs/windows.md).

## Serve the API

```bash
java -jar engine/api/target/hearth-api.jar
```

The process listens on port 8093. `PORT` changes it.

```bash
curl -s http://127.0.0.1:8093/health
curl -s http://127.0.0.1:8093/v1/plan -H 'content-type: application/json' -d '{"fixture":"casting-hall"}'
curl -s http://127.0.0.1:8093/v1/windows -H 'content-type: application/json' -d '{"fixture":"casting-hall","request":{"id":"W-9","amr":"Kiln","klass":"express","origin":[8,9],"destination":[0,9],"earliest":0,"latest":25}}'
```

An unknown fixture name or a malformed ask is HTTP 400 with
`application/problem+json` — `urn:hearth:unknown-fixture` or
`urn:hearth:rejection`. Send an inline floor under `document` when you do not
want a published fixture. The OpenAPI document is at `/v1/openapi.yaml`.

## What the reading says

On the casting hall (12×9, 68 open cells, six tasks, horizon 30, seed 2027):

- **Ladder** — CBS solves the batch at sum 69 in 34 expansions; ICBS reaches the
  same optimum in 23; prioritized planning fails and reports no sum and no gap.
- **Arrivals** — all six land inside their dues (Tinder, due tick 9, lands at 5).
- **Density** — the tree splits almost entirely in ticks 4–7; South Run carries
  the only cardinal sides.
- **Replications** — eight seeded shuffles, seeds 2027–2034: split density
  tracks mean reservation rejections at r = 0.69.
- **Curve** — the joint tree solves every batch prefix (sums 19 through 69);
  prioritized's hit rate drops to 0.5.
- **Gate** — Kiln's express ask fires into a clear Dispatch Apron; Ash's ask
  hesitates because the Main Run carries conflict density in ticks 4–7.

## Sources

- Sharon, G., Stern, R., Goldenberg, M., Felner, A. (2015). *Conflict-based
  search for optimal multi-agent pathfinding.* Artificial Intelligence
  219: 406–442. The solver is CBS; ICBS is the same paper's improved variant.
  The deadline prune and priority tie-break are extensions described relative
  to it.
- openTCS (Fraunhofer IML, MIT) — <https://github.com/openTCS/opentcs> — an
  industry system that splits transport tasks, vehicle state, and scheduling.
  The window-request API mirrors that dispatch seam conceptually; this engine
  is lighter and mathier, and does not manage vehicles.
- Open-RMF — <https://github.com/open-rmf/rmf> — `rmf_traffic` negotiates
  time-space schedules; `rmf_task` handles task deadlines. The deadline curve
  and window gate here are the nearest concepts, worked small.

## Where to read next

- [docs/architecture.md](docs/architecture.md) — why the domain is separate,
  and why there is no database
- [docs/windows.md](docs/windows.md) — the floor document, the window ask, and
  the gate rules
