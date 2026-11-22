import type { Metadata } from "next"
import Link from "next/link"
import { GatePanel } from "@/components/gate-panel"
import { Marquee, SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { RouteScrubber } from "@/components/route-scrubber"
import {
  ARRIVALS,
  BUCKETS,
  CORRELATION,
  CURVE,
  DENSITY,
  JOURNAL,
  LADDER,
  MAKESPAN,
  REPLICATION_REGIONS,
  SERVED_SUM,
  bucketLabel,
  splitsAt,
} from "@/lib/figures"
import { CASTING_HALL, paintFloor } from "@/lib/fixture"

export const metadata: Metadata = {
  title: "Windows",
  description:
    "Three ways to plan one batch, the arrivals against their deadlines, the congestion map, the batch curve, and a release gate you can walk. The numbers are the planner's actual output for the demo warehouse, not a mockup.",
}

const REGIONS = ["North Run", "Main Run", "South Run", "Dispatch Apron", "West Aisle", "Aisle Two"]

const SOLVER_NAMES: Record<string, string> = {
  CBS: "Conflict-based search",
  ICBS: "Improved conflict-based search",
  prioritized: "Prioritized planning",
}

function regionOrder(rows: typeof DENSITY): string[] {
  const present = new Set(rows.map((row) => row.region))
  const ordered = REGIONS.filter((region) => present.has(region))
  for (const region of present) {
    if (!ordered.includes(region)) ordered.push(region)
  }
  return ordered
}

/** Heat tint for a hot cell: intensity follows the split count, capped at 8. */
function heat(splits: number): string {
  const intensity = Math.min(splits, 8) / 8
  const share = 22 + Math.round(intensity * 68)
  return `color-mix(in srgb, #ff36a8 ${share}%, #fffafe)`
}

const CHIP_DEMO = "bg-neon-yellow px-1.5 py-0.5 font-mono text-[10px] tracking-[0.14em] text-foreground uppercase"
const CHIP_PRODUCT = "border border-neon-violet px-1.5 py-0.5 font-mono text-[10px] tracking-[0.14em] text-neon-violet uppercase"

const KLASSED: Record<string, string> = {
  express: "Express",
  standard: "Standard",
  bulk: "Bulk",
}

export default function WindowsPage() {
  const regions = regionOrder(DENSITY)
  const maxSplits = Math.max(...DENSITY.map((row) => row.splits))
  const floor = paintFloor(CASTING_HALL)
  const cbs = LADDER.find((rung) => rung.solver === "CBS")

  /** The region a cell sits in, in the floor's own words. */
  const regionAt = (cell: [number, number]) => floor[cell[0]][cell[1]] ?? "the racks"

  // Curve geometry: batches 1..6 on the x axis, hit rate 0..1 on the y.
  const curveWidth = 260
  const curveHeight = 120
  const pad = 18
  const pointAt = (index: number, rate: number) => {
    const x = pad + (index / (CURVE.length - 1)) * (curveWidth - pad * 2)
    const y = curveHeight - pad - rate * (curveHeight - pad * 2)
    return [x, y] as const
  }
  const curveLine = CURVE.map((row, index) => pointAt(index, row.hitRate).join(",")).join(" ")

  return (
    <>
      <SiteHeader />
      <main id="content">
        <section className="bg-deep px-5 pt-12 pb-14 text-paper sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-neon-violet uppercase">02. Release windows</p>
          <h1
            data-reveal
            className="display-hero mt-6 max-w-[14ch] leading-[0.86] font-medium tracking-[-0.04em]"
          >
            Hesitate, or <span className="text-neon-yellow">fire</span>
          </h1>
          <div data-reveal className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <p className="max-w-xl text-lg leading-snug text-paper/80 sm:text-xl">
              Before your warehouse execution system (WES) releases a wave, it asks one question: is the floor free?
              Hearthlane answers from the plan your robots will actually run, and records the reason either way.
            </p>
            <div className="max-w-md">
              <p className="mb-3 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
                <span className={CHIP_DEMO}>Demo</span>
                <span className="text-paper/70">One run of the demo warehouse</span>
              </p>
              <p className="text-paper/70">
                Everything below is one run of the demo warehouse: six tasks and a thirty-tick clock. The numbers are
                the planner&apos;s actual output, not a mockup.
              </p>
            </div>
          </div>
        </section>

        {/* Ladder */}
        <section id="ladder" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-silver">Three planners, one floor</span>
          </p>
          <div data-reveal className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="display-section tracking-[-0.04em]">Three ways to plan one batch</h2>
            <p className="max-w-md text-silver">
              The cost is the total travel across all six routes, and lower is better; the gap tells you how close a
              plan sits to the best cost possible.
            </p>
          </div>
          <ul className="mt-10">
            {LADDER.map((rung) => (
              <li
                key={rung.solver}
                data-reveal="row"
                className="grid items-baseline gap-2 border-t border-foreground/10 py-5 sm:grid-cols-[16rem_1fr] sm:gap-8"
              >
                <span>
                  <span className="tracking-[-0.02em]">{SOLVER_NAMES[rung.solver]}</span>
                  <span className="block font-mono text-[11px] tracking-[0.14em] text-signal uppercase">
                    ({rung.solver})
                  </span>
                </span>
                <span className={`text-sm leading-6 ${rung.solved ? "text-foreground" : "text-ember"}`}>
                  {rung.solved ? (
                    rung.solver === "ICBS" ? (
                      <>
                        The same plan for less work: it checks which side of a conflict has a cheaper escape and skips
                        the dead ends, {rung.expanded} search steps instead of {cbs?.expanded}.
                      </>
                    ) : (
                      <>
                        The best joint plan: {rung.sum} ticks of travel across all six routes, and nothing cheaper
                        exists. Proven in {rung.expanded} search steps.
                      </>
                    )
                  ) : (
                    <span>
                      <span className="text-neon-red">Refused</span> · {rung.reason} It reports no cost and no gap
                      rather than offering a plan it cannot stand behind.
                    </span>
                  )}
                </span>
              </li>
            ))}
            <li className="border-t border-foreground/10" />
          </ul>
          <p className="mt-6 max-w-2xl text-sm text-silver">
            Search steps are the work the planner did to prove its answer, so fewer steps means a faster answer for
            you. The improved solver tries both sides of each conflict and commits to the cheaper one. Planning one
            robot at a time fails here: booking AMR-1 first blocks the robot due at tick 9, so the third rung refuses
            outright.
          </p>
        </section>

        {/* Arrivals */}
        <section id="arrivals" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-silver">The arrivals against their dues</span>
          </p>
          <div data-reveal className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="display-section tracking-[-0.04em]">Every deadline met</h2>
            <p className="max-w-md text-silver">
              Every robot arrives inside its deadline, the last one by tick {MAKESPAN}, and the six routes together
              cost {SERVED_SUM} ticks of travel.
            </p>
          </div>
          <ul className="mt-10">
            {ARRIVALS.map((row) => {
              const slack = row.due - row.arrived
              return (
                <li
                  key={row.id}
                  data-reveal="row"
                  className="grid items-baseline gap-2 border-t border-foreground/10 py-4 sm:grid-cols-[4rem_8rem_1fr_14rem] sm:gap-4"
                >
                  <span className="font-mono text-sm text-signal">{row.id}</span>
                  <span className="font-mono text-sm">
                    {row.amr} <span className="text-silver">{KLASSED[row.klass]}</span>
                  </span>
                  <span className="font-mono text-xs text-silver">
                    from {row.start[0]},{row.start[1]} to {row.goal[0]},{row.goal[1]}
                  </span>
                  <span className="font-mono text-sm">
                    due at {row.due}, landed at {row.arrived}
                    <span className="text-silver"> with {slack} ticks to spare</span>
                  </span>
                </li>
              )
            })}
            <li className="border-t border-foreground/10" />
          </ul>
        </section>

        {/* Heatmap */}
        <section id="density" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-silver">Where the morning wave splits</span>
          </p>
          <div data-reveal className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="display-section tracking-[-0.04em]">The congestion map</h2>
            <p className="max-w-md text-silver">
              Where the planner had to work hardest, region by four-tick window. A dot marks a spot it could not route
              around cheaply.
            </p>
          </div>
          <div data-reveal className="mt-10">
            <div
              className="grid gap-1 font-mono text-[10px] tracking-[0.1em] text-silver uppercase"
              style={{ gridTemplateColumns: `minmax(4.75rem, 9rem) repeat(${BUCKETS}, minmax(1.5rem, 1fr))` }}
              role="img"
              aria-label="Conflict density by region and four-tick bucket"
            >
                <span />
                {Array.from({ length: BUCKETS }, (_, bucket) => (
                  <span key={bucket} className={bucket === 1 ? "text-signal" : undefined}>
                    {bucketLabel(bucket)}
                  </span>
                ))}
                {regions.map((region) => (
                  <div key={region} className="contents">
                    <span className="py-2 pr-3 text-[11px] normal-case">{region}</span>
                    {Array.from({ length: BUCKETS }, (_, bucket) => {
                      const cell = splitsAt(DENSITY, region, bucket)
                      const column = { animationDelay: `${bucket * 1.1}s` } as const
                      if (!cell) {
                        return (
                          <span
                            key={`${region}-${bucket}`}
                            className="heat-cell h-10 border border-foreground/10 bg-card"
                            style={column}
                          />
                        )
                      }
                      const intensity = cell.splits / maxSplits
                      const ink = intensity > 0.55 ? "#fff0fa" : "#221531"
                      return (
                        <span
                          key={`${region}-${bucket}`}
                          className="heat-cell relative flex h-10 items-center justify-center font-mono text-xs"
                          style={{ background: heat(cell.splits), color: ink, ...column }}
                        >
                          {cell.splits}
                          {cell.cardinal > 0 ? (
                            <span
                              className="absolute right-0.5 bottom-0.5 size-1.5 rounded-full"
                              style={{ background: ink }}
                            />
                          ) : null}
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm text-silver">
            A split is the planner trying both sides of a conflict, so more splits means more traffic forcing choices
            there. The rush squeezes into ticks 4 to 7: South Run carries the four conflicts with no cheaper way out,
            and the Dispatch Apron heats up at ticks 8 to 11 as the bulk runs come home. Aisle Three never gives
            anyone trouble, which is exactly why the plan routes around the rush through it.
          </p>
        </section>

        {/* Deadline curve */}
        <section id="curve" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-silver">Batches under load</span>
          </p>
          <div data-reveal className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="display-section tracking-[-0.04em]">Who lands on time as batches grow</h2>
            <p className="max-w-md text-silver">
              Release bigger and bigger batches and watch who keeps up. The joint plan holds at every size;
              one-robot-at-a-time planning drops its first task at batch three.
            </p>
          </div>
          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
            <figure data-reveal>
              <svg
                viewBox={`0 0 ${curveWidth} ${curveHeight}`}
                className="w-full"
                role="img"
                aria-label="Deadline hit rate by batch size: 1.0, 1.0, 0.67, 0.5, 0.6, 0.5"
              >
                <line
                  x1={pad}
                  y1={curveHeight - pad}
                  x2={curveWidth - pad}
                  y2={curveHeight - pad}
                  stroke="#221531"
                  strokeWidth="1"
                  opacity="0.35"
                />
                <line
                  x1={pad}
                  y1={pad}
                  x2={curveWidth - pad}
                  y2={pad}
                  stroke="#221531"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  opacity="0.3"
                />
                <polyline points={curveLine} fill="none" stroke="#ff36a8" strokeWidth="2" />
                {CURVE.map((row, index) => {
                  const [x, y] = pointAt(index, row.hitRate)
                  return (
                    <g key={row.batch}>
                      <circle cx={x} cy={y} r="4" fill="#ff36a8" />
                      <text
                        x={x}
                        y={curveHeight - 4}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#6d5f7e"
                        fontFamily="var(--font-mono-plex), monospace"
                      >
                        {row.batch}
                      </text>
                    </g>
                  )
                })}
                <text
                  x={curveWidth - pad}
                  y={pad - 6}
                  textAnchor="end"
                  fontSize="9"
                  fill="#6d5f7e"
                  fontFamily="var(--font-mono-plex), monospace"
                >
                  1.0
                </text>
                <text
                  x={curveWidth - pad}
                  y={curveHeight - pad - 6}
                  textAnchor="end"
                  fontSize="9"
                  fill="#6d5f7e"
                  fontFamily="var(--font-mono-plex), monospace"
                >
                  0.5
                </text>
              </svg>
              <figcaption className="mt-3 font-mono text-[10px] tracking-[0.14em] text-silver uppercase">
                Share of the batch on time · prioritized planning
              </figcaption>
            </figure>
            <div>
              <ul>
                {CURVE.map((row) => (
                  <li
                    key={row.batch}
                    data-reveal="row"
                    className="grid items-baseline gap-2 border-t border-foreground/10 py-3.5 sm:grid-cols-[5rem_10rem_1fr_auto] sm:gap-4"
                  >
                    <span className="font-mono text-sm text-signal">Batch {row.batch}</span>
                    <span className="font-mono text-sm">
                      cost {row.icbsSum} <span className="text-neon-green">solved</span>
                    </span>
                    <span className="font-mono text-xs text-silver">
                      {row.prioritizedServed} of {row.batch} served
                    </span>
                    <span className="font-mono text-sm">
                      <span className="inline-flex items-center gap-3">
                        <span className="inline-block h-1.5 w-24 bg-foreground/10">
                          <span
                            className="block h-full bg-signal"
                            style={{ width: `${row.hitRate * 100}%` }}
                          />
                        </span>
                        {(Math.round(row.hitRate * 1000) / 10).toFixed(1)}%
                      </span>
                    </span>
                  </li>
                ))}
                <li className="border-t border-foreground/10" />
              </ul>
              <p className="mt-6 max-w-xl text-sm text-silver">
                At batch three, one-robot-at-a-time planning loses the robot due at tick 9: two of three tasks land
                and the third is refused. The joint plan keeps every batch solved, at costs 19, 38, 43, 52, 61, and
                69.
              </p>
            </div>
          </div>
        </section>

        {/* Replications */}
        <section id="replications" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-silver">Eight shuffles of the order</span>
          </p>
          <div data-reveal className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="display-section tracking-[-0.04em]">Congestion, measured in advance</h2>
            <p className="max-w-md text-silver">
              Shuffle the six-task order and plan again, eight times over: the busiest regions on the map are the same
              ones that get requests refused. That match scores {CORRELATION.toFixed(2)}: strong, though not perfect.
            </p>
          </div>
          <ul className="mt-10">
            {REPLICATION_REGIONS.map((row) => {
              const maxDensity = Math.max(...REPLICATION_REGIONS.map((other) => other.density))
              const maxRejections = Math.max(...REPLICATION_REGIONS.map((other) => other.meanRejections))
              return (
                <li
                  key={row.region}
                  data-reveal="row"
                  className="grid items-baseline gap-2 border-t border-foreground/10 py-4 sm:grid-cols-[10rem_1fr_1fr] sm:gap-6"
                >
                  <span className="font-mono text-sm">{row.region}</span>
                  <span className="flex items-center gap-3 font-mono text-xs text-silver">
                    splits {row.density}
                    <span className="inline-block h-1.5 max-w-40 flex-1 bg-foreground/10">
                      <span
                        className="block h-full bg-neon-violet"
                        style={{ width: `${(row.density / maxDensity) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="flex items-center gap-3 font-mono text-xs text-silver">
                    refused per run {row.meanRejections.toFixed(2)}
                    <span className="inline-block h-1.5 max-w-40 flex-1 bg-foreground/10">
                      <span
                        className="block h-full bg-foreground/60"
                        style={{ width: `${(row.meanRejections / maxRejections) * 100}%` }}
                      />
                    </span>
                  </span>
                </li>
              )
            })}
            <li className="border-t border-foreground/10" />
          </ul>
          <p className="mt-6 max-w-2xl text-sm text-silver">
            Read the map before the wave and you know where to slow the next release, before a single request gets
            refused.
          </p>
        </section>

        {/* Gate walkthrough */}
        <section id="gate" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_PRODUCT}>Product</span>
            <span className="text-silver">The release gate</span>
          </p>
          <div data-reveal className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="display-section tracking-[-0.04em]">Walking the gate</h2>
            <p className="max-w-md text-silver">
              Two asks come with the warehouse; the gate answers each from the plan. The panel below runs the same
              rule for any ask you send it.
            </p>
          </div>
          <div className="mt-10">
            <GatePanel />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {JOURNAL.map((row) => {
              const fired = row.decision === "fire"
              return (
                <article
                  key={row.id}
                  data-reveal="row"
                  className={`flex flex-col gap-6 border bg-card p-6 transition-all hover:-translate-y-1 hover:scale-[1.012] hover:shadow-[0_10px_22px_rgba(255,54,168,0.16)] sm:p-8 ${
                    fired ? "border-neon-pink" : "border-foreground/25 hover:border-signal"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-signal">{row.id}</span>
                    <span
                      className={`px-2.5 py-1 font-mono text-[11px] tracking-[0.14em] uppercase ${
                        fired ? "bg-neon-yellow text-foreground" : "border border-foreground/40 text-foreground"
                      }`}
                    >
                      {row.decision}
                    </span>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] tracking-[0.16em] text-silver uppercase">The ask</p>
                    <p className="mt-2 max-w-md text-lg leading-snug tracking-[-0.02em]">
                      {row.amr}, {row.klass === "express" ? "an express" : `a ${row.klass}`} run, asks to cross{" "}
                      {regionAt(row.origin) === regionAt(row.destination)
                        ? `the ${regionAt(row.origin)}`
                        : `from the ${regionAt(row.origin)} to the ${regionAt(row.destination)}`}
                      , departing between ticks {row.earliest} and {row.latest}.
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] tracking-[0.16em] text-silver uppercase">
                      The gate answers
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {row.reasons.map((reason) => (
                        <li key={reason} className={`text-sm ${fired ? "text-foreground" : "text-ember"}`}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {row.grant ? (
                    <div className="mt-auto border-t border-foreground/10 pt-4">
                      <p className="font-mono text-[10px] tracking-[0.16em] text-silver uppercase">
                        {fired ? "The granted route" : "The held route"}
                      </p>
                      <p className="mt-2 font-mono text-xs">
                        depart {row.grant.depart} · arrive {row.grant.arrive} · detour {row.grant.detour}
                      </p>
                      <RouteScrubber regions={row.grant.regions} depart={row.grant.depart} arrive={row.grant.arrive} />
                      {!fired ? (
                        <p className="mt-2 text-sm text-silver">
                          The route exists, but the Main Run is the busiest region at departure time, so the gate
                          holds this wave rather than gamble on it.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
          <p className="mt-8 max-w-2xl text-sm text-silver">
            AMR-7 leaves the Dispatch Apron at tick 0 into a clear corridor, so the gate fires it. AMR-8 wants the
            Main Run at tick 4, the busiest moment on the floor, so the gate holds it, and the 4-tick detour is the
            price of going around. One plan answers both.
          </p>
        </section>

        {/* Sources */}
        <section id="sources" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <h2 className="display-section tracking-[-0.04em]">Sources</h2>
          <ul data-reveal className="mt-10 max-w-3xl">
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">The method.</span> Sharon, G., Stern, R., Goldenberg, M., Felner, A.
              (2015). <em>Conflict-based search for optimal multi-agent pathfinding.</em> Artificial Intelligence
              219: 406-442. The deadline prune, the priority tie-break, and the cardinality test are extensions
              described relative to that paper.
            </li>
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">Industry analogs.</span> openTCS (Fraunhofer IML, MIT) separates
              transport tasks, vehicle state, and scheduling; the window request API mirrors that dispatch seam at a
              smaller scale. Open-RMF&apos;s rmf_traffic negotiates time-space schedules, and rmf_task carries task
              deadlines; the deadline curve here is that idea on a small floor.
            </li>
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">No mockups.</span> Every figure on this page is the planner&apos;s
              actual output for the published warehouse; the planner and its fixtures live in this repository.
            </li>
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">Back up.</span>{" "}
              <Link href="/" className="sweep hover:text-signal">
                The index page
              </Link>{" "}
              explains the method from the top.
            </li>
            <li className="border-t border-foreground/10" />
          </ul>
        </section>
        <Marquee />
      </main>
      <SiteFooter />
    </>
  )
}
