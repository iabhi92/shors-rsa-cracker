import { motion } from 'motion/react'

/** A hand-drawn-feeling illustration of a key, in the same illustrated line-art family as
 * VaultIllustration.tsx -- shown at the moment a real RSA keypair is generated, with a glint
 * animation sweeping across it once (a "here's your key" beat, not a static icon). */
export default function KeyIllustration() {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full" role="img" aria-label="An illustrated key">
      <defs>
        <clipPath id="key-clip">
          <path d="M 40 50 C 40 32, 55 18, 73 18 C 91 18, 106 32, 106 50 C 106 68, 91 82, 73 82 C 68 82, 63 81, 59 79 L 50 88 L 40 88 L 40 78 L 30 78 L 30 68 L 22 68 L 22 58 L 40 58 Z" />
        </clipPath>
      </defs>

      {/* bow (handle) + shaft, one continuous hand-inked stroke */}
      <path
        d="M 40 50 C 40 32, 55 18, 73 18 C 91 18, 106 32, 106 50 C 106 68, 91 82, 73 82 C 68 82, 63 81, 59 79 L 50 88 L 40 88 L 40 78 L 30 78 L 30 68 L 22 68 L 22 58 L 40 58 Z"
        fill="#0a0a0a"
        stroke="#fbbf24"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* bow center hole */}
      <circle cx="73" cy="50" r="14" fill="#0a0a0a" stroke="#e2793d" strokeWidth="2" />
      <circle cx="73" cy="50" r="14" fill="none" stroke="#52525b" strokeWidth="0.75" strokeDasharray="2 3" />

      {/* teeth notches on the shaft */}
      <path d="M 30 68 L 30 74 M 22 58 L 22 63" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />

      {/* glint sweep, clipped to the key silhouette */}
      <g clipPath="url(#key-clip)">
        <motion.rect
          x="-40"
          y="0"
          width="24"
          height="100"
          fill="#fde68a"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 170, opacity: [0, 0.55, 0] }}
          transition={{ duration: 1.1, delay: 0.3, ease: 'easeInOut' }}
          style={{ transform: 'skewX(-20deg)' }}
        />
      </g>
    </svg>
  )
}
