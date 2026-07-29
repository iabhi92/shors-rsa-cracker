import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import type { BridgeIncidentPhase } from '../../hooks/useApi'

/** Where the incident happens: dead center of the arch (matches archYMain(600) === 60 in
 * HarbourBridgeIllustration.tsx), so the car, the skid marks and the crack it falls through all
 * line up under the arch's peak rather than floating at an arbitrary spot on the deck. */
const CRASH_X = 600
const DECK_Y = 292

/** One rolling wheel: a hubcap with spokes that actually spins, inside a wheel arch cut into
 * the body silhouette -- the single detail that most separates "car" from "pod with circles
 * under it." */
function Wheel({ cx, reduceMotion }: { cx: number; reduceMotion: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={DECK_Y - 12} r={11} fill="#12181f" stroke="#0b1018" strokeWidth={1.5} />
      <motion.g
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}
        style={{ originX: `${cx}px`, originY: `${DECK_Y - 12}px` }}
      >
        <circle cx={cx} cy={DECK_Y - 12} r={4.5} fill="none" stroke="#4a5560" strokeWidth={1} />
        {[0, 90, 180, 270].map((a) => (
          <line
            key={a}
            x1={cx}
            y1={DECK_Y - 12}
            x2={cx + 4.5 * Math.cos((a * Math.PI) / 180)}
            y2={DECK_Y - 12 + 4.5 * Math.sin((a * Math.PI) / 180)}
            stroke="#4a5560"
            strokeWidth={1}
          />
        ))}
      </motion.g>
    </g>
  )
}

/** A self-driving car losing control on the deck, styled after the real thing (Waymo's Jaguar
 * I-PACE fleet): a crossover body with proper wheel arches cut into the silhouette, a prominent
 * roof sensor dome, and wheels that actually spin. Three things earlier versions got wrong, all
 * of which read as "sliding" rather than "swerving": a slow, smooth, wide side-to-side glide
 * (exactly a UFO's idle bob), horizontal streak lines behind it (thruster trail, not friction),
 * and -- even after the skid itself was made fast and irregular -- pure x translation with no
 * rotation at all, so the body stayed perfectly upright through every correction and still just
 * read as "moving right and left" rather than a car actually fighting for control. Adding a small
 * rotational wobble (`rotate`), synced to the same irregular timing as the x-swerve and always a
 * few degrees out of phase with it (the nose swings opposite to the direction of travel, the way
 * a real fishtailing rear end kicks the tail out), is what actually sells "spinning out" instead
 * of "sliding". */
