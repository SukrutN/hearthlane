# Architecture

## Four Maven modules, one direction of dependency

```
domain        the planner math: floor, search, conflicts, density, gate
application   documents in, readings out (JSON parse, report assembly, text render)
api           HTTP adapter (Javalin): routes and problem documents only
cli           the `hearth` command: file in, text out
```

`domain` depends on nothing. `application` depends on `domain`. `api` and `cli`
depend on `application`. The planning rules never move outward: an HTTP route
cannot fix a reservation, and the CLI cannot invent a figure.

## The domain reads like the method

- `FloorGrid` paints the floor from corridor runs — first paint wins — and
  answers open/closed per cell.
- `SpaceTimePlanner` searches one agent through space *and time* against a
  `ReservationTable` (vertex and edge constraints, swap checks, goal claims).
- `ConflictSolver` runs CBS and ICBS over that planner: high-level tree of
  constraint branches, low-level replans, and the ICBS extensions —
  cardinality measurement, bypass-lite, and the priority tie-break.
- `PrioritizedSolver` is the honest fallback: plan in order, refuse when an
  agent cannot land in time.
- `DegradationLadder` runs all three and reports the optimality gap. An
  unsolved rung reports no sum and no gap.
- `DensitySignal` turns the tree's splits into a region-by-bucket map; the
  `cardinal` count is the split's sides with no cheaper way out.
- `ReplicationStudy` shuffles the manifest order under seeds and correlates
  density with rejections — the license for reading density as congestion.
- `WindowService` answers a `WindowRequest` from a *served* plan: grant or SLO
  violation report, then a gate decision (fire or hesitate) with reasons.

## Stateless by construction

No repository, no cache, no database. `PlanInput` in, report out. The seeded
replication study uses `Random(seed)` from the document, so a document replays
to the same figures anywhere. Two `POST`s with the same body return the same
body.

The engine does keep a *temporary* state — a reservation table inside one
solve — but it never outlives the call.

## The engine and the site

The showcase site (`hearthlane`) is a separate repository. It does not call the
engine at runtime: it renders the canonical reading of one fixture, and a test
in each repository asserts the same figures. When the engine's figures move,
its behavior test moves first, and the site's port follows. That is the
characterization contract; the alternative — a live engine behind the site —
would make every figure a claim instead of a quotation.
