import type { Metadata } from "next"
import Link from "next/link"
import { Marquee, SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
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
import { CASTING_HALL } from "@/lib/fixture"

export const metadata: Metadata = {
  title: "Windows",
  description:
    "The congestion heatmap, the deadline-hit-rate curve, the degradation ladder, and a release-gate walkthrough — all locked to the engine's reading of the casting hall.",
}

const REGIONS = ["North Run", "Main Run", "South Run", "Dispatch Apron", "West Aisle", "Aisle Two"]

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
  return `color-mix(in srgb, #c2620e ${share}%, #f5f2ea)`
}

const KLASSED: Record<string, string> = {
  express: "Express",
  standard: "Standard",
  bulk: "Bulk",
}

export default function WindowsPage() {
  const regions = regionOrder(DENSITY)
  const maxSplits = Math.max(...DENSITY.map((row) => row.splits))

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
        <section className="px-5 pt-12 pb-14 sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">02 — Release windows</p>
          <h1 className="rise mt-6 max-w-[14ch] text-[clamp(3.6rem,10vw,8rem)] leading-[0.86] font-medium tracking-[-0.05em]">
            Hesitate, or fire.
          </h1>
          <div className="rise-late mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <p className="max-w-xl text-lg leading-snug text-silver sm:text-xl">
              Before the orchestrator releases a wave, it asks one question: is the floor free? Hearthlane answers from the joint plan the hall will actually run — the same plan that met every deadline — and journals the reason either way.
            </p>
            <p className="max-w-md text-silver">
              Everything below is one fixture run: six tasks, horizon 30, seed 2027. The figures are locked to the planner&apos;s own test suite; the site cannot drift from the engine.
            </p>
          </div>
        </section>

        {/* Ladder */}
        <section id="ladder" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] tracking-[-0.04em]">The degradation ladder</h2>
            <p className="max-w-md text-silver">
              Optimal first, improved second, greedy last — and the greedy rung is allowed to fail. An unsolved rung reports no sum and no gap.
            </p>
          </div>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-foreground/25 font-mono text-[11px] tracking-[0.14em] text-silver uppercase">
                  <th className="py-3 pr-4 font-medium">Rung</th>
                  <th className="py-3 pr-4 font-medium">Sum</th>
                  <th className="py-3 pr-4 font-medium">Gap</th>
                  <th className="py-3 pr-4 font-medium">Expanded</th>
                  <th className="py-3 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {LADDER.map((rung) => (
                  <tr key={rung.solver} className="border-b border-foreground/10 align-baseline">
                    <td className="py-4 pr-4 font-mono text-sm">{rung.solver}</td>
                    <td className="py-4 pr-4 font-mono text-sm">{rung.sum ?? "—"}</td>
                    <td className="py-4 pr-4 font-mono text-sm">{rung.gap ?? "—"}</td>
                    <td className="py-4 pr-4 font-mono text-sm">{rung.expanded}</td>
                    <td className="py-4 text-sm text-silver">
                      {rung.solved ? (
                        <span>
                          <span className="mr-2 text-signal">solved</span>
                          {rung.solver === "ICBS" ? "same optimum, fewer nodes" : "the optimum, honestly stated"}
                        </span>
                      ) : (
                        <span className="text-ember">unsolved: {rung.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-2xl text-sm text-silver">
            ICBS reads cardinality while it searches: at a split, it asks which side has no cheaper way out and commits. Same sum of costs (69) as plain CBS, 23 expansions instead of 34. The prioritized rung is the honest failure — booking Ember first pins Tinder, whose due is tick 9.
          </p>
        </section>

        {/* Arrivals */}
        <section id="arrivals" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] tracking-[-0.04em]">Every deadline met</h2>
            <p className="max-w-md text-silver">
              The ICBS plan&apos;s arrivals against their dues. Served sum {SERVED_SUM} · makespan {MAKESPAN}.
            </p>
          </div>
          <ul className="mt-10">
            {ARRIVALS.map((row) => {
              const slack = row.due - row.arrived
              return (
                <li
                  key={row.id}
                  className="grid items-baseline gap-2 border-t border-foreground/10 py-4 sm:grid-cols-[4rem_8rem_1fr_14rem] sm:gap-4"
                >
                  <span className="font-mono text-sm text-signal">{row.id}</span>
                  <span className="font-mono text-sm">
                    {row.amr} <span className="text-silver">{KLASSED[row.klass]}</span>
                  </span>
                  <span className="font-mono text-xs text-silver">
                    {row.start[0]},{row.start[1]} → {row.goal[0]},{row.goal[1]}
                  </span>
                  <span className="font-mono text-sm">
                    arrived {row.arrived} of due {row.due}
                    <span className="ml-2 text-silver">slack {slack}</span>
                  </span>
                </li>
              )
            })}
            <li className="border-t border-foreground/10" />
          </ul>
        </section>

        {/* Heatmap */}
        <section id="density" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] tracking-[-0.04em]">The congestion heatmap</h2>
            <p className="max-w-md text-silver">
              Cardinal-conflict density: where the tree split, bucket by bucket. A dot marks a side with no cheaper way out — the cardinal half of the split.
            </p>
          </div>
          <div className="mt-10 overflow-x-auto">
            <div className="min-w-[46rem]">
              <div
                className="grid gap-1 font-mono text-[10px] tracking-[0.1em] text-silver uppercase"
                style={{ gridTemplateColumns: `9rem repeat(${BUCKETS}, minmax(3rem, 1fr))` }}
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
                      if (!cell) {
                        return (
                          <span
                            key={`${region}-${bucket}`}
                            className="h-10 border border-foreground/10 bg-card"
                          />
                        )
                      }
                      const intensity = cell.splits / maxSplits
                      const ink = intensity > 0.55 ? "#f5f2ea" : "#22262c"
                      return (
                        <span
                          key={`${region}-${bucket}`}
                          className="relative flex h-10 items-center justify-center font-mono text-xs"
                          style={{ background: heat(cell.splits), color: ink }}
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
          </div>
          <p className="mt-6 max-w-2xl text-sm text-silver">
            The tree splits almost entirely in ticks 4–7 — the morning wave — and South Run carries the only cardinal sides (4 of its 8 splits had no cheaper way out). Dispatch Apron heats later, ticks 8–11, as the bulk runs return south. Aisle Three never splits: it is the pressure valve the reroute uses.
          </p>
        </section>

        {/* Deadline curve */}
        <section id="curve" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] tracking-[-0.04em]">The deadline-hit-rate curve</h2>
            <p className="max-w-md text-silver">
              Release batches of growing size and read who lands on time. The joint tree never drops; prioritized breaks at batch 3.
            </p>
          </div>
          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
            <figure>
              <svg
                viewBox={`0 0 ${curveWidth} ${curveHeight}`}
                className="w-full"
                role="img"
                aria-label="Deadline hit rate by batch size: 1.0, 1.0, 0.67, 0.5, 0.6, 0.5"
              >
                <line x1={pad} y1={curveHeight - pad} x2={curveWidth - pad} y2={curveHeight - pad} stroke="#22262c" strokeWidth="1" opacity="0.35" />
                <line x1={pad} y1={pad} x2={curveWidth - pad} y2={pad} stroke="#22262c" strokeWidth="1" strokeDasharray="4 3" opacity="0.3" />
                <polyline points={curveLine} fill="none" stroke="#c2620e" strokeWidth="2" />
                {CURVE.map((row, index) => {
                  const [x, y] = pointAt(index, row.hitRate)
                  return (
                    <g key={row.batch}>
                      <circle cx={x} cy={y} r="4" fill="#c2620e" />
                      <text
                        x={x}
                        y={curveHeight - 4}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#6b7076"
                        fontFamily="var(--font-mono-plex), monospace"
                      >
                        {row.batch}
                      </text>
                    </g>
                  )
                })}
                <text x={curveWidth - pad} y={pad - 6} textAnchor="end" fontSize="9" fill="#6b7076" fontFamily="var(--font-mono-plex), monospace">
                  1.0
                </text>
                <text x={curveWidth - pad} y={curveHeight - pad - 6} textAnchor="end" fontSize="9" fill="#6b7076" fontFamily="var(--font-mono-plex), monospace">
                  0.5
                </text>
              </svg>
              <figcaption className="mt-3 font-mono text-[10px] tracking-[0.14em] text-silver uppercase">
                Hit rate by batch · prioritized rung
              </figcaption>
            </figure>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-foreground/25 font-mono text-[11px] tracking-[0.14em] text-silver uppercase">
                    <th className="py-3 pr-4 font-medium">Batch</th>
                    <th className="py-3 pr-4 font-medium">ICBS</th>
                    <th className="py-3 pr-4 font-medium">Prioritized</th>
                    <th className="py-3 font-medium">Hit rate</th>
                  </tr>
                </thead>
                <tbody>
                  {CURVE.map((row) => (
                    <tr key={row.batch} className="border-b border-foreground/10">
                      <td className="py-3.5 pr-4 font-mono text-sm">{row.batch}</td>
                      <td className="py-3.5 pr-4 font-mono text-sm">
                        sum {row.icbsSum} <span className="text-signal">solved</span>
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-sm">
                        {row.prioritizedServed} of {row.batch} served
                      </td>
                      <td className="py-3.5 font-mono text-sm">
                        <span className="inline-flex items-center gap-3">
                          <span className="inline-block h-1.5 w-24 bg-foreground/10">
                            <span className="block h-full bg-signal" style={{ width: `${row.hitRate * 100}%` }} />
                          </span>
                          {(Math.round(row.hitRate * 1000) / 1000).toFixed(3)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-6 max-w-xl text-sm text-silver">
                Batch 3 is where Tinder (due 9) stops being servable by a greedy order: two of three tasks land, the third is refused. ICBS keeps the full batch solved the whole way up — sums 19, 38, 43, 52, 61, 69.
              </p>
            </div>
          </div>
        </section>

        {/* Replications */}
        <section id="replications" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] tracking-[-0.04em]">The map predicts the mess</h2>
            <p className="max-w-md text-silver">
              Eight seeded shuffles of the manifest order, seeds 2027–2034, prioritized rung. Per region: split density against mean reservation rejections.
            </p>
          </div>
          <p className="mt-10 font-mono text-sm">
            Pearson r = {CORRELATION.toFixed(2)}
            <span className="ml-3 text-silver">between density and rejections</span>
          </p>
          <ul className="mt-8">
            {REPLICATION_REGIONS.map((row) => {
              const maxDensity = Math.max(...REPLICATION_REGIONS.map((other) => other.density))
              const maxRejections = Math.max(...REPLICATION_REGIONS.map((other) => other.meanRejections))
              return (
                <li
                  key={row.region}
                  className="grid items-baseline gap-2 border-t border-foreground/10 py-4 sm:grid-cols-[10rem_1fr_1fr] sm:gap-6"
                >
                  <span className="font-mono text-sm">{row.region}</span>
                  <span className="flex items-center gap-3 font-mono text-xs text-silver">
                    density {row.density}
                    <span className="inline-block h-1.5 flex-1 max-w-40 bg-foreground/10">
                      <span className="block h-full bg-signal" style={{ width: `${(row.density / maxDensity) * 100}%` }} />
                    </span>
                  </span>
                  <span className="flex items-center gap-3 font-mono text-xs text-silver">
                    mean rejections {row.meanRejections.toFixed(2)}
                    <span className="inline-block h-1.5 flex-1 max-w-40 bg-foreground/10">
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
            A region that splits the tree often also refuses reservations often, whichever order the manifest is shuffled into. That is the gate&apos;s license: read the map, rate-limit the next wave before the rejections happen.
          </p>
        </section>

        {/* Gate walkthrough */}
        <section id="gate" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] tracking-[-0.04em]">Walking the gate</h2>
            <p className="max-w-md text-silver">
              Two asks ride in the fixture itself. The WES asks; hearthline answers from the served plan; the AMR is fired or held with the reason journaled.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {JOURNAL.map((row) => {
              const fired = row.decision === "fire"
              return (
                <article
                  key={row.id}
                  className={`flex flex-col gap-6 border p-6 sm:p-8 ${fired ? "border-signal" : "border-foreground/25"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-signal">{row.id}</span>
                    <span
                      className={`px-2.5 py-1 font-mono text-[11px] tracking-[0.14em] uppercase ${
                        fired ? "bg-signal text-background" : "border border-foreground/40 text-foreground"
                      }`}
                    >
                      {row.decision}
                    </span>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] tracking-[0.16em] text-silver uppercase">The WES asks</p>
                    <p className="mt-2 text-lg tracking-[-0.02em]">
                      {row.amr} <span className="text-silver">{KLASSED[row.klass]}</span> · {row.origin[0]},
                      {row.origin[1]} → {row.destination[0]},{row.destination[1]}
                    </p>
                    <p className="mt-1 font-mono text-xs text-silver">
                      window {row.earliest}..{row.latest} · from {CASTING_HALL.floor.name}
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] tracking-[0.16em] text-silver uppercase">Hearthline answers</p>
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
                        {fired ? "The grant" : "The held route"}
                      </p>
                      <p className="mt-2 font-mono text-xs">
                        depart {row.grant.depart} · arrive {row.grant.arrive} · detour {row.grant.detour}
                      </p>
                      <p className="mt-1 font-mono text-xs text-silver">
                        crosses {row.grant.regions.join(" · ")}
                      </p>
                      {!fired ? (
                        <p className="mt-2 text-sm text-silver">
                          The route exists; the gate holds it all the same. The Main Run carries conflict density in the departure bucket — the wave waits.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
          <p className="mt-8 max-w-2xl text-sm text-silver">
            Kiln&apos;s express run leaves the Dispatch Apron at tick 0 into a clear corridor — fire. Ash asks to enter the Main Run at tick 4, the exact bucket where the tree split three times — hesitate. The same plan that served six deadlines answers both.
          </p>
        </section>

        {/* Sources */}
        <section id="sources" className="border-t border-foreground/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] tracking-[-0.04em]">Sources &amp; honesty</h2>
          <ul className="mt-10 max-w-3xl">
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">The method.</span> Sharon, G., Stern, R., Goldenberg, M., Felner, A.
              (2015). <em>Conflict-based search for optimal multi-agent pathfinding.</em> Artificial Intelligence
              219: 406–442. The deadline prune, the priority tie-break, and the cardinality test are extensions
              described relative to that paper.
            </li>
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">Industry analogs.</span> openTCS (Fraunhofer IML, MIT) splits
              transport tasks, vehicle state, and scheduling the way the window API mirrors its dispatch seam —
              lighter and mathier. Open-RMF&apos;s rmf_traffic negotiates time-space schedules and rmf_task carries
              task deadlines; the deadline curve here is the same argument made small.
            </li>
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">The fiction.</span> Ferro &amp; Lume is not a foundry. Ember, Brann,
              Tinder, Soot, Cinder, Slag, Kiln, and Ash are not a fleet. Every figure on this page is a worked
              example invented for the planner — locked by its tests, rendered here without invention.
            </li>
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">The engine.</span> The figures come from{" "}
              <span className="font-mono">hearthline-plan</span>, the sibling repository whose behavior test asserts
              each one. Its CLI prints the same reading this page renders.
            </li>
            <li className="border-t border-foreground/10 py-5 text-sm text-silver">
              <span className="text-foreground">Back up.</span>{" "}
              <Link href="/" className="underline hover:text-signal">
                The index page
              </Link>{" "}
              explains the method from the top.
            </li>
          </ul>
        </section>
        <Marquee />
      </main>
      <SiteFooter />
    </>
  )
}