function RunawayCar({ reduceMotion, falling }: { reduceMotion: boolean; falling: boolean }) {
  return (
    <motion.g
      initial={reduceMotion ? undefined : { x: -14, rotate: 0 }}
      animate={
        falling
          ? { y: 34, scale: 0.55, rotate: 45, opacity: 0 }
          : reduceMotion
            ? { x: 12, rotate: 0 }
            : { x: [-14, -10, 12, 8, -14], rotate: [4, -6, 7, -5, 4] }
      }
      transition={
        falling
          ? { duration: 0.9, ease: 'easeIn' }
          : { duration: 0.7, repeat: Infinity, ease: 'easeInOut', times: [0, 0.12, 0.55, 0.68, 1] }
      }
      style={{ originX: `${CRASH_X}px`, originY: `${DECK_Y - 4}px` }}
    >
      {/* tyre-smoke puffs, replacing the earlier streak lines -- friction, not thrust */}
      {!falling && !reduceMotion && (
        <>
          {[0, 0.35].map((delay) => (
            <motion.circle
              key={delay}
              fill="#5a6068"
              initial={{ cx: CRASH_X - 30, cy: DECK_Y - 4, r: 2, opacity: 0 }}
              animate={{ cx: [CRASH_X - 30, CRASH_X - 40], cy: [DECK_Y - 4, DECK_Y - 12], r: [2, 5], opacity: [0, 0.4, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay }}
            />
          ))}
        </>
      )}

      {/* contact shadow, squashing wider on the compressed part of the suspension cycle */}
      {!falling && (
        <motion.ellipse
          cx={CRASH_X}
          cy={DECK_Y + 3}
          ry={3}
          fill="#0b1018"
          opacity={0.5}
          initial={{ rx: 44 }}
          animate={reduceMotion ? { rx: 44 } : { rx: [44, 47, 44, 47, 44] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* skid marks, left behind the swerve */}
      {!falling && (
        <g stroke="#3a4048" strokeWidth={2} fill="none" opacity={0.6} strokeLinecap="round">
          <path d={`M ${CRASH_X - 130} ${DECK_Y} Q ${CRASH_X - 100} ${DECK_Y - 6}, ${CRASH_X - 68} ${DECK_Y}`} strokeDasharray="3 4" />
          <path d={`M ${CRASH_X - 138} ${DECK_Y + 8} Q ${CRASH_X - 108} ${DECK_Y + 2}, ${CRASH_X - 76} ${DECK_Y + 8}`} strokeDasharray="3 4" />
        </g>
      )}

      <Wheel cx={CRASH_X - 28} reduceMotion={reduceMotion} />
      <Wheel cx={CRASH_X + 28} reduceMotion={reduceMotion} />

      {/* body: crossover/SUV profile with wheel arches cut into the sill, not floating circles.
          Cream/gold-toned (not the earlier pale cyan) -- ties it to the bridge's own deck and
          arch colours instead of reading as sci-fi chrome. */}
      <motion.path
        d={`M ${CRASH_X - 52} ${DECK_Y - 12}
            L ${CRASH_X - 52} ${DECK_Y - 24}
            Q ${CRASH_X - 40} ${DECK_Y - 24}, ${CRASH_X - 38} ${DECK_Y - 15}
            Q ${CRASH_X - 34} ${DECK_Y - 4}, ${CRASH_X - 20} ${DECK_Y - 4}
            Q ${CRASH_X - 20} ${DECK_Y - 15}, ${CRASH_X - 16} ${DECK_Y - 24}
            L ${CRASH_X - 38} ${DECK_Y - 24}
            Q ${CRASH_X - 46} ${DECK_Y - 30}, ${CRASH_X - 38} ${DECK_Y - 42}
            L ${CRASH_X - 30} ${DECK_Y - 54}
            Q ${CRASH_X - 22} ${DECK_Y - 58}, ${CRASH_X - 6} ${DECK_Y - 58}
            Q ${CRASH_X + 10} ${DECK_Y - 58}, ${CRASH_X + 16} ${DECK_Y - 52}
            L ${CRASH_X + 26} ${DECK_Y - 42}
            Q ${CRASH_X + 40} ${DECK_Y - 30}, ${CRASH_X + 30} ${DECK_Y - 24}
            L ${CRASH_X + 16} ${DECK_Y - 24}
            Q ${CRASH_X + 20} ${DECK_Y - 15}, ${CRASH_X + 20} ${DECK_Y - 4}
            Q ${CRASH_X + 34} ${DECK_Y - 4}, ${CRASH_X + 38} ${DECK_Y - 15}
            Q ${CRASH_X + 40} ${DECK_Y - 24}, ${CRASH_X + 52} ${DECK_Y - 24}
            L ${CRASH_X + 52} ${DECK_Y - 12}
            Z`}
        fill="#eee8da"
        stroke="#1b2430"
        strokeWidth={1.75}
        strokeLinejoin="round"
        animate={reduceMotion || falling ? undefined : { scaleY: [1, 0.96, 1, 0.96, 1] }}
        transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originY: `${DECK_Y - 12}px` }}
      />
      {/* lower-body shade, so the silhouette reads as a rounded volume, not a flat cutout */}
      <path
        d={`M ${CRASH_X - 38} ${DECK_Y - 24} L ${CRASH_X + 30} ${DECK_Y - 24} L ${CRASH_X + 30} ${DECK_Y - 15} Q ${CRASH_X - 4} ${DECK_Y - 10}, ${CRASH_X - 38} ${DECK_Y - 15} Z`}
        fill="#c9ab6a"
        opacity={0.4}
      />
      {/* window belt-line */}
      <path
        d={`M ${CRASH_X - 36} ${DECK_Y - 41} L ${CRASH_X - 28} ${DECK_Y - 53} Q ${CRASH_X - 20} ${DECK_Y - 56}, ${CRASH_X - 6} ${DECK_Y - 56} Q ${CRASH_X + 8} ${DECK_Y - 56}, ${CRASH_X + 14} ${DECK_Y - 50} L ${CRASH_X + 23} ${DECK_Y - 41} Z`}
        fill="#1b2430"
        opacity={0.85}
      />
      <line x1={CRASH_X - 8} y1={DECK_Y - 41} x2={CRASH_X - 8} y2={DECK_Y - 56} stroke="#0b1018" strokeWidth={1} opacity={0.6} />
      {/* side-mirror sensor pod, near the front door pillar */}
      <path d={`M ${CRASH_X - 16} ${DECK_Y - 44} L ${CRASH_X - 20} ${DECK_Y - 43} L ${CRASH_X - 19} ${DECK_Y - 39} Z`} fill="#1b2430" stroke="#204a66" strokeWidth={0.75} />

      {/* the roof sensor dome -- the actual "self-driving" tell, deliberately the most
          prominent single detail on the car, with satellite pods and a rotating LIDAR sweep */}
      <g>
        <line x1={CRASH_X - 18} y1={DECK_Y - 59} x2={CRASH_X + 6} y2={DECK_Y - 59} stroke="#c99545" strokeWidth={1} opacity={0.75} />
        {[CRASH_X - 17, CRASH_X - 4, CRASH_X + 5].map((sx) => (
          <circle key={sx} cx={sx} cy={DECK_Y - 59} r={1.2} fill="#1b2430" stroke="#c99545" strokeWidth={0.5} />
        ))}
        <rect x={CRASH_X - 12} y={DECK_Y - 68} width={17} height={10} rx={4} fill="#1b2430" stroke="#e3b45e" strokeWidth={1.25} />
        <motion.line
          x1={CRASH_X - 3.5}
          y1={DECK_Y - 63}
          x2={CRASH_X + 9}
          y2={DECK_Y - 63}
          stroke="#e3b45e"
          strokeWidth={1.1}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          style={{ originX: `${CRASH_X - 3.5}px`, originY: `${DECK_Y - 63}px` }}
        />
      </g>

      {/* headlight (front) and a blinking hazard/taillight (rear) */}
      <ellipse cx={CRASH_X + 49} cy={DECK_Y - 20} rx={2.4} ry={1.6} fill="#eee8da" />
      <motion.ellipse
        cx={CRASH_X - 49}
        cy={DECK_Y - 20}
        rx={2.4}
        ry={1.6}
        fill="#e05a4e"
        animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />

      {/* sparks kicked up by the swerve */}
      {!reduceMotion && !falling && (
        <motion.circle
          r={1.2}
          fill="#e3b45e"
          initial={{ cx: CRASH_X - 55, cy: DECK_Y - 4, opacity: 0 }}
          animate={{ cx: [CRASH_X - 55, CRASH_X - 70], cy: [DECK_Y - 4, DECK_Y + 2], opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.5 }}
        />
      )}
    </motion.g>
  )
}

/** The deck splitting open under the car and closing back over once it's absorbed. Purely an
 * overlay effect -- it never touches HarbourBridgeIllustration's own paths, so once this group
 * unmounts (phase leaves 'quake') the real bridge underneath is simply revealed again, already
 * pristine. That's also what makes the "heal" free: there's nothing to animate back, just
 * something to stop drawing on top of it. */
function BridgeCrack() {
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <motion.rect
        x={CRASH_X - 15}
        y={DECK_Y - 46}
        width={30}
        height={78}
        fill="#0b1018"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.25 }}
        style={{ originY: `${DECK_Y - 8}px` }}
      />
      <motion.path
        d={`M ${CRASH_X - 15} ${DECK_Y - 46} L ${CRASH_X - 16} ${DECK_Y - 4} L ${CRASH_X - 64} ${DECK_Y - 4} L ${CRASH_X - 60} ${DECK_Y - 44} Z`}
        fill="#eee8da"
        stroke="#c99545"
        strokeWidth={1}
        opacity={0.55}
        initial={{ rotate: 0, x: 0 }}
        animate={{ rotate: -9, x: -3, y: 3 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ originX: `${CRASH_X - 60}px`, originY: `${DECK_Y - 4}px` }}
      />
      <motion.path
        d={`M ${CRASH_X + 15} ${DECK_Y - 46} L ${CRASH_X + 16} ${DECK_Y - 4} L ${CRASH_X + 64} ${DECK_Y - 4} L ${CRASH_X + 60} ${DECK_Y - 44} Z`}
        fill="#eee8da"
        stroke="#c99545"
        strokeWidth={1}
        opacity={0.55}
        initial={{ rotate: 0, x: 0 }}
        animate={{ rotate: 9, x: 3, y: 3 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ originX: `${CRASH_X + 60}px`, originY: `${DECK_Y - 4}px` }}
      />
      {[0, 0.15].map((delay) => (
        <motion.circle
          key={delay}
          r={1.5}
          fill="#e3b45e"
          initial={{ cx: CRASH_X, cy: DECK_Y - 30, opacity: 0.9 }}
          animate={{ cy: DECK_Y - 60, opacity: 0 }}
          transition={{ duration: 0.6, delay, ease: 'easeOut' }}
        />
      ))}
    </motion.g>
  )
}

