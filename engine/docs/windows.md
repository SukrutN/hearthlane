# Windows: the floor document and the release gate

## The floor document

A document is JSON with four parts. `fixtures/casting-hall.json` is the
worked example this file walks through.

```json
{
  "floor":    { "id": "casting-hall", "name": "Ferro & Lume casting hall",
                "width": 12, "height": 9, "runs": [ ... ] },
  "tasks":    [ { "id": "T-01", "amr": "AMR-1", "klass": "express",
                  "start": [8, 0], "goal": [0, 11], "due": 22 }, ... ],
  "horizon":  30,
  "seed":     2027,
  "windows":  [ { "id": "W-1", "amr": "AMR-7", "klass": "express",
                  "origin": [8, 9], "destination": [0, 9],
                  "earliest": 0, "latest": 25 }, ... ]
}
```

**Floor.** Cells are `[row, col]`, row 0 at the north wall. A `run` paints a
corridor across a row (`"row": 3, "from": 0, "to": 11`) or an aisle down a
column (`"col": 9, "from": 1, "to": 7`), and names its region. First paint
wins, so corridor runs come before aisle runs and the painted regions tile
without overlap. A cell no run paints is rack: nobody walks it.

**Tasks.** One line per AMR: a priority class (`express`, `standard`, `bulk`)
and a due tick. The deadline prunes. A state whose earliest possible arrival
(`arrive + manhattan`) is already past the due is thrown out before the tree
ever splits on it. Priority breaks ties: when the tree must branch on a
conflict, the lower-priority agent takes the constraint first. Starts and
goals must be distinct across tasks; each due must fit the horizon.

**Horizon and seed.** The horizon bounds every search (one cell per tick).
The seed drives the replication study. The reading shuffles the manifest
order under `seed` through `seed + 7` and reports whether the density map
predicted the rejections. A document replays to the same figures anywhere.

**Windows.** Optional asks riding in the document, so the gate walkthrough is
data rather than code. The `/v1/windows` endpoint accepts these inline too.

## The window ask

The orchestrator calls before it releases AMR work from its batch:

```
request_window(agent_class, origin, destination, earliest, latest)
      → window grant  |  SLO-violation report
```

Semantics, stated plainly:

- `earliest` is a *not-before*: the AMR cannot leave its origin cell before
  that tick. It may wait there for free.
- `latest` is the deadline: the run must arrive by that tick.
- The ask is answered against the *served plan*: the traffic the current
  manifest already booked, including permanent goal claims. A destination
  another robot parks on is not routable.

## The SLO-violation report

When the ask cannot be granted, the response is a report, not an error:

```json
{
  "granted": false,
  "grant": null,
  "slo": {
    "amr": "AMR-8",
    "earliestArrival": 11,
    "reasons": [
      "The window closes at tick 20 before the run can land.",
      "Under today's traffic the earliest arrival is tick 11."
    ]
  }
}
```

`earliestArrival` is null when no route stands open at all (for example, a
destination that is permanently goal-claimed). The reasons read like a
planner's margin notes and are part of the format: the orchestrator's contract
test asserts them. The four structural refusals (a closed origin cell, a
closed destination cell, a window closing past the horizon, a window opening
after it closes) return before any routing, with `earliestArrival` null.

## The gate: hesitate, or fire

A grant alone does not fire the AMR. The gate also reads the conflict tree the
served plan met:

- **Fire** iff the ask is granted *and* the origin region carries no split
  with a nonzero cost rise in the departure bucket (buckets are four ticks).
  Reason: "The {region} is clear at the departure."
- **Hesitate** otherwise, with the span journaled:
  "The {region} carries conflict density in ticks a to b."

On the casting hall: AMR-7's express ask into the Dispatch Apron at tick 0
fires, because the apron is clear at the departure. AMR-8's ask into the Main
Run at tick 4 hesitates. The Main Run splits three times in ticks 4 to 7, and
those splits cost the tree real work.

The hesitation is the density signal doing its job: the same map the
replication study correlates with rejections (r = 0.69) is the map the gate
reads before releasing a wave. A held ask can be retried in a later bucket
without replanning.

## The HTTP contract

```bash
curl -s http://127.0.0.1:8093/v1/windows -H 'content-type: application/json' -d '{
  "fixture": "casting-hall",
  "request": { "id": "W-9", "amr": "AMR-7", "klass": "express",
               "origin": [8, 9], "destination": [0, 9],
               "earliest": 0, "latest": 25 }
}'
```

The response carries `decision` (`fire` or `hesitate`), `reasons`, and the
full `verdict`. Malformed asks are HTTP 400 with `application/problem+json`.
The full schema is at `/v1/openapi.yaml`, and `hearth windows
fixtures/casting-hall.json` prints the same journal as plain text.
