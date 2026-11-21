"use client"

import { useState } from "react"
import { BUCKETS, DENSITY, bucketLabel, splitsAt } from "@/lib/figures"

/**
 * The release gate, run in the browser with the gate's own rule: an ask is
 * granted when its origin region is clear at the departure bucket, and held
 * when the bucket carries conflict density. The reading is the same published
 * density the static journal quotes, so the panel answers exactly as the gate
 * answers. The settled initial ask ships in the static bytes.
 */

type Answer = { decision: "fire" | "hesitate"; region: string; bucket: number; text: string }

function gateAnswer(region: string, bucket: number): Answer {
  const cell = splitsAt(DENSITY, region, bucket)
  const text = !cell || cell.splits === 0
    ? `Granted. The ${region} is clear at the departure.`
    : `Held. The ${region} carries conflict density in ticks ${bucketLabel(bucket)}.`
  return { decision: !cell || cell.splits === 0 ? "fire" : "hesitate", region, bucket, text }
}

export function GatePanel() {
  const regions = Array.from(new Set(DENSITY.map((row) => row.region)))
  // The settled initial ask is Kiln's: the Dispatch Apron, departing tick 0.
  const initial = regions.includes("Dispatch Apron") ? "Dispatch Apron" : (regions[0] ?? "Main Run")
  const [region, setRegion] = useState(initial)
  const [bucket, setBucket] = useState(0)
  const [answer, setAnswer] = useState<Answer>(() => gateAnswer(initial, 0))

  const fired = answer.decision === "fire"

  return (
    <div className="border border-paper/20 bg-smoke p-6 sm:p-8">
      <p className="max-w-lg text-sm text-paper/70">
        The gate grants an ask when its origin region is clear at departure time and holds it when that window
        carries congestion.
      </p>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-[0.14em] text-paper/70 uppercase">Origin region</span>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="border border-paper/25 bg-deep px-3 py-2 font-mono text-sm text-paper"
          >
            {regions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-[0.14em] text-paper/70 uppercase">Departure window</span>
          <select
            value={bucket}
            onChange={(event) => setBucket(Number(event.target.value))}
            className="border border-paper/25 bg-deep px-3 py-2 font-mono text-sm text-paper"
          >
            {Array.from({ length: BUCKETS }, (_, index) => (
              <option key={index} value={index}>
                ticks {bucketLabel(index)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setAnswer(gateAnswer(region, bucket))}
          className="btn-pop bg-neon-pink px-5 py-2.5 font-mono text-[12px] tracking-[0.14em] text-foreground uppercase transition-colors hover:bg-neon-yellow sm:mt-auto"
        >
          Ask the gate
        </button>
      </div>

      {/* The region's whole horizon at a glance: splits by bucket, the chosen bucket carrying the answer. */}
      <div className="mt-8">
        <p className="font-mono text-[10px] tracking-[0.16em] text-paper/60 uppercase">
          Splits by four-tick window · {region}
        </p>
        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${BUCKETS}, minmax(0, 1fr))` }}>
          {Array.from({ length: BUCKETS }, (_, index) => {
            const cell = splitsAt(DENSITY, region, index)
            const splits = cell?.splits ?? 0
            const selected = index === answer.bucket && region === answer.region
            const hot = splits > 0
            return (
              <div
                key={index}
                className={`flex h-12 flex-col items-center justify-center border font-mono text-xs ${
                  selected
                    ? fired
                      ? "border-neon-yellow bg-neon-yellow text-foreground"
                      : "border-neon-orange bg-neon-orange text-foreground"
                    : hot
                      ? "border-neon-orange/50 bg-ember/60 text-paper"
                      : "border-paper/15 text-paper/50"
                }`}
                title={`ticks ${bucketLabel(index)}: ${splits} splits`}
              >
                <span>{splits > 0 ? splits : "·"}</span>
                <span className="text-[9px] tracking-[0.08em] opacity-70">{bucketLabel(index)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p aria-live="polite" key={`${answer.region}-${answer.bucket}`} className="gate-answer mt-6 font-mono text-sm">
        <span className={fired ? "text-neon-yellow" : "text-neon-orange"}>{fired ? "Fired" : "Held"}.</span>{" "}
        <span className="text-paper">{answer.text.replace(fired ? "Granted." : "Held.", "").trim()}</span>
      </p>
    </div>
  )
}
