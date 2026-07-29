import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { setSfxEnabled } from '../lib/sfx'

/** A single, quiet mute toggle for this site's sound effects (see lib/sfx.ts) -- gates whether
 * one-shot effects are allowed to fire, nothing more. There's no ambient loop underneath it and
 * no caption to show: unlike a generative background texture, each effect fires at the exact
 * moment of the action it represents (encrypt, decrypt, a stage advancing), so what it means is
 * already obvious from what just happened on screen. Off by default every visit, same as every
 * other optional extra on this site: nothing plays until asked. */
export default function SfxToggle() {
  const [enabled, setEnabled] = useState(false)

  function toggle() {
    const next = !enabled
    setSfxEnabled(next)
    setEnabled(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="focus-ring flex shrink-0 items-center justify-center rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-gold/50 hover:text-ink"
      aria-label={enabled ? 'Mute sound effects' : 'Unmute sound effects'}
      title={enabled ? 'Sound effects: on' : 'Sound effects: off'}
    >
      {enabled ? <Volume2 className="h-4 w-4 text-gold" /> : <VolumeX className="h-4 w-4" />}
    </button>
  )
}
