# Hearthlane

Live site: https://sukrutn.github.io/hearthlane/

The showcase site for the **Hearthline planner** (`engine/` in this
repository), a fictional warehouse whose release gate you can read in the
browser. Hearthlane walks the same fixture run the planner's own tests assert:
the degradation ladder, the served arrivals, the congestion heatmap, the
deadline-hit-rate curve, and a release-gate journal. One ask fires, one
hesitates, and both carry the reason.

**Fiction disclaimer.** The Ferro & Lume warehouse is not a real building,
and its eight robots are not a fleet: every figure on the site is a worked
example invented for the planner. The site renders those figures without
invention of its own.

## What the site shows

- **Product and demo, labeled apart**: the hero states what the planner does
  with any floor you send it, then names the fictional warehouse that
  demonstrates
  it, and every section carries a chip saying which is which.
- **Three ways to plan one batch**: conflict-based search, improved
  conflict-based search, and prioritized planning. The top two reach the same
  cost of 69; the third reports no cost and no gap, because prioritized
  planning cannot serve AMR-3 under the traffic booked ahead of it.
- **Every deadline met**: the served plan's arrivals against their dues. Every
  robot arrives by tick 19.
- **The congestion map**: where the search split, region by four-tick bucket,
  with the sides that had no cheaper way out marked.
- **Who lands on time as batches grow**: the joint plan holds at every batch
  size; prioritized planning breaks at batch three.
- **The replication study**: eight shuffles of the manifest order. A region's
  split density tracks its mean reservation rejections at 0.69.
- **The planner at fleet scale**: the warehouse is the walkthrough; the engine is
  sized for a fleet. On its largest legal floor, 64 by 64, a hundred robots
  in spaced pairs plan jointly in about 67 milliseconds, every due met, and
  the repeat run agrees path for path.
- **Walking the gate**: an interactive panel runs the gate rule in the
  browser against the same published density, and the fixture's two asks are
  answered with the reasons quoted.

## Accessibility and rendering

The words state what the planner does, plainly: one provenance line per page
says where the figures come from, and the fiction disclaimer is stated once
per page. Entrances are scrubbed to the scroll position, never timed: under
reduced motion or without JavaScript every element renders in its settled
state, which is also what the static export ships. The social card
(`src/app/opengraph-image.png`) and the 404 page follow the same system.
Type is set in open faces (Space Grotesk, IBM Plex Mono) served by
`next/font`; no licensed typeface is bundled or hotlinked.

## Where the figures come from

Every number on the site is locked to the engine. `src/lib/figures.ts` ports
the canonical reading asserted by the planner's behavior test
(`HearthBehaviorTest`, at `engine/`), and `src/lib/figures.test.ts` re-asserts
each figure here. That is the site's half of the characterization contract,
run in the same CI as the engine's half. `src/lib/fixture.ts` reads the
planner's published fixture, `engine/fixtures/casting-hall.json`.

If the engine's figures move, the engine test moves first, then this port.
The site computes no figure of its own.

## Sources

- Sharon, G., Stern, R., Goldenberg, M., Felner, A. (2015). *Conflict-based
  search for optimal multi-agent pathfinding.* Artificial Intelligence
  219: 406-442.
- Wurman, P. R., D'Andrea, R., Mountz, M. (2008). *Coordinating hundreds of
  cooperative, autonomous vehicles in warehouses.* AI Magazine 29(1): 9-19.
  The industrial demonstration that hundred-robot fleets are coordinable;
  the planner's scale proof runs the same argument.
- openTCS (Fraunhofer IML, MIT). <https://github.com/openTCS/opentcs> The
  project splits transport tasks, vehicle state, and scheduling the way an
  industry system does. The window-request API mirrors that dispatch seam,
  lighter and with more math.
- Open-RMF. <https://github.com/open-rmf/rmf> `rmf_traffic` negotiates
  time-space schedules; `rmf_task` carries task deadlines. The deadline curve
  on the windows page is that argument made small.

## The planner

The planner lives at **`engine/`** in this repository (Java 21, Maven,
stateless): CBS and ICBS over a painted floor grid, deadline-pruned space-time
search, priority tie-breaks, the density signal, the degradation ladder, and
the window gate. Its CLI (`hearth plan`, `hearth windows`) prints the same
reading this site renders.

## Run it

```sh
npm install
npm test        # 12 assertions locking the canonical figures and the scale proof
npm run dev     # http://[::1]:38911
npm run build
```

Node 20+ recommended. Pages are server-rendered; there is no data fetching.
The fixture and the figures are committed source.

## License

MIT — see [LICENSE](LICENSE).