/** A squashed dark ellipse under a standing figure -- without this every character in the
 * reconnect scene reads as pasted onto the deck rather than standing on it, which was a big part
 * of the "doesn't fit the bridge" complaint. */
function ContactShadow({ cx, cy, rx = 7 }: { cx: number; cy: number; rx?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.22} fill="#0b1018" opacity={0.4} />
}

/** A soft glow pool, faked with concentric low-opacity circles (no <defs>/radial-gradient
 * needed) -- ties Houdini's table and the alien's beam into one staged, lit moment instead of
 * disconnected icons scattered along the deck. */
function GlowPool({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <>
      {[18, 12, 7].map((r, i) => (
        <circle key={r} cx={cx} cy={cy} r={r} fill={color} opacity={0.05 + i * 0.03} />
      ))}
    </>
  )
}

/** A small, cartoonish ghost -- shrunk to about 60% of its old size (it was reading as the
 * biggest single figure in the whole vignette, out of scale with Houdini right next to it) and
 * redrawn with a friendlier, sillier face: big round googly eyes, a surprised "boo!" mouth, and
 * two stubby waving arms, instead of the small flat eyes and neutral eyebrow arc it had before.
 * Still translucent with a fainter trailing wisp behind it for depth, still bobbing and
 * flickering in and out. */
