"use client"

import { useEffect } from "react"

/**
 * Position-driven entrances, never timed ones. Each [data-reveal] element
 * enters at the viewport bottom and settles by about 62 percent up, scrubbed
 * exactly to the scroll position: the motion moves as far as the reader
 * scrolls, stops when they stop, and reverses on the way back. Under reduced
 * motion, without JavaScript, or once an element has settled, no from-state
 * exists anywhere: the exported bytes always show the true content.
 */
export function ScrollReveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reduce.matches) return

    const SETTLE = 0.62

    // Bind each element exactly once, even across double mounts.
    const known = new WeakSet<HTMLElement>()
    const elements: HTMLElement[] = []
    let frame = 0
    let anchorTimer: ReturnType<typeof setTimeout> | undefined

    const apply = () => {
      frame = 0
      const viewport = window.innerHeight
      for (const element of elements) {
        const rect = element.getBoundingClientRect()
        const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport * SETTLE)))
        // Write only the two entrance properties and never the whole style
        // attribute: inline styles the element already carries, such as an
        // animation delay, must survive the scrub.
        if (progress >= 1) {
          element.style.removeProperty("opacity")
          element.style.removeProperty("transform")
        } else {
          // Rows travel less than blocks: the cascade reads as rhythm, not noise.
          const travel = element.getAttribute("data-reveal") === "row" ? 14 : 24
          element.style.opacity = progress.toFixed(3)
          element.style.transform = `translateY(${((1 - progress) * travel).toFixed(1)}px)`
        }
      }
    }

    const scrub = () => {
      if (frame === 0) frame = window.requestAnimationFrame(apply)
    }

    // (Re)anchor: bind elements not yet bound, then measure once. The
    // ResizeObserver below re-runs this whenever the document's height
    // actually changes, debounced, so route changes re-anchor too.
    const anchor = () => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"))) {
        if (!known.has(element)) {
          known.add(element)
          elements.push(element)
        }
      }
      scrub()
    }

    anchor()
    window.addEventListener("scroll", scrub, { passive: true })

    const observer = new ResizeObserver(() => {
      clearTimeout(anchorTimer)
      anchorTimer = setTimeout(anchor, 150)
    })
    observer.observe(document.body)

    return () => {
      clearTimeout(anchorTimer)
      window.removeEventListener("scroll", scrub)
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
