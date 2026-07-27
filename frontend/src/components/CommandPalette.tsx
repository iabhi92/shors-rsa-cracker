import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { CornerDownLeft, Swords } from 'lucide-react'

export interface CommandItem {
  to: string
  label: string
  keywords?: string
  icon: LucideIcon
  section: string
}

/** A real fuzzy-navigable command palette (Ctrl/Cmd+K or `/`, like a real terminal launcher or
 * a code editor's "go to file") -- the primary way to move around the site. Not a decorative
 * search box: it's keyboard-driven end to end (type, arrow keys, enter) and is the reason the
 * page shell doesn't need a permanently-docked sidebar eating a quarter of the viewport. */
export default function CommandPalette({ items, open, onClose }: { items: CommandItem[]; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q ? items.filter((i) => `${i.label} ${i.keywords ?? ''} ${i.section}`.toLowerCase().includes(q)) : items

    // Typing a bare composite number is itself a command: jump straight into the classical
    // attack lab with that number already running, instead of making the user navigate there
    // and retype it.
    const asInt = Number(query.trim())
    if (query.trim() !== '' && Number.isInteger(asInt) && asInt >= 4 && asInt <= 10_000_000) {
      const quickAction: CommandItem = {
        to: `/classical-attacks?n=${asInt}`,
        label: `Factor n = ${asInt}`,
        icon: Swords,
        section: 'Quick action',
      }
      return [quickAction, ...base]
    }
    return base
  }, [items, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      const t = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function go(item: CommandItem) {
    navigate(item.to)
    onClose()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) go(filtered[activeIndex])
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 px-4 pt-[12vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-sm border border-line bg-black font-mono shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="text-gold">{'>'}</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="go to... (try 'shor', 'rsa', 'dashboard')"
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                aria-label="Search pages"
              />
              <kbd className="rounded-sm border border-line px-1.5 py-0.5 text-[0.65rem] text-ink-muted">esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {filtered.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-muted">no matches</p>}
              {filtered.map((item, i) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => go(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                    i === activeIndex ? 'bg-gold/10 text-gold-warm' : 'text-ink-muted'
                  }`}
                >
                  <item.icon className={`h-4 w-4 shrink-0 ${i === activeIndex ? 'text-gold' : 'text-ink-muted'}`} strokeWidth={1.75} />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-ink-muted">{item.section}</span>
                  {i === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-gold" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
