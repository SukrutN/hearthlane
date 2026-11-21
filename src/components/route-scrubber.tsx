"use client"

import { useState } from "react"

/**
 * Walks one gate answer's route, tick by tick, over the regions the grant
 * crossed. Every value comes from the locked journal: the regions, the
 * departure, and the arrival. The settled state is the arrival, so the
 * static bytes ship the completed route and the reader scrubs back to the
 * departure.
 */
export function RouteScrubber({
  regions,
  depart,
  arrive,
}: {
  regions: string[]
  depart: number
  arrive: number
}) {
  const span = arrive - depart
  const [tick, setTick] = useState(span)
  const reached = Math.min(regions.length, Math.max(1, Math.round(((tick + 1) / (span + 1)) * regions.length)))
  const current = regions[reached - 1]

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-[0.16em] text-silver uppercase">
        <span>Walk the route</span>
        <span className="text-foreground">
          tick {depart + tick} · {current}
        </span>
      </div>
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${regions.length}, minmax(0, 1fr))` }}>
        {regions.map((region, index) => (
          <span
            key={region}
            className={`flex h-9 items-center justify-center border px-1 text-center font-mono text-[10px] tracking-[0.04em] uppercase transition-colors ${
              index < reached ? "border-signal bg-signal/15 text-foreground" : "border-foreground/15 text-silver"
            }`}
          >
            {region}
          </span>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={span}
        step={1}
        value={tick}
        onChange={(event) => setTick(Number(event.target.value))}
        className="mt-3 w-full accent-[#ff36a8]"
        aria-label={`Walk the route from tick ${depart} to tick ${arrive}`}
      />
    </div>
  )
}
