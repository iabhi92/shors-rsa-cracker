import { motion } from 'motion/react'

/** A hand-drawn-feeling illustration of a bank vault door -- not a stock icon. Ties directly to
 * the content: RSA's private key is the vault's combination, and factoring N is what actually
 * cracks it open. The jagged fracture line only appears once `cracked` is true, drawn on with a
 * real path-length animation rather than just fading in, so it reads as "just broke" instead of
 * "was already broken." Recolored to this site's own gold/navy/success palette -- the previous
 * version used generic Tailwind amber/zinc hex values that matched nothing else on the page. */
export default function VaultIllustration({ cracked = false }: { cracked?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label={cracked ? 'A vault door, cracked open' : 'A locked vault door'}>
      <defs>
        <radialGradient id="vault-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={cracked ? '#54c89a' : '#e3b45e'} stopOpacity={cracked ? 0.4 : 0.12} />
          <stop offset="100%" stopColor={cracked ? '#54c89a' : '#e3b45e'} stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.circle
        cx="100"
        cy="100"
        r="95"
        fill="url(#vault-glow)"
        animate={cracked ? { scale: [1, 1.15, 1] } : undefined}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ transformOrigin: '100px 100px' }}
      />

      {/* outer door ring, slightly irregular radius per point for a hand-drawn feel rather than a perfect CAD circle */}
      <path
        d="M 100 8
           C 145 8, 182 30, 190 72
           C 196 108, 184 150, 152 175
           C 118 198, 78 197, 48 172
           C 16 146, 4 106, 12 68
           C 20 32, 56 8, 100 8 Z"
        fill="#0b1018"
        stroke={cracked ? '#54c89a' : '#8c919b'}
        strokeWidth="3"
      />

      {/* rivets */}
      {[
        [100, 22], [154, 40], [184, 90], [172, 148], [128, 186], [70, 186], [24, 144], [16, 88], [48, 38],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3.5" fill="#1b2430" stroke="#8c919b" strokeWidth="0.75" />
      ))}

      {/* combination dial */}
      <motion.g
        animate={cracked ? { rotate: 38 } : { rotate: [0, -6, 0] }}
        transition={cracked ? { type: 'spring', stiffness: 120, damping: 10 } : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '100px 100px' }}
      >
        <circle cx="100" cy="100" r="46" fill="none" stroke={cracked ? '#54c89a' : '#1b2430'} strokeWidth="2" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2
          const x1 = 100 + Math.cos(angle) * 40
          const y1 = 100 + Math.sin(angle) * 40
          const x2 = 100 + Math.cos(angle) * 46
          const y2 = 100 + Math.sin(angle) * 46
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8c919b" strokeWidth="1.5" />
        })}
        <line x1="100" y1="100" x2="100" y2="66" stroke={cracked ? '#54c89a' : '#8c919b'} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="100" r="6" fill={cracked ? '#54c89a' : '#8c919b'} />
      </motion.g>

      {/* handle/lever */}
      <g transform="translate(148,100)">
        <rect x="-4" y="-24" width="8" height="48" rx="4" fill="#1b2430" stroke="#8c919b" strokeWidth="1.5" />
      </g>

      {cracked && (
        <>
          <motion.path
            d="M 100 10 L 88 55 L 105 70 L 80 108 L 98 118 L 65 172 M 105 70 L 130 82 L 112 130"
            fill="none"
            stroke="#e3b45e"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
          {/* sparks kicked off the fracture, radiating outward once it's drawn */}
          {[
            { angle: -70, delay: 0.5 },
            { angle: -20, delay: 0.58 },
            { angle: 30, delay: 0.52 },
            { angle: 80, delay: 0.62 },
            { angle: 150, delay: 0.56 },
          ].map(({ angle, delay }) => (
            <motion.circle
              key={angle}
              r="2.5"
              fill="#e3b45e"
              initial={{ cx: 100, cy: 90, opacity: 1, scale: 1 }}
              animate={{
                cx: 100 + Math.cos((angle * Math.PI) / 180) * 70,
                cy: 90 + Math.sin((angle * Math.PI) / 180) * 70,
                opacity: 0,
                scale: 0.2,
              }}
              transition={{ duration: 0.6, delay, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
    </svg>
  )
}
