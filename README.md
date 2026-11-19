# hearthlane

Live site: https://sukrutn.github.io/hearthlane/

The showcase site for **`hearthline-plan`** — a fictional casting hall whose
release gate you can read in the browser. Hearthlane walks the same fixture run
the planner's own tests assert: the degradation ladder, the served arrivals, the
congestion heatmap, the deadline-hit-rate curve, and a release-gate decision
journal (one window ask fires, one hesitates, both with the reason journaled).

**Fiction disclaimer.** Ferro & Lume is not a foundry. Ember, Brann, Tinder,
Soot, Cinder, Slag, Kiln, and Ash are not a fleet. Every figure on the site is
a worked example invented for the planner — the site renders those figures
without invention of its own.

## What the site shows

- **The degradation ladder** — CBS → ICBS → prioritized, with the honest
  optimality gap: same sum of costs (69) at the top two rungs, and a third rung
  that reports *no sum and no gap* because prioritized planning cannot serve
  Tinder under the traffic booked ahead of it.
- **Every deadline met** — the ICBS plan's arrivals against their dues.
- **The congestion heatmap** — cardinal-conflict density, region by four-tick
  bucket, exactly the cells where the conflict tree split.
- **The deadline-hit-rate curve** — batches of growing size; the joint tree
  never drops, prioritized breaks at batch 3.
- **The replication study** — eight seeded shuffles of the manifest order;
  a region's split density tracks its mean reservation rejections at
  r = 0.69.
- **Walking the gate** — `request_window` answered from the served plan:
  fire into a clear corridor, hesitate into conflict density, reasons quoted.

## Where the figures come from

Every number on the site is locked to the engine. `src/lib/figures.ts` ports
the canonical reading asserted by `hearthline-plan`'s behavior test
(`HearthBehaviorTest`), and `src/lib/figures.test.ts` re-asserts each figure
here — the site's half of the characterization contract. `src/lib/fixture.ts`
is a TypeScript port of the planner's fixture,
`hearthline-plan/fixtures/casting-hall.json`.

If the engine's figures move, the engine test moves first, then this port.
The site never computes a figure of its own.

## Sources

- Sharon, G., Stern, R., Goldenberg, M., Felner, A. (2015). *Conflict-based
  search for optimal multi-agent pathfinding.* Artificial Intelligence
  219: 406–442.
- openTCS (Fraunhofer IML, MIT) — <https://github.com/openTCS/opentcs> — how
  "transport tasks + vehicle state + scheduling" split reads in an industry
  system; the window-request API mirrors its dispatch seam conceptually,
  lighter and mathier.
- Open-RMF — <https://github.com/open-rmf/rmf> — `rmf_traffic` negotiates
  time-space schedules; `rmf_task` carries task deadlines. The deadline curve
  on the windows page is that argument made small.

## The sibling repository

The planner lives in **`hearthline-plan`** (Java 21, Maven, stateless): CBS and
ICBS over a painted floor grid, deadline-pruned space-time search, priority
tie-breaks, the density signal, the degradation ladder, and the window gate.
Its CLI (`hearth plan`, `hearth windows`) prints the same reading this site
renders.

## Run it

```sh
npm install
npm test        # 11 assertions locking the canonical figures
npm run dev     # http://[::1]:38911
npm run build
```

Node 20+ recommended. Pages are server-rendered; there is no data fetching —
the fixture and the figures are committed source.
