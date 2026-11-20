import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="relative z-10 -mt-5 rounded-t-[2rem] bg-deep px-5 pt-10 pb-10 text-paper sm:px-8 lg:px-12">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-3xl tracking-[-0.04em]">Hearthlane</p>
          <p className="mt-3 max-w-sm text-paper/70">
            Hearthlane gives you one joint plan for the whole batch, answers every window ask from it, and states the
            reason for every grant and hold.
          </p>
          <p className="mt-3 text-sm text-paper/70">Built by Sukrut Nadigotti</p>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">The demo floor</p>
          <p className="mt-3 text-paper">Ferro &amp; Lume</p>
          <p className="mt-2 max-w-[16rem] text-sm leading-6 text-paper/70">
            One 12-by-9 warehouse: small enough that every figure can be checked by hand, tight enough that
            one-robot-at-a-time planning fails on it.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-neon-violet uppercase">Index</p>
          <Link href="/" className="w-fit hover:text-neon-pink">
            <span className="sweep">01 Index</span>
          </Link>
          <Link href="/windows" className="w-fit hover:text-neon-pink">
            <span className="sweep">02 Windows</span>
          </Link>
          <Link href="/#method" className="w-fit hover:text-neon-pink">
            <span className="sweep">03 The method</span>
          </Link>
        </nav>
      </div>
      <div className="mt-10 grid max-w-3xl gap-6 border-t border-paper/10 pt-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-neon-violet uppercase">The method</p>
          <p className="mt-2 text-sm leading-6 text-paper/80">
            Conflict-based search, from Sharon, Stern, Goldenberg, and Felner (2015), extended with deadlines and
            priority classes.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-neon-violet uppercase">Industry analogs</p>
          <p className="mt-2 text-sm leading-6 text-paper/80">
            openTCS splits dispatch along the same seam this planner&apos;s window API mirrors; Open-RMF negotiates
            time-space schedules and carries task deadlines the way this one does.
          </p>
        </div>
      </div>
    </footer>
  )
}

export function Marquee() {
  const phrases = [
    "Fire the wave when the corridor is clear",
    "One joint plan meets every deadline",
    "Read the congestion before the wave goes out",
    "Grant or hold, the reason is recorded",
  ]
  const run = [...phrases, ...phrases]
  return (
    <div className="overflow-hidden border-y-[3px] border-foreground bg-neon-yellow py-5">
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <p
            key={copy}
            className="flex shrink-0 items-center gap-8 pr-8 text-[clamp(1.6rem,3vw,2.6rem)] tracking-[-0.04em] text-foreground"
          >
            {run.map((phrase, index) => (
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
