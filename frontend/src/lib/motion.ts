/** Shared motion vocabulary for the site's structural chrome -- page transitions, pipeline stage
 * transitions, section reveals, card mounts -- so those all move with one consistent signature
 * instead of each component inventing its own duration/easing by feel (this file exists because
 * two of those exact moments, the page transition and the pipeline stage transition, had each
 * grown their own near-identical but not-quite-matching custom bezier curve).
 *
 * Deliberately NOT applied to bespoke, narrative-timed animations -- the harbour bridge scene,
 * sparks, spinning dials, the tortoise/hare race, the vault fracture. Those are tuned to specific
 * storytelling moments, not chrome, and forcing them onto a shared scale would flatten exactly
 * the character that makes them work. */

// A soft "decelerate and settle" curve -- quick out of the gate, gentle landing. Anything that
// should read as "arriving into place" (a new page, a new pipeline stage) uses this.
export const EASE_SIGNATURE: [number, number, number, number] = [0.19, 1, 0.32, 1]

export const DURATION = {
  micro: 0.16, // toggles, menu open/close -- near-instant, no easing needed
  fast: 0.3, // small entrances: a card, a chip, a staggered list item
  base: 0.4, // the site's primary "settle" beat -- page and stage transitions, section reveals
} as const
