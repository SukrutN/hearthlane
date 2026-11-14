import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-foreground/10 px-5 py-10 sm:px-8 lg:px-12">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-3xl tracking-[-0.04em]">Hearthlane</p>
          <p className="mt-3 max-w-sm text-silver">
            A traffic-window notebook for one fictional casting hall. The floor, the fleet, and every figure are invented — the method they demonstrate is not, and its sources are cited.
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">Hall</p>
          <p className="mt-3 text-foreground">Ferro &amp; Lume</p>
          <p className="text-silver">Casting hall · 12 by 9</p>
          <p className="text-silver">Three runs · four aisles · one apron</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">Index</p>
          <Link href="/" className="w-fit hover:text-signal">
            01 Index
          </Link>
          <Link href="/windows" className="w-fit hover:text-signal">
            02 Windows
          </Link>
          <Link href="/#method" className="w-fit hover:text-signal">
            03 The method
          </Link>
        </nav>
      </div>
      <p className="mt-10 max-w-2xl font-mono text-[11px] leading-5 tracking-[0.08em] text-silver">
        Method: Sharon, Stern, Goldenberg, Felner (2015), Conflict-based search for optimal multi-agent
        pathfinding. Industry analogs: openTCS (Fraunhofer IML) and Open-RMF&apos;s rmf_traffic / rmf_task.
        This site is fiction, built to show the math.
      </p>
    </footer>
  )
}

export function Marquee() {
  const phrase = "Fire the wave when the corridor is clear"
  return (
    <div className="overflow-hidden border-y border-foreground/10 py-5">
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <p
            key={copy}
            className="flex shrink-0 items-center gap-8 pr-8 text-[clamp(1.6rem,3vw,2.6rem)] tracking-[-0.04em]"
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} className="flex items-center gap-8">
                {phrase}
                <span className="text-signal">·</span>
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  )
}
