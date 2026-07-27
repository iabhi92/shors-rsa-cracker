# Frontend

React + TypeScript + Vite + Tailwind CSS. No business logic lives here -- every page is a
thin view over the FastAPI backend's real endpoints (see `../backend/README.md` and
`../WEBSITE_IMPLEMENTATION_PLAN.md`); cryptographic and quantum computation happens entirely
in the Python backend.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api/* to http://localhost:8000
```

The backend (`../backend/`) must be running separately for the app to actually work -- the
dev server only proxies API requests, it doesn't start the backend for you.

## Structure

```
src/
  api/client.ts       fetch wrapper + typed ApiError
  types/api.ts         TypeScript interfaces mirroring backend/app/schemas/*.py (kept in sync by hand)
  hooks/useApi.ts       useFetchOnMount (GET-on-render) / useAction (button-triggered POST)
  components/           shared UI (Layout/nav, Card/Button/Banner primitives, AmplitudeView chart)
  pages/                one file per route, wired to App.tsx
```

## Commands

```bash
npm run build       # tsc -b && vite build -- type-checks then produces dist/
npx tsc -b --noEmit  # type-check only
npm run lint         # oxlint
npm run preview       # serve the production build locally
```

## End-to-end tests (Playwright)

```bash
npx playwright install chromium --with-deps   # once
npx playwright test                             # starts the dev server itself if one isn't already running
```

Covers: home page loads, RSA keygen/encrypt/decrypt round trip, a classical attack run, a
Shor's-algorithm run, charts rendering, invalid input producing a readable error (not a
crash), mobile navigation, and a documentation page rendering real Markdown from the repo.
The backend must be running on `:8000` for these to pass (same requirement as `npm run dev`).

Note: these tests caught a real bug during development -- `useAction`'s `run` callback was
memoized with a stale closure, so action buttons across several pages kept submitting a
form's *initial* value regardless of later edits. Fixed in `src/hooks/useApi.ts`; see that
file's doc comment for the full story.

## Design notes

Dark theme via Tailwind utility classes (no separate design-token file --
`src/components/ui.tsx` is the shared primitive set). Math rendered with KaTeX
(`react-katex`); Markdown (the Documentation/Security/Development Journey pages) rendered
with `react-markdown` + `remark-gfm` + `rehype-highlight`, styled via
`@tailwindcss/typography`'s `prose` classes. Charts via Recharts. Heavier pages are
route-level code-split with `React.lazy` (see `src/App.tsx`) to keep the initial bundle small.
