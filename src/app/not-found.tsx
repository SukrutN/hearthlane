import Link from "next/link"
import { Marquee, SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="content">
        <section className="bg-deep px-5 py-20 text-paper sm:px-8 lg:px-12 lg:py-28">
          <p className="font-mono text-[11px] tracking-[0.18em] text-neon-violet uppercase">404</p>
          <h1 className="display-section mt-4 max-w-4xl leading-[0.86] tracking-[-0.04em]">
            This page does not exist
          </h1>
          <p className="mt-6 max-w-md text-lg text-paper/70">
            The address has no page. The index explains the method; the windows page walks the release gate.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/"
              className="btn-pop bg-neon-pink px-6 py-3 font-mono text-[12px] tracking-[0.14em] text-foreground uppercase transition-colors hover:bg-neon-yellow"
            >
              The index
            </Link>
            <Link
              href="/windows"
              className="font-mono text-[11px] tracking-[0.16em] text-paper/80 uppercase transition-colors hover:text-neon-pink"
            >
              The windows
            </Link>
          </div>
        </section>
        <Marquee />
      </main>
      <SiteFooter />
    </>
  )
}
