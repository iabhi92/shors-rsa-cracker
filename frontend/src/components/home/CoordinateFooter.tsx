/** A small navigation-chart-style annotation, not a legal footer -- coordinates plus one plain
 * sentence about the project's origin. Kept factual: no claim of institutional endorsement. */
export default function CoordinateFooter() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 font-mono text-xs text-ink-muted sm:flex-row sm:gap-3">
      <span>33.8688° S, 151.2093° E</span>
      <span className="hidden text-line sm:inline">·</span>
      <span>Developed as an educational research project in Sydney.</span>
    </div>
  )
}
