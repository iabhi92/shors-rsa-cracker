import { motion, useReducedMotion } from 'motion/react'

/** Replaces the old train/road pair with the actual origin story of this project: a small UNSW
 * tutorial class. Kept deliberately in the same hand-drawn ink-line style as every other figure
 * on this site (Houdini, Alice, the History page's cast) rather than attempting a photorealistic
 * portrait -- this is a stylised, generic tutor-and-class scene (long wavy hair, glasses, and a
 * patterned shirt as a nod to the room, not a likeness of a specific identifiable person),
 * consistent with how every other real person referenced on this site (Rivest, Shamir, Adleman,
 * Shor) is drawn as an anonymous illustrated figure rather than a rendered photo. A whiteboard
 * full of the actual math this site teaches, a door, a window, a wall clock, and a room of
 * students at real desks with laptops open -- the room this whole project came out of, with
 * enough real furniture and proportion to read as an actual room rather than a diagram of one. */

function StudentPerson({ cx, cy, color, hairStyle }: { cx: number; cy: number; color: string; hairStyle: 'short' | 'bun' | 'side' }) {
  return (
    <g>
      {/* chair back with wheeled casters -- a real tutorial-room rolling chair, not a bare stool */}
      <rect x={cx - 9} y={cy - 6} width={18} height={22} rx={2} fill="none" stroke="#3a4048" strokeWidth={0.6} opacity={0.7} />
      <line x1={cx} y1={cy + 16} x2={cx} y2={cy + 20} stroke="#3a4048" strokeWidth={0.6} opacity={0.7} />
      {[-5, 0, 5].map((dx) => (
        <circle key={dx} cx={cx + dx} cy={cy + 21} r={1.1} fill="#12181f" stroke="#3a4048" strokeWidth={0.4} />
      ))}
      {/* desk with a laptop, screen lit */}
      <rect x={cx - 17} y={cy + 21} width={34} height={2.5} fill="#1b2430" stroke="#3a4048" strokeWidth={0.5} />
      <rect x={cx - 14} y={cy + 23.5} width={4} height={11} fill="#12181f" />
      <rect x={cx + 10} y={cy + 23.5} width={4} height={11} fill="#12181f" />
      <path d={`M ${cx - 7} ${cy + 21} L ${cx - 6} ${cy + 15} L ${cx + 6} ${cy + 15} L ${cx + 7} ${cy + 21} Z`} fill="#101722" stroke="#8c919b" strokeWidth={0.5} />
      <rect x={cx - 5.5} y={cy + 15.6} width={11} height={5.4} fill="#0b1018" stroke="#8c919b" strokeWidth={0.4} />
      <rect x={cx - 4.6} y={cy + 16.4} width={9.2} height={3.8} fill={color} opacity={0.3} />
      <ellipse cx={cx - 12} cy={cy + 32.5} rx={2.4} ry={1.2} fill="#12181f" />
      <ellipse cx={cx + 12} cy={cy + 32.5} rx={2.4} ry={1.2} fill="#12181f" />

      {/* body -- shoulders + torso, not a flat triangle */}
      <path
        d={`M ${cx - 7} ${cy + 15} L ${cx - 7.5} ${cy + 4} Q ${cx - 6} ${cy}, ${cx} ${cy - 1} Q ${cx + 6} ${cy}, ${cx + 7.5} ${cy + 4} L ${cx + 7} ${cy + 15} Z`}
        fill="#1b2430"
        stroke={color}
        strokeWidth={0.8}
      />
      {/* forearms resting on the desk */}
      <path d={`M ${cx - 6.5} ${cy + 6} Q ${cx - 8} ${cy + 12}, ${cx - 4} ${cy + 15}`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <path d={`M ${cx + 6.5} ${cy + 6} Q ${cx + 8} ${cy + 12}, ${cx + 4} ${cy + 15}`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />

      {/* neck + head */}
      <rect x={cx - 1.6} y={cy - 4} width={3.2} height={3} fill="#1b2430" stroke={color} strokeWidth={0.5} />
      <circle cx={cx} cy={cy} r={6} fill="#1b2430" stroke={color} strokeWidth={0.8} />

      {/* one of three simple hair silhouettes, so the row doesn't read as identical clones */}
      {hairStyle === 'short' && <path d={`M ${cx - 6} ${cy - 1} Q ${cx - 6.5} ${cy - 7}, ${cx} ${cy - 6.5} Q ${cx + 6.5} ${cy - 7}, ${cx + 6} ${cy - 1} Q ${cx} ${cy - 4}, ${cx - 6} ${cy - 1} Z`} fill="#2a3138" />}
      {hairStyle === 'bun' && (
        <>
          <path d={`M ${cx - 6} ${cy - 1} Q ${cx - 6.5} ${cy - 6}, ${cx} ${cy - 6} Q ${cx + 6.5} ${cy - 6}, ${cx + 6} ${cy - 1} Q ${cx} ${cy - 3.5}, ${cx - 6} ${cy - 1} Z`} fill="#2a3138" />
          <circle cx={cx} cy={cy - 8} r={2.4} fill="#2a3138" />
        </>
      )}
      {hairStyle === 'side' && (
        <path
          d={`M ${cx - 6} ${cy - 1} Q ${cx - 7} ${cy - 6}, ${cx - 1} ${cy - 6.5} Q ${cx + 6} ${cy - 7}, ${cx + 6} ${cy - 2} L ${cx + 4} ${cy + 2} Q ${cx + 5} ${cy - 3}, ${cx} ${cy - 3.5} Q ${cx - 5} ${cy - 3}, ${cx - 6} ${cy - 1} Z`}
          fill="#2a3138"
        />
      )}

      <circle cx={cx - 2} cy={cy - 0.5} r={0.85} fill="#eee8da" />
      <circle cx={cx + 2} cy={cy - 0.5} r={0.85} fill="#eee8da" />
      <circle cx={cx - 1.95} cy={cy - 0.3} r={0.42} fill="#0b1018" />
      <circle cx={cx + 2.05} cy={cy - 0.3} r={0.42} fill="#0b1018" />
      <path d={`M ${cx - 2} ${cy + 2.6} Q ${cx} ${cy + 3.6}, ${cx + 2} ${cy + 2.6}`} fill="none" stroke={color} strokeWidth={0.45} strokeLinecap="round" />
    </g>
  )
}

function BackWall() {
  return (
    <>
      {/* door, far left, with a UNSW-style room plaque */}
      <rect x={4} y={54} width={26} height={94} rx={1} fill="#101722" stroke="#3a4048" strokeWidth={1} />
      <circle cx={26} cy={104} r={1.1} fill="#8c919b" />
      {/* room plaque -- deliberately oversized relative to a real door sign so "G05" actually
          reads at this whole illustration's small on-page scale, not just at 1:1 zoom */}
      <rect x={-2} y={28} width={38} height={22} rx={1.5} fill="#0b1018" stroke="#c99545" strokeWidth={1} />
      <text x={17} y={40} textAnchor="middle" className="font-mono font-semibold" fontSize={10} fill="#c99545">
        G05
      </text>
      <text x={17} y={47} textAnchor="middle" className="font-mono" fontSize={4.5} fill="#8c919b">
        TUTORIAL ROOM
      </text>

      {/* window, far right, a soft sky instead of another slab of wall */}
      <rect x={780} y={38} width={100} height={70} rx={1} fill="#152033" stroke="#3a4048" strokeWidth={1.25} />
      <rect x={784} y={42} width={44} height={30} fill="#1c2c44" />
      <rect x={832} y={42} width={44} height={30} fill="#1c2c44" />
      <rect x={784} y={76} width={44} height={28} fill="#182640" />
      <rect x={832} y={76} width={44} height={28} fill="#182640" />
      <circle cx={800} cy={54} r={7} fill="#e3b45e" opacity={0.5} />
      <path d="M 840 60 Q 852 56, 864 60 Q 856 58, 848 60 Q 844 61, 840 60 Z" fill="#cfe3ee" opacity={0.35} />
      <line x1={830} y1={38} x2={830} y2={108} stroke="#3a4048" strokeWidth={1.5} />
      <line x1={780} y1={73} x2={880} y2={73} stroke="#3a4048" strokeWidth={1.5} />

      {/* wall clock, a small real-room detail between the board and the tutor */}
      <g transform="translate(345,32)">
        <circle cx={0} cy={0} r={9} fill="#101722" stroke="#8c919b" strokeWidth={1} />
        <line x1={0} y1={0} x2={0} y2={-5.5} stroke="#eee8da" strokeWidth={0.9} strokeLinecap="round" />
        <line x1={0} y1={0} x2={4} y2={2} stroke="#eee8da" strokeWidth={0.9} strokeLinecap="round" />
        <circle cx={0} cy={0} r={0.8} fill="#c99545" />
      </g>
    </>
  )
}

export default function TutorialClassScene() {
  const reduceMotion = useReducedMotion()

  return (
    <svg
      viewBox="0 0 900 220"
      className="h-44 w-full sm:h-52"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="An illustrated UNSW tutorial classroom: a tutor at a whiteboard explaining RSA and Shor's algorithm to a small class"
    >
      {/* dropped-ceiling fluorescent strips */}
      <g opacity={0.5}>
        {[120, 340, 560, 760].map((x) => (
          <motion.rect
            key={x}
            x={x}
            y={6}
            width={70}
            height={5}
            rx={2}
            fill="#cfe3ee"
            animate={reduceMotion ? { opacity: 0.85 } : { opacity: [0.55, 0.9, 0.55] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: x / 400 }}
          />
        ))}
      </g>
      <line x1={0} y1={20} x2={900} y2={20} stroke="#1b2430" strokeWidth={1} opacity={0.5} />

      {/* back wall, with a real accent-colour panel behind the students -- this room's own
          actual lime/olive feature wall, done in the site's success-green rather than an exact
          colour match, but bright enough now to actually read as a painted wall, not a shadow */}
      <rect x={0} y={20} width={900} height={150} fill="#0b1018" opacity={0.4} />
      <rect x={430} y={20} width={470} height={150} fill="#54c89a" opacity={0.16} />
      <BackWall />

      {/* whiteboard */}
      <rect x={40} y={40} width={280} height={110} rx={2} fill="#101722" stroke="#8c919b" strokeWidth={1.25} />
      <rect x={40} y={40} width={280} height={110} rx={2} fill="none" stroke="#1b2430" strokeWidth={0.5} />
      <text x={56} y={62} className="font-mono" fontSize={11} fill="#c99545">N = p &times; q</text>
      <text x={56} y={80} className="font-mono" fontSize={9} fill="#8c919b">ed &equiv; 1 (mod &phi;(N))</text>
      <motion.path
        d="M 56 92 Q 90 78, 124 92 Q 158 106, 192 92"
        fill="none"
        stroke="#e3b45e"
        strokeWidth={1.4}
        strokeLinecap="round"
        initial={reduceMotion ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.5 }}
      />
      <text x={56} y={128} className="font-mono" fontSize={8.5} fill="#54c89a">QFT: many paths in, one answer reinforced</text>
      {/* marker tray */}
      <rect x={40} y={150} width={280} height={4} fill="#1b2430" />
      <rect x={190} y={146} width={14} height={4} rx={1} fill="#c99545" />

      {/* a small lectern/front table beside the tutor -- the real room this scene is based on
          keeps one at the front of the room, next to the board rather than behind the tutor */}
      <g transform="translate(322,150)">
        <rect x={-16} y={-22} width={32} height={2} fill="#1b2430" stroke="#3a4048" strokeWidth={0.5} />
        <rect x={-13} y={-20} width={3} height={20} fill="#12181f" />
        <rect x={10} y={-20} width={3} height={20} fill="#12181f" />
      </g>

      {/* the tutor -- the most detailed figure in the scene, deliberately, the same way this
          site's Houdini gets the most detail of the cast on the homepage hero. The whole figure
          gets a slow weight-shift sway (not just the arm) -- a static torso with only a small
          arm wiggle read as "gesturing once" rather than an actual person mid-lecture, pacing
          slightly and shifting their stance the way anyone actually teaching does.
          Positioning (translate(352,150)) is kept on a separate, static outer <g> rather than
          combined with the animated one: Framer Motion takes over an element's entire `transform`
          attribute the moment it animates x/y/rotate on it, silently discarding any static
          `transform` prop on that same element -- caught live when this exact combination made
          the whole tutor render up near the SVG's origin instead of at (352,150). */}
      <g transform="translate(352,150)">
        <motion.g
          animate={reduceMotion ? undefined : { x: [0, -4, 0, 3, 0], rotate: [0, -1.2, 0, 0.8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '0px', originY: '34px' }}
        >
        <ContactShadowTutor />
        {/* shoes */}
        <ellipse cx={-9} cy={35.5} rx={4} ry={1.6} fill="#12181f" stroke="#3a4048" strokeWidth={0.4} />
        <ellipse cx={10} cy={35.5} rx={4} ry={1.6} fill="#12181f" stroke="#3a4048" strokeWidth={0.4} />
        {/* legs, slightly tapered (jeans, not sticks) */}
        <path d="M -8 -2 L -10 34 L -4 34 L -1 0 Z" fill="#1b2430" stroke="#204a66" strokeWidth={0.6} />
        <path d="M 8 -2 L 11 34 L 5 34 L 1 0 Z" fill="#1b2430" stroke="#204a66" strokeWidth={0.6} />
        {/* body -- patterned shirt with a collar (sparse dot print, a nod to the reference photo
            without copying a face), plus a lanyard, a real tutor's actual ID */}
        <path d="M -13 -2 L -11 -34 Q 0 -40, 11 -34 L 13 -2 Z" fill="#1b2430" stroke="#8c919b" strokeWidth={0.9} />
        <path d="M -4 -37 L 0 -32 L 4 -37" fill="none" stroke="#8c919b" strokeWidth={0.7} />
        {[[-6, -28], [2, -24], [-3, -16], [7, -18], [-9, -10], [4, -6]].map(([dx, dy]) => (
          <circle key={`${dx}-${dy}`} cx={dx} cy={dy} r={0.9} fill="#8c919b" opacity={0.5} />
        ))}
        <path d="M -1.5 -30 L -2.5 -14" stroke="#3a4048" strokeWidth={0.5} opacity={0.8} />
        <rect x={-4.5} y={-14} width={7} height={9} rx={0.8} fill="#101722" stroke="#c99545" strokeWidth={0.5} />
        {/* sleeve cuffs */}
        <circle cx={-11} cy={-27} r={2.2} fill="#1b2430" stroke="#8c919b" strokeWidth={0.6} />
        <circle cx={11} cy={-27} r={2.2} fill="#1b2430" stroke="#8c919b" strokeWidth={0.6} />
        {/* raised, pointing arm -- a real, visible teaching gesture: sweeping from the top of
            the board down to the bottom, as if walking the class through one line at a time,
            not just a small in-place wiggle that barely reads as motion at all. */}
        <motion.path
          d="M -11 -30 Q -26 -34, -34 -46"
          fill="none"
          stroke="#8c919b"
          strokeWidth={2.2}
          strokeLinecap="round"
          animate={
            reduceMotion
              ? undefined
              : {
                  d: [
                    'M -11 -30 Q -26 -34, -34 -46',
                    'M -11 -30 Q -25 -26, -32 -18',
                    'M -11 -30 Q -24 -22, -28 -10',
                    'M -11 -30 Q -25 -26, -32 -18',
                    'M -11 -30 Q -26 -34, -34 -46',
                  ],
                }
          }
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '-11px', originY: '-30px' }}
        />
        <motion.circle
          r={1.6}
          fill="#1b2430"
          stroke="#8c919b"
          strokeWidth={0.7}
          initial={{ cx: -34, cy: -46 }}
          animate={reduceMotion ? undefined : { cx: [-34, -32, -28, -32, -34], cy: [-46, -18, -10, -18, -46] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* other arm, relaxed, hand at the side */}
        <path d="M 11 -30 Q 20 -20, 18 -6" fill="none" stroke="#8c919b" strokeWidth={2.2} strokeLinecap="round" />
        <circle cx={18} cy={-5} r={1.6} fill="#1b2430" stroke="#8c919b" strokeWidth={0.7} />

        {/* head: voluminous long wavy hair drawn as one full mass behind the head, plus the
            original flowing side strands -- the earlier version was just two thin side locks,
            which read as flat/sparse rather than actually voluminous. */}
        <path
          d="M -12 -44 Q -15 -58, 0 -60 Q 15 -58, 12 -44 Q 13 -50, 10 -55 Q 0 -62, -10 -55 Q -13 -50, -12 -44 Z"
          fill="#1b2430"
          stroke="#c99545"
          strokeWidth={0.8}
          opacity={0.95}
        />
        <circle cx={0} cy={-46} r={10} fill="#1b2430" stroke="#e3b45e" strokeWidth={0.9} />
        <path
          d="M -10 -49 Q -16 -38, -12 -26 Q -15 -32, -13 -40 M -9 -54 Q -19 -49, -17 -34 Q -19 -42, -16 -50 M 9 -54 Q 19 -49, 18 -33 Q 20 -42, 17 -50 M 10 -49 Q 16 -37, 12 -25 Q 15 -32, 13 -40"
          fill="none"
          stroke="#c99545"
          strokeWidth={1.1}
          strokeLinecap="round"
          opacity={0.9}
        />
        <path d="M -10 -53 Q 0 -59, 10 -53 Q 11 -50, 9 -49 Q 0 -53, -9 -49 Q -11 -50, -10 -53 Z" fill="#1b2430" stroke="#c99545" strokeWidth={0.9} />
        {/* glasses -- round frames, a genuinely common tutor detail that reads as generic rather
            than identifying */}
        <circle cx={-3.4} cy={-47} r={2.3} fill="none" stroke="#8c919b" strokeWidth={0.55} />
        <circle cx={3.4} cy={-47} r={2.3} fill="none" stroke="#8c919b" strokeWidth={0.55} />
        <line x1={-1.1} y1={-47} x2={1.1} y2={-47} stroke="#8c919b" strokeWidth={0.55} />
        <circle cx={-3.4} cy={-47} r={1.1} fill="#eee8da" />
        <circle cx={3.4} cy={-47} r={1.1} fill="#eee8da" />
        <circle cx={-3.35} cy={-46.7} r={0.55} fill="#0b1018" />
        <circle cx={3.45} cy={-46.7} r={0.55} fill="#0b1018" />
        <path d="M -5.5 -50.5 L -2.5 -49.5" stroke="#c99545" strokeWidth={0.6} strokeLinecap="round" />
        <path d="M 5.5 -50.5 L 2.5 -49.5" stroke="#c99545" strokeWidth={0.6} strokeLinecap="round" />
        {/* mouth, open mid-sentence */}
        <motion.ellipse
          cx={0}
          cy={-42.5}
          rx={2.2}
          fill="#1b2430"
          stroke="#c99545"
          strokeWidth={0.5}
          initial={{ ry: 1.4 }}
          animate={reduceMotion ? undefined : { ry: [1.4, 2.2, 1, 1.6, 1.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        </motion.g>
      </g>

      {/* a small class, listening -- real faces on every one of them (unlike the homepage's
          deliberately-faceless "Bob", there's no invisibility conceit here to preserve), each with
          a different hairstyle and desk color so the row reads as six individuals, not one clone
          repeated six times. Spacing is kept clear of the window (starts at x=780) on the right. */}
      {/* one continuous table skirt spanning the whole row -- real tutorial rooms join their
          desks into a single long table, not six separate islands, so this ties the individual
          desks below together into that same one-table read (see the reference photo: one long
          bench of joined tables, not scattered single desks). */}
      <rect x={433} y={160} width={340} height={2} fill="#1b2430" stroke="#3a4048" strokeWidth={0.5} />

      <StudentPerson cx={460} cy={139} color="#204a66" hairStyle="short" />
      <StudentPerson cx={519} cy={138} color="#8065b8" hairStyle="bun" />
      <StudentPerson cx={578} cy={139} color="#c99545" hairStyle="side" />
      <StudentPerson cx={637} cy={138} color="#54c89a" hairStyle="bun" />
      <StudentPerson cx={696} cy={139} color="#e3b45e" hairStyle="short" />
      <StudentPerson cx={755} cy={138} color="#8c919b" hairStyle="side" />

      {/* floor, with converging tile lines for a sense of depth instead of one flat plane */}
      <line x1={0} y1={172} x2={900} y2={172} stroke="#204a66" strokeWidth={1} opacity={0.4} />
      <g opacity={0.18} stroke="#8c919b" strokeWidth={0.6}>
        {[60, 220, 380, 540, 700, 860].map((x) => (
          <line key={x} x1={x} y1={174} x2={450 + (x - 450) * 1.35} y2={218} />
        ))}
      </g>
    </svg>
  )
}

function ContactShadowTutor() {
  return <ellipse cx={0} cy={35} rx={13} ry={2.6} fill="#0b1018" opacity={0.45} />
}
