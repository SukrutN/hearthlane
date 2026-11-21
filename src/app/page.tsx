import Link from "next/link"
import { HallMap } from "@/components/hall-map"
import { Marquee, SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

const PRINCIPLES = [
  {
    n: "01",
    code: "001",
    title: "Deadlines prune",
    body: "Every task carries a due tick. A state that cannot land in time is discarded before the search tree splits on it, so the search only spends its budget on plans that can still be kept.",
  },
  {
    n: "02",
    code: "002",
    title: "Priority breaks ties",
    body: "When two routes disagree, the higher class wins the first claim. Express outranks standard, standard outranks bulk, and the lower class waits or routes around.",
  },
  {
    n: "03",
    code: "003",
    title: "Density is measured",
    body: "Where the conflict tree had to split, and how many sides had no cheaper alternative, becomes a map organized by region and four-tick bucket. A gate can read it before releasing the next wave.",
  },
  {
    n: "04",
    code: "004",
    title: "Grant or hold",
    body: "A window request is answered by the plan itself: the departure is granted if the origin region is clear, or held with the reason recorded if the corridor carries conflict.",
  },
]

const NOTES = [
  {
    n: "01",
    title: "Six AMRs, thirty ticks",
    meta: "The manifest",
    body: "Two express runs, two standard runs, two bulk runs operate in the casting hall. The deadlines are deliberately tight. Tinder must land by tick 9.",
  },
  {
    n: "02",
    title: "The greedy order fails",
    meta: "The ladder's third rung",
    body: "Prioritized planning books Ember first; its tie-break claims (3,0) at tick 5. Brann sweeps the Main Run and claims the same cell at tick 3. Tinder, due at 9, is blocked.",
  },
  {
    n: "03",
    title: "The joint tree wins",
    meta: "Sum 69, gap 0",
    body: "CBS solves it in 34 expansions; ICBS, reading cardinality, reaches the same optimum in 23. The reroute sends Brann through Aisle Two instead, and every deadline is met.",
  },
  {
    n: "04",
    title: "Congestion, measured in advance",
    meta: "r = 0.69",
    body: "Eight seeded shuffles of the manifest order: a region's split density tracks its mean reservation rejections at r = 0.69. You can read the congestion before the wave goes out.",
  },
]

const SPECS: [string, string][] = [
  ["Floor", "12 by 9 cells, 68 open."],
  ["Corridors", "North, Main, South runs; a dispatch apron on the south wall."],
  ["Aisles", "West, Two, Three, Four, cut through the racks."],
  ["Tasks", "Six invented AMRs with priority classes and due ticks."],
  ["Horizon", "Thirty ticks of one cell per tick."],
  ["Seed", "2027, the replication study runs 2027 through 2034."],
]

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="content">
        <section className="flex min-h-[calc(100svh-4.25rem)] flex-col justify-between px-5 pt-12 pb-8 sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">01. AMR release windows</p>
          <h1 className="rise max-w-[12ch] text-[clamp(4.4rem,12vw,9.2rem)] leading-[0.84] font-medium tracking-[-0.05em]">
            Read the
            <br />
            traffic first.
          </h1>
          <div className="rise-late flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-lg leading-snug text-silver sm:text-xl">
              Hearthlane is a demo of AMR traffic planning for a fictional foundry: six robots, one joint plan, every
              deadline met, and a release gate that grants or holds each ask with the reason attached. Ferro &amp; Lume
              is invented. The planner is real code.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link
                href="/windows"
                className="bg-signal px-6 py-3 font-mono text-[12px] tracking-[0.14em] text-background uppercase transition-colors hover:bg-ember"
              >
                Walk the gate
              </Link>
              <a href="#method" className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase hover:text-foreground">
                Read the method
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-foreground/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.3fr_0.7fr] lg:gap-20">
            <div>
              <p className="max-w-3xl text-[clamp(1.7rem,3.4vw,2.8rem)] leading-[1.15] tracking-[-0.04em]">
                A WES should release robot work into a floor it has already read. Hearthlane plans the whole batch jointly, then answers window asks from the plan the floor will actually run.
              </p>
              <p className="mt-8 max-w-xl text-silver">
                This is a planner rather than a fleet system. It keeps a joint plan, reports the optimality gap, and measures
                congestion where the conflict tree had to split.
              </p>
            </div>
            <div>
              <HallMap />
              <dl className="mt-8">
                {SPECS.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-foreground/10 py-3">
                    <dt className="font-mono text-[11px] tracking-[0.14em] text-signal uppercase">{label}</dt>
                    <dd className="text-sm text-silver">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="method" className="border-t border-foreground/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.9] tracking-[-0.045em]">
              How the
              <br />
              planner works.
            </h2>
            <p className="max-w-sm text-silver">
              The method is conflict-based search, extended with deadlines and priority classes. The figures on this site are locked to the engine&apos;s own reading of the casting hall.
            </p>
          </div>
          <ol className="mt-14 grid gap-px bg-foreground/10 sm:grid-cols-2">
            {PRINCIPLES.map((item) => (
              <li
                key={item.code}
                className="flex min-h-64 flex-col justify-between bg-card p-6 transition-colors hover:bg-[#efeadd] sm:p-8"
              >
                <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.16em] text-signal">
                  <span>{item.n}</span>
                  <span>[ {item.code} ]</span>
                </div>
                <div className="mt-10">
                  <h3 className="text-4xl tracking-[-0.04em]">{item.title}</h3>
                  <p className="mt-3 max-w-md text-silver">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-foreground/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">Floor notes</p>
          <h2 className="mt-4 max-w-4xl text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.9] tracking-[-0.045em]">
            What you&apos;re
            <br />
            looking at.
          </h2>
          <ul className="mt-12">
            {NOTES.map((note) => (
              <li
                key={note.n}
                className="grid gap-3 border-t border-foreground/10 py-7 sm:grid-cols-[4rem_1fr_8rem] sm:items-baseline sm:gap-8"
              >
                <span className="font-mono text-sm text-signal">{note.n}</span>
                <div>
                  <h3 className="text-3xl tracking-[-0.04em] sm:text-4xl">{note.title}</h3>
                  <p className="mt-2 max-w-xl text-silver">{note.body}</p>
                </div>
                <span className="font-mono text-[11px] tracking-[0.14em] text-silver uppercase">{note.meta}</span>
              </li>
            ))}
            <li className="border-t border-foreground/10" />
          </ul>
        </section>

        <section className="border-t border-foreground/10 px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">The manifest is booked</p>
          <h2 className="mt-4 max-w-4xl text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
            Walk the
            <br />
            gate.
          </h2>
          <p className="mt-6 max-w-lg text-lg text-silver">
            One ask is granted, one is held, each with the corridor, the bucket, and the tick range recorded as the
            reason. The ladder, the curve, and the congestion map are all on the same page.
          </p>
          <Link
            href="/windows"
            className="mt-8 inline-block bg-signal px-6 py-3 font-mono text-[12px] tracking-[0.14em] text-background uppercase transition-colors hover:bg-ember"
          >
            Open the windows
          </Link>
        </section>
        <Marquee />
      </main>
      <SiteFooter />
    </>
  )
}
