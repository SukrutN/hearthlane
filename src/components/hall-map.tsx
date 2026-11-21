"use client"

import { useEffect, useState } from "react"
import { JOURNAL } from "@/lib/figures"
import { CASTING_HALL, paintFloor, type FloorDocument, type FloorTask } from "@/lib/fixture"

const UNIT = 40

/** The two gate answers' routes, exactly as the journal records them. */
const FIRE = JOURNAL.find((row) => row.decision === "fire")?.grant
const HOLD = JOURNAL.find((row) => row.decision === "hesitate")?.grant

const STEPS: { region: string; tone: "fire" | "hold" }[] = [
  ...(FIRE?.regions.map((region) => ({ region, tone: "fire" as const })) ?? []),
  ...(HOLD ? [{ region: HOLD.regions[0], tone: "hold" as const }] : []),
]

const FIRE_SET = new Set(FIRE?.regions ?? [])
const HOLD_SET = new Set(HOLD?.regions ?? [])

/**
 * The painted hall with the two gate routes playing across it, region by
 * region, straight from the locked journal: AMR-7's granted crossing lights in
 * sequence, then AMR-8's held region flashes. The settled state ships the full
 * routes with their caption, so the static export and reduced motion show
 * the same truth the cycle plays.
 */
export function HallMap({
  document = CASTING_HALL,
  tasks = CASTING_HALL.tasks,
}: {
  document?: FloorDocument
  tasks?: FloorTask[]
}) {
  const grid = paintFloor(document)
  const width = document.floor.width * UNIT
  const height = document.floor.height * UNIT
  const [step, setStep] = useState(-1)

  useEffect(() => {
    if (STEPS.length === 0) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(() => {
      setStep((value) => (value + 1) % STEPS.length)
    }, 1300)
    return () => window.clearInterval(timer)
  }, [])

  const active = step >= 0 ? STEPS[step] : null

  const cells: React.ReactNode[] = []
  for (let row = 0; row < document.floor.height; row++) {
    for (let col = 0; col < document.floor.width; col++) {
      const region = grid[row][col]
      const x = col * UNIT
      const y = row * UNIT
      if (region === null) {
        cells.push(
          <rect
            key={`rack-${row}-${col}`}
            x={x + 3}
            y={y + 3}
            width={UNIT - 6}
            height={UNIT - 6}
            fill="none"
            stroke="#c9b4dd"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />,
        )
      } else {
        const isCorridor = region.includes("Run") || region === "Dispatch Apron"
        const onFireRoute = FIRE_SET.has(region)
        const onHoldRoute = HOLD_SET.has(region)
        const lit =
          active !== null && active.region === region
            ? active.tone === "fire"
              ? "#ff36a8"
              : "#ff6200"
            : onFireRoute
              ? "rgba(255, 54, 168, 0.28)"
              : onHoldRoute
                ? "rgba(255, 98, 0, 0.28)"
                : isCorridor
                  ? "#ead9f2"
                  : "#d9c7ea"
        cells.push(
          <rect
            key={`open-${row}-${col}`}
            x={x + 2}
            y={y + 2}
            width={UNIT - 4}
            height={UNIT - 4}
            fill={lit}
            className={active !== null && active.region === region ? "transition-none" : "transition-[fill] duration-500"}
          />,
        )
      }
    }
  }

  const taskById = new Map(document.tasks.map((task) => [task.id, task]))
  const markers: React.ReactNode[] = tasks.map((task) => {
    const [startRow, startCol] = task.start
    const [goalRow, goalCol] = task.goal
    const label = taskById.get(task.id)?.amr ?? task.amr
    return (
      <g key={task.id}>
        <circle
          cx={startCol * UNIT + UNIT / 2}
          cy={startRow * UNIT + UNIT / 2}
          r={9}
          fill="#221531"
        />
        <rect
          x={goalCol * UNIT + UNIT / 2 - 8}
          y={goalRow * UNIT + UNIT / 2 - 8}
          width={16}
          height={16}
          fill="#ff36a8"
        />
        <text
          x={startCol * UNIT + UNIT / 2}
          y={startRow * UNIT - 6}
          textAnchor="middle"
          className="fill-[#221531]"
          fontSize="13"
          fontFamily="var(--font-mono-plex), monospace"
        >
          {label}
        </text>
      </g>
    )
  })

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`The demo warehouse with AMR-7's granted crossing and AMR-8's held region marked`}
      >
        {cells}
        {markers}
      </svg>
      {FIRE && HOLD ? (
        <p className="mt-3 font-mono text-[11px] leading-5 tracking-[0.08em] text-foreground">
          {active === null ? (
            <>
              <span className="text-signal">AMR-7</span> crosses {FIRE.regions.join(", then ")}.{" "}
              <span className="text-neon-orange">AMR-8</span> holds at the {HOLD.regions[0]}.
            </>
          ) : active.tone === "fire" ? (
            <>
              <span className="text-signal">Crossing</span> {active.region}
            </>
          ) : (
            <>
              <span className="text-neon-orange">Held</span> {active.region}
            </>
          )}
        </p>
      ) : null}
      <figcaption className="mt-3 flex flex-wrap justify-between gap-3 font-mono text-[10px] tracking-[0.14em] text-silver uppercase">
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-foreground align-middle" />
          Start
        </span>
        <span>Three runs · four aisles · one apron</span>
        <span>
          <span className="mr-1 inline-block size-2 bg-signal align-middle" />
          Goal
        </span>
      </figcaption>
    </figure>
  )
}
