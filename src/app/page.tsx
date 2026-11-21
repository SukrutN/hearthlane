import Link from "next/link"
import { HallMap } from "@/components/hall-map"
import { Marquee, SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ARRIVALS, CORRELATION, MAKESPAN, SCALE, SERVED_SUM } from "@/lib/figures"
import { CASTING_HALL } from "@/lib/fixture"

const KLASS_TONE: Record<string, string> = {
  express: "bg-neon-yellow text-foreground",
  standard: "bg-neon-sky text-foreground",
  bulk: "bg-neon-violet text-foreground",
}

const PRINCIPLES = [
  {
    n: "01",
    code: "001",
    tone: "bg-neon-yellow text-foreground",
    wash: "hover:bg-[#fff1c8]",
    title: "Deadlines prune",
    body: "Give every task a deadline and Hearthlane holds it to one. While it searches, it throws away any future where a robot would arrive too late, so the plan you get never breaks a promise it could not keep.",
  },
  {
    n: "02",
    code: "002",
    tone: "bg-neon-sky text-foreground",
    wash: "hover:bg-[#e3ecff]",
    title: "Priority breaks ties",
    body: "When two robots want the same cell at the same moment, class decides: express beats standard, and standard beats bulk. The lower-class robot waits a moment or takes the long way around, so your urgent work always moves first.",
  },
  {
    n: "03",
    code: "003",
    tone: "bg-neon-cyan text-foreground",
    wash: "hover:bg-[#e8f6fd]",
    title: "Density is measured",
    body: "As Hearthlane plans, it keeps score of where it had to work hardest: every conflict it had to try both ways, region by region, four ticks at a time. You see the busy spots before the wave goes out, not after.",
  },
  {
    n: "04",
    code: "004",
    tone: "bg-neon-green text-paper",
    wash: "hover:bg-[#e6f2e4]",
    title: "Grant or hold",
    body: "When work asks for a departure window, the answer comes from the plan itself. The gate grants it when the origin is clear and holds it, with the reason attached, when the corridor is busy. You always know why.",
  },
]

const NOTES = [
  {
    n: "01",
    title: "Six robots, thirty ticks",
    meta: "The manifest",
    body: "Two express runs, two standard, two bulk. The deadlines are tight on purpose: the tightest robot still has to be home by tick 9.",
  },
  {
    n: "02",
    title: "One at a time fails",
    meta: "The ladder's third rung",
    body: "Plan the robots one at a time and it falls apart. Booking AMR-1 first puts AMR-2 on a collision course at tick 3, and the robot due at tick 9 never gets through.",
  },
  {
    n: "03",
    title: "Together, everything fits",
    meta: "Cost 69, gap 0",
    body: "Plan them jointly and every deadline lands. The solver tries both sides of each conflict and keeps the cheaper one, and the six routes together take 69 ticks of travel: the least any planner could manage on this floor.",
  },
  {
    n: "04",
    title: "The map predicts the cost",
    meta: "r = 0.69",
    body: "Shuffle the six-task order and plan again, eight times over: the regions that made the planner work hardest are the same regions where requests got turned away. Read the map beforehand and you know where to slow the next wave.",
  },
]

const CHIP_DEMO = "bg-neon-yellow px-1.5 py-0.5 font-mono text-[10px] tracking-[0.14em] text-foreground uppercase"
const CHIP_PRODUCT = "border border-neon-violet px-1.5 py-0.5 font-mono text-[10px] tracking-[0.14em] text-neon-violet uppercase"

