import { useEffect, useState } from 'react'

/** Every heading on this site renders through this component instead of as plain text --
 * scrambling through cipher-like noise before resolving left-to-right into the real word, like
 * watching a substitution cipher get cracked. Not a generic "hacker text" gimmick borrowed from
 * elsewhere: on a site whose entire subject is breaking ciphertext back into plaintext, this is
 * the one animation that's actually about the content rather than decorating it.
 *
 * Accessibility: the accessible name comes from the caller's `aria-label` on the wrapping
 * heading element (see components/ui.tsx's PageHeader), not from this component's mid-animation
 * DOM text -- this span is `aria-hidden` so screen readers never see the scramble frames. */

const CIPHER_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-/=?@'

function randomChar(): string {
  return CIPHER_POOL[Math.floor(Math.random() * CIPHER_POOL.length)]
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function DecryptText({ text, className = '', speed = 20, trailWidth = 6 }: { text: string; className?: string; speed?: number; trailWidth?: number }) {
  const [display, setDisplay] = useState(text)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(text)
      return
    }
    let cancelled = false
    let revealed = 0
    const totalSteps = text.length + trailWidth

    function step() {
      if (cancelled) return
      revealed += 1
      let out = ''
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') out += ' '
        else if (i < revealed - trailWidth) out += text[i]
        else out += randomChar()
      }
      setDisplay(out)
      if (revealed < totalSteps) {
        setTimeout(step, speed)
      } else {
        setDisplay(text)
      }
    }
    step()
    return () => {
      cancelled = true
    }
  }, [text, speed, trailWidth])

  return (
    <span aria-hidden="true" className={className}>
      {display}
    </span>
  )
}