function Ghost() {
  return (
    <motion.g
      animate={{ y: [0, -6, 0, -3, 0], x: [0, 2, 0, -2, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <g transform="translate(118,47) scale(0.62) translate(-118,-47)">
        {/* trailing wisp */}
        <motion.path
          d="M 104 50 Q 100 33, 118 32 Q 136 33, 132 50 L 133 58 L 128 62 L 124 56 L 118 62 L 112 56 L 108 62 L 104 58 Z"
          fill="#cfe3ee"
          stroke="#204a66"
          strokeWidth={0.5}
          opacity={0.35}
          animate={{ opacity: [0.15, 0.32, 0.15] }}
          transition={{ duration: 2.3, repeat: Infinity }}
        />
        {/* main body */}
        <motion.path
          d="M 106 47 Q 104 31, 118 31 Q 132 31, 130 47 L 130 57 L 125 52 L 120 57 L 115 52 L 110 57 Z"
          fill="#cfe3ee"
          stroke="#204a66"
          strokeWidth={0.5}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 1.9, repeat: Infinity, delay: 0.3 }}
        />
        {/* two stubby waving arms -- a classic cartoon "boo" gesture */}
        <motion.path
          d="M 108 42 Q 100 40, 98 34"
          fill="none"
          stroke="#204a66"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.75}
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '108px', originY: '42px' }}
        />
        <motion.path
          d="M 128 42 Q 136 40, 138 34"
          fill="none"
          stroke="#204a66"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.75}
          animate={{ rotate: [8, -8, 8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
          style={{ originX: '128px', originY: '42px' }}
        />
        {/* big googly eyes with a highlight, and a small round "boo!" mouth -- funnier than the
            old flat dots + neutral brow */}
        <circle cx={112.5} cy={40} r={2.6} fill="#eee8da" opacity={0.9} />
        <circle cx={123.5} cy={40} r={2.6} fill="#eee8da" opacity={0.9} />
        <motion.circle
          cx={113}
          r={1.3}
          fill="#1b2430"
          initial={{ cy: 40.5 }}
          animate={{ cy: [40.5, 39.8, 40.5] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
        <motion.circle
          cx={123}
          r={1.3}
          fill="#1b2430"
          initial={{ cy: 40.5 }}
          animate={{ cy: [40.5, 39.8, 40.5] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
        <ellipse cx={118} cy={47.5} rx={2.4} ry={3} fill="#1b2430" opacity={0.75} />
      </g>
    </motion.g>
  )
}

/** Left vignette: Houdini's raised hand reaches through a medium's crystal-ball table toward a
 * ghost, the connection line solidifying as contact lands. No names on this side either -- see
 * AliceBobScene. */
function HoudiniScene({ connected }: { connected: boolean }) {
  return (
    <g opacity={0.9}>
      <GlowPool cx={86} cy={50} color="#e3b45e" />
      <ContactShadow cx={55} cy={59} rx={8} />
      <ContactShadow cx={86} cy={67} rx={7} />

      <motion.path
        d="M 44 46 Q 40 50, 41 57 Q 45 55, 47 50 Z"
        fill="#1b2430"
        stroke="#c99545"
        strokeWidth={0.4}
        animate={{ rotate: [-3, 3, -3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '47px', originY: '46px' }}
      />
      <circle cx={55} cy={36} r={5} fill="#1b2430" stroke="#c99545" strokeWidth={0.5} />
      {/* shadow-side shading, implying a light source up and to the left (the arch's own glow) */}
      <circle cx={57} cy={38} r={3.4} fill="#0b1018" opacity={0.4} />
      {/* a real face, not a blank circle -- focused eyes under furrowed brows (he's mid-
          concentration, reaching for contact), and the iconic Houdini mustache standing in for
          a mouth. This is the one figure the site singles out for extra realism, so it gets the
          most detail of any face in the scene. */}
      <circle cx={53} cy={35.3} r={0.7} fill="#eee8da" />
      <circle cx={57} cy={35.3} r={0.7} fill="#eee8da" />
      <circle cx={53.1} cy={35.5} r={0.35} fill="#0b1018" />
      <circle cx={57.1} cy={35.5} r={0.35} fill="#0b1018" />
      <path d="M 51.2 33.3 L 54 34.3" stroke="#c99545" strokeWidth={0.45} strokeLinecap="round" />
      <path d="M 58.8 33.3 L 56 34.3" stroke="#c99545" strokeWidth={0.45} strokeLinecap="round" />
      <path d="M 55 36.2 L 54.6 37.6 L 55.4 37.6" fill="none" stroke="#c99545" strokeWidth={0.3} opacity={0.7} />
      <path
        d="M 51.2 38.6 Q 53.2 40, 55 38.9 Q 56.8 40, 58.8 38.6"
        fill="none"
        stroke="#c99545"
        strokeWidth={0.8}
        strokeLinecap="round"
      />
      <path d="M 50 32 L 50 25 L 60 25 L 60 32 Z" fill="#1b2430" stroke="#c99545" strokeWidth={0.5} />
      <path d="M 47 33 L 63 33" stroke="#c99545" strokeWidth={0.5} />
      <path d="M 47 41 Q 55 38, 63 41 L 61 58 L 49 58 Z" fill="#1b2430" stroke="#c99545" strokeWidth={0.6} />
      <path d="M 63 44 Q 73 44, 79 40" fill="none" stroke="#c99545" strokeWidth={0.75} strokeLinecap="round" />
      <path d="M 76 42 L 79 40 L 78 43.5 Z" fill="#c99545" opacity={0.8} />

      <path d="M 80 58 L 92 58 L 89 66 L 83 66 Z" fill="#1b2430" stroke="#c99545" strokeWidth={0.4} />
      <motion.circle
        cx={86}
        cy={53}
        r={4.5}
        fill="#204a66"
        stroke="#e3b45e"
        strokeWidth={0.6}
        animate={{ opacity: connected ? [0.6, 1, 0.6] : 0.5 }}
        transition={{ duration: 1, repeat: connected ? Infinity : 0 }}
      />
      <circle cx={84.5} cy={51.5} r={1} fill="#eee8da" opacity={0.5} />

      <Ghost />

      <motion.path
        d="M 91 50 Q 99 46, 106 47"
        fill="none"
        stroke="#e3b45e"
        strokeWidth={connected ? 1.1 : 0.6}
        strokeDasharray={connected ? '0' : '2 3'}
        initial={{ opacity: 0.3 }}
        animate={{ opacity: connected ? 1 : 0.3 }}
        transition={{ duration: 0.4 }}
      />
      {/* a signal pulse travelling the beam, back and forth -- the same "travelling light dot"
          device HarbourBridgeIllustration.tsx already uses for the deck's data packets, reused
          here so the connection reads as visibly, continuously alive rather than a static line */}
      {connected && (
        <motion.circle
          fill="#e3b45e"
          initial={{ cx: 91, cy: 50, r: 1.1, opacity: 0 }}
          animate={{
            cx: [91, 99, 106, 99, 91],
            cy: [50, 46.5, 47, 46.5, 50],
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 0.4 }}
        />
      )}
      {connected && (
        <motion.path
          d="M 99 30 L 100 34 L 104 35 L 100 36 L 99 40 L 98 36 L 94 35 L 98 34 Z"
          fill="#e3b45e"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          style={{ originX: '99px', originY: '35px' }}
        />
      )}
    </g>
  )
}

/** Right vignette: an unnamed figure reaches an invisible second figure (a dashed, unfilled
 * outline) through an alien intermediary. No ALICE/BOB labels -- the figures speak for
 * themselves. The alien has a small hovering saucer under it and a proper antenna dish rather
 * than floating as a bare head. */
function AliceBobScene({ connected }: { connected: boolean }) {
  return (
    <g opacity={0.9}>
      <GlowPool cx={215} cy={48} color="#204a66" />
      <ContactShadow cx={178} cy={59} rx={8} />
      <ContactShadow cx={250} cy={59} rx={8} />

      <circle cx={178} cy={38} r={5} fill="#1b2430" stroke="#c99545" strokeWidth={0.5} />
      <circle cx={180} cy={40} r={3.2} fill="#0b1018" opacity={0.4} />
      <path d="M 175 34 Q 178 31, 181 34" fill="none" stroke="#c99545" strokeWidth={0.35} opacity={0.8} />
      {/* a real face -- open eyes and a hopeful, slightly uncertain mouth, reaching for someone
          she can't see yet */}
      <circle cx={176} cy={37.3} r={0.6} fill="#eee8da" />
      <circle cx={180} cy={37.3} r={0.6} fill="#eee8da" />
      <circle cx={176.1} cy={37.5} r={0.3} fill="#0b1018" />
      <circle cx={180.1} cy={37.5} r={0.3} fill="#0b1018" />
      <path d="M 176 41 Q 178 42.2, 180 41" fill="none" stroke="#c99545" strokeWidth={0.4} strokeLinecap="round" />
      <path d="M 172 44 Q 178 41, 184 44 L 183 58 L 173 58 Z" fill="#1b2430" stroke="#c99545" strokeWidth={0.6} />
      <path d="M 184 47 Q 191 46, 195 42" fill="none" stroke="#c99545" strokeWidth={0.75} strokeLinecap="round" />
      <path d="M 192 44 L 195 42 L 194.5 45.5 Z" fill="#c99545" opacity={0.8} />

      <motion.g animate={{ y: [0, -3, 0, -1.5, 0], rotate: [0, 2, 0, -2, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} style={{ originX: '215px', originY: '48px' }}>
        <ellipse cx={215} cy={54} rx={8} ry={2.4} fill="#204a66" stroke="#204a66" strokeWidth={0.4} opacity={0.8} />
        <ellipse cx={215} cy={44} rx={4.5} ry={5.5} fill="#204a66" stroke="#cfe3ee" strokeWidth={0.5} />
        <ellipse cx={217} cy={46} rx={2.8} ry={3.6} fill="#0b1018" opacity={0.3} />
        <ellipse cx={212.5} cy={43} rx={1.6} ry={2} fill="#0b1018" />
        <ellipse cx={217.5} cy={43} rx={1.6} ry={2} fill="#0b1018" />
        <circle cx={212} cy={42.4} r={0.4} fill="#eee8da" opacity={0.7} />
        <circle cx={217} cy={42.4} r={0.4} fill="#eee8da" opacity={0.7} />
        <line x1={212} y1={38} x2={210} y2={34} stroke="#cfe3ee" strokeWidth={0.5} />
        <line x1={218} y1={38} x2={220} y2={34} stroke="#cfe3ee" strokeWidth={0.5} />
        <motion.circle
          cx={210}
          cy={33}
          r={1}
          fill="#e3b45e"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <motion.circle
          cx={220}
          cy={33}
          r={1}
          fill="#e3b45e"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <path d="M 210 51 L 215 54 L 220 51" fill="none" stroke="#cfe3ee" strokeWidth={0.5} />
      </motion.g>

      <circle cx={250} cy={38} r={5} fill="none" stroke="#204a66" strokeWidth={0.6} strokeDasharray="1.5 2" />
      <path d="M 244 44 Q 250 41, 256 44 L 255 58 L 245 58 Z" fill="none" stroke="#204a66" strokeWidth={0.6} strokeDasharray="1.5 2" />

      <motion.path
        d="M 197 43 L 209 44"
        stroke="#e3b45e"
        strokeWidth={connected ? 1.1 : 0.6}
        strokeDasharray={connected ? '0' : '1.5 2'}
        animate={{ opacity: connected ? 1 : 0.35 }}
        transition={{ duration: 0.4 }}
      />
      <motion.path
        d="M 221 44 L 243 43"
        stroke="#e3b45e"
        strokeWidth={connected ? 1.1 : 0.6}
        strokeDasharray={connected ? '0' : '1.5 2'}
        animate={{ opacity: connected ? 1 : 0.35 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      />
      {/* signal pulse, relayed by the alien from the invisible figure (Bob, right) to the
          visible one (Alice, left) -- the pulse's first pass on mount runs Bob -> alien ->
          Alice, matching that direction, then ping-pongs to stay visibly alive rather than
          firing once and going static. */}
      {connected && (
        <motion.circle
          fill="#e3b45e"
          initial={{ cx: 243, cy: 43, r: 1.1, opacity: 0 }}
          animate={{ cx: [243, 215, 197, 215, 243], cy: [43, 44, 43, 44, 43], opacity: [0, 1, 1, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', repeatDelay: 0.4, delay: 0.5 }}
        />
      )}
    </g>
  )
}

/** Places the runaway-car havoc / bridge-crack / Houdini-reconnect scenes directly on top of the
 * real hero bridge (same viewBox as HarbourBridgeIllustration.tsx, so the arch/pylon/deck
 * coordinates line up exactly). The whole-bridge tremble during 'quake' is driven by the parent
 * (SydneyHarbourHero wraps both this and the real illustration in one shaking container) so the
 * actual bridge shakes too, not just this overlay. */
export default function HarbourBridgeIncident({ phase }: { phase: BridgeIncidentPhase }) {
  const reduceMotion = !!useReducedMotion()

  return (
    <svg
      viewBox="0 0 1200 340"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={
        phase === 'connected'
          ? 'Illustration of Houdini reaching a ghost, and a figure reaching an invisible second figure through an alien intermediary, on the Sydney Harbour Bridge'
          : 'Illustration of a self-driving car losing control on the Sydney Harbour Bridge, indicating the backend is waking up'
      }
    >
      <AnimatePresence mode="wait">
        {(phase === 'havoc' || phase === 'quake') && (
          <motion.g key="car-incident" exit={{ opacity: 0 }}>
            <RunawayCar reduceMotion={reduceMotion} falling={phase === 'quake'} />
            {phase === 'quake' && <BridgeCrack />}
          </motion.g>
        )}
        {phase === 'connected' && (
          <motion.g
            key="reconnect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            transform="translate(50,72) scale(3.8)"
          >
            {/* Houdini's vignette and the Alice/Bob one used to sit only ~36 local units apart
                (~137px on screen) -- close enough that the two scenes read as one crowded
                cluster instead of two separate moments on the same bridge. Shifting the second
                vignette right (rather than widening the shared scale, which would also blow up
                each figure's own size) roughly doubles that gap while staying inside the
                viewBox -- checked against the 1200-wide canvas, not just eyeballed. */}
            <line x1={172} y1={16} x2={172} y2={78} stroke="#3a4048" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.6} />
            <HoudiniScene connected />
            <g transform="translate(35,0)">
              <AliceBobScene connected />
            </g>
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  )
}