export default function HomePage() {
  const landed = ARRIVALS.filter((row) => row.arrived <= row.due).length

  return (
    <>
      <SiteHeader />
      <main id="content">
        <section className="flex min-h-[calc(100svh-4.25rem)] flex-col justify-between bg-deep px-5 pt-12 pb-14 text-paper sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-neon-violet uppercase">01. Release windows</p>
          <h1
            data-reveal
            className="display-hero max-w-[10ch] leading-[0.86] font-medium tracking-[-0.045em]"
          >
            Read the
            <br />
            <span className="text-neon-pink">traffic</span> first
          </h1>
          <div data-reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-lg leading-snug text-paper/80 sm:text-xl">
              Hearthlane is a traffic planner for robot fleets. Send it your floor and your tasks, and it gives you
              one joint plan that meets every deadline, with the congestion map and the release gate built in. See it
              in action below, on one fictional warehouse: six robots, thirty ticks, one shared floor.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link
                href="/windows"
                className="btn-pop bg-neon-pink px-6 py-3 font-mono text-[12px] tracking-[0.14em] text-foreground uppercase transition-colors hover:bg-neon-yellow"
              >
                Walk the gate
              </Link>
              <a
                href="#method"
                className="sweep font-mono text-[11px] tracking-[0.16em] text-paper/80 uppercase transition-colors hover:text-neon-pink"
              >
                Read the method
              </a>
            </div>
          </div>
        </section>

        {/* The four figures that carry the whole demo run, each glossed in plain words. */}
        <section className="border-t border-paper/10 bg-deep px-5 py-14 text-paper sm:px-8 lg:px-12 lg:py-20">
          <p className="mb-8 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-paper/70">One run of the demo warehouse</span>
          </p>
          <dl className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">Deadlines met</dt>
              <dd className="mt-3 display-figure leading-[0.9] tracking-[-0.045em] text-neon-yellow">
                {landed} / {ARRIVALS.length}
              </dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                Every robot lands inside its deadline, and the tightest one still finishes with four ticks to spare.
              </p>
            </div>
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">Total cost</dt>
              <dd className="mt-3 display-figure leading-[0.9] tracking-[-0.045em] text-neon-pink">
                {SERVED_SUM}
              </dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                The six routes together take {SERVED_SUM} ticks of travel. No planner could do better on this floor.
              </p>
            </div>
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">Last arrival</dt>
              <dd className="mt-3 display-figure leading-[0.9] tracking-[-0.045em] text-neon-cyan">
                {MAKESPAN}
              </dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                The last robot parks by tick {MAKESPAN}, well inside the thirty-tick clock.
              </p>
            </div>
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">Density link</dt>
              <dd className="mt-3 display-figure leading-[0.9] tracking-[-0.045em] text-neon-green">
                {CORRELATION.toFixed(2)}
              </dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                The busiest regions in the map are the same ones that get requests refused. Measured across eight
                runs, that match scores {CORRELATION.toFixed(2)}: strong, though not perfect.
              </p>
            </div>
          </dl>
        </section>

        {/* The planner at fleet scale: the warehouse above is the walkthrough,
            the engine is built for the whole fleet. The figures come from the
            engine's own scale test, locked in figures.ts like every number
            on the site. */}
        <section className="border-t border-paper/10 bg-deep px-5 py-14 text-paper sm:px-8 lg:px-12 lg:py-20">
          <p className="mb-8 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_PRODUCT}>Product</span>
            <span className="text-paper/70">Hearthlane at fleet scale</span>
          </p>
          <p data-reveal className="max-w-3xl text-[clamp(1.5rem,2.6vw,2.2rem)] leading-[1.2] tracking-[-0.03em]">
            The warehouse above is the walkthrough; Hearthlane is built for your whole fleet. On a floor of 64 by 64
            cells, the largest it accepts, it can plan a hundred robots at once in about {SCALE.milliseconds}{" "}
            milliseconds with every deadline met. Run it again and you get exactly the same routes.
          </p>
          <dl className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">Robots on one floor</dt>
              <dd className="display-figure mt-3 leading-[0.9] tracking-[-0.045em] text-neon-pink">{SCALE.robots}</dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                A hundred routes, planned together, never one robot at a time.
              </p>
            </div>
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">Floor capacity</dt>
              <dd className="display-figure mt-3 leading-[0.9] tracking-[-0.045em] text-neon-cyan">64 × 64</dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                The largest floor Hearthlane accepts, with room for the whole fleet.
              </p>
            </div>
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">The solve</dt>
              <dd className="display-figure mt-3 leading-[0.9] tracking-[-0.045em] text-neon-yellow">
                {SCALE.milliseconds} ms
              </dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                The whole joint plan, worked out in about {SCALE.milliseconds} milliseconds.
              </p>
            </div>
            <div data-reveal="row">
              <dt className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">The second run</dt>
              <dd className="display-figure mt-3 leading-[0.9] tracking-[-0.045em] text-neon-green">identical</dd>
              <p className="mt-3 max-w-[18rem] text-sm text-paper/70">
                Plan the same floor twice and you get the exact same routes, every time.
              </p>
            </div>
          </dl>
          <p className="mt-8 max-w-2xl text-sm text-paper/60">
            Want it on your own floor? Hearthlane gives you an HTTP API, a command line, and a web workbench: send any
            floor document and you get this same reading, live, with no site in between.
          </p>
        </section>

        {/* The manifest itself: six robots in bordered cells, each cell
            taking its turn under the spotlight. */}
        <section className="border-t border-foreground/10 px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <p className="mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-silver">The six robots and their deadlines</span>
          </p>
          <ol className="grid gap-1 border-4 border-foreground bg-foreground sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {CASTING_HALL.tasks.map((task, index) => (
              <li
                key={task.id}
                data-reveal="row"
                className="spot-cell flex min-h-40 flex-col justify-between border border-foreground/15 bg-card p-5"
                style={{ animationDelay: `${index * 1.4}s` }}
              >
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.14em] uppercase">
                  <span className="text-signal">{task.id}</span>
                  <span className={`px-1.5 py-0.5 ${KLASS_TONE[task.klass]}`}>{task.klass}</span>
                </div>
                <div>
                  <p className="text-3xl tracking-[-0.04em]">{task.amr}</p>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-silver uppercase">
                    due tick {task.due}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-foreground/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_PRODUCT}>Product</span>
            <span className="text-silver">What Hearthlane does with any floor you send it</span>
          </p>
          <div className="grid gap-14 lg:grid-cols-[1.3fr_0.7fr] lg:gap-20">
            <div data-reveal>
              <p className="max-w-3xl text-[clamp(1.7rem,3.4vw,2.8rem)] leading-[1.15] tracking-[-0.04em]">
                Release work into a floor you have already read. Hearthlane plans your whole batch jointly, then
                answers every window ask from the plan your robots will actually run.
              </p>
              <p className="mt-8 max-w-xl text-silver">
                Hearthlane gives you one joint plan, tells you how close it sits to the best cost possible, and shows
                you where congestion will build before the wave goes out. It stays out of your operations: no vehicle
                feed to integrate, no order stream to keep in sync.
              </p>
            </div>
            <div>
              <p className="mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
                <span className={CHIP_DEMO}>Demo</span>
                <span className="text-silver">The demo warehouse</span>
              </p>
              <HallMap />
              <p className="mt-6 max-w-sm text-sm leading-6 text-silver">
                Twelve by nine cells, sixty-eight of them walkable. Three corridors run east to west (North, Main, and
                South), a dispatch apron sits on the south wall, and four aisles (West, Two, Three, and Four) cut
                through the racks between them. Six robots each carry a priority class and a deadline, and the clock
                runs thirty ticks, one cell per tick.
              </p>
            </div>
          </div>
        </section>

        <section id="method" className="border-t border-foreground/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_PRODUCT}>Product</span>
            <span className="text-silver">The method</span>
          </p>
          <div data-reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl display-section leading-[0.9] tracking-[-0.04em]">
              How the
              <br />
              planner works
            </h2>
            <p className="max-w-sm text-silver">
              Conflict-based search (CBS) with deadlines and priority classes. The numbers below are not a mockup:
              they are what the planner actually returns when it runs this warehouse.
            </p>
          </div>
          <ol className="mt-14 grid gap-1 border-4 border-foreground bg-foreground sm:grid-cols-2">
            {PRINCIPLES.map((item) => (
              <li
                key={item.code}
                data-reveal="row"
                className={`flex min-h-64 flex-col justify-between bg-card p-6 transition-all hover:-translate-y-1 hover:scale-[1.012] hover:shadow-[0_10px_22px_rgba(255,54,168,0.16)] sm:p-8 ${item.wash}`}
              >
                <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.16em] text-signal">
                  <span>{item.n}</span>
                  <span className={`px-2 py-0.5 ${item.tone}`}>{item.code}</span>
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
          <p className="mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_DEMO}>Demo</span>
            <span className="text-silver">Notes on the demo run</span>
          </p>
          <h2
            data-reveal
            className="mt-4 max-w-4xl display-section leading-[0.9] tracking-[-0.04em]"
          >
            What you&apos;re
            <br />
            looking at
          </h2>
          <ul className="mt-12">
            {NOTES.map((note) => (
              <li
                key={note.n}
                data-reveal="row"
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

        <section className="bg-deep px-5 py-20 text-paper sm:px-8 lg:px-12 lg:py-28">
          <p className="mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span className={CHIP_PRODUCT}>Product</span>
            <span className="text-paper/70">The release gate</span>
          </p>
          <p className="font-mono text-[11px] tracking-[0.18em] text-neon-violet uppercase">The manifest is booked</p>
          <h2
            data-reveal
            className="display-figure mt-4 max-w-4xl leading-[0.86] tracking-[-0.04em]"
          >
            Walk the
            <br />
            gate
          </h2>
          <p className="mt-6 max-w-lg text-lg text-paper/70">
            One ask fires, one holds. Either way you get the reason: which corridor, which window, which ticks. The
            ladder, the curve, and the congestion map are all on the same page.
          </p>
          <Link
            href="/windows"
            className="btn-pop mt-8 inline-block bg-neon-pink px-6 py-3 font-mono text-[12px] tracking-[0.14em] text-foreground uppercase transition-colors hover:bg-neon-yellow"
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
