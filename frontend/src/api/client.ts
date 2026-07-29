// Same-origin '/api' works for local dev (Vite's proxy) and the Docker/nginx setup, where the
// frontend and backend share an origin. GitHub Pages only serves static files, so the frontend
// there needs the backend's actual deployed URL, injected at build time.
export const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

// Free-tier hosting (Render) spins the backend down after ~15 min idle. The instance's own
// edge proxy answers immediately with a 502/503/504 while it boots back up, rather than the
// request just hanging -- so every single call can fail outright for the first 30-50s after a
// gap, not just one. Retrying those specific transient statuses (and raw network failures,
// e.g. a request that lands mid-restart) with backoff turns that into "briefly slower" instead
// of "the whole site is broken." Real application errors (400/404/422/etc.) are never retried
// -- those are correct, meaningful responses, not infrastructure hiccups.
const WAKE_RETRY_DELAYS_MS = [1500, 3000, 6000, 10000, 15000, 15000]
const RETRYABLE_STATUSES = new Set([502, 503, 504])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A tiny external store (subscribe/getSnapshot, the shape useSyncExternalStore wants) tracking
// whether *any* in-flight request is currently in its retry loop -- i.e. the backend looks like
// it's cold-starting. This has nothing to do with rendering; it exists so the UI layer (the
// harbour bridge "kaiju car" incident, see home/HarbourBridgeIncident.tsx) can show something
// honest and specific during the real 30-50s Render free-tier wake-up instead of a generic
// spinner, without every call site having to know about retry internals. A ref-counted
// `activeRetries` (rather than a bool) so two concurrent requests both retrying don't have the
// first one's success hide the indicator while the second is still waking things up.
let activeRetries = 0
const wakingListeners = new Set<() => void>()

function setWaking(waking: boolean) {
  const next = waking ? activeRetries + 1 : Math.max(0, activeRetries - 1)
  if (next === activeRetries) return
  const wasWaking = activeRetries > 0
  activeRetries = next
  if (wasWaking !== activeRetries > 0) wakingListeners.forEach((fn) => fn())
}

export function subscribeBackendWaking(fn: () => void): () => void {
  wakingListeners.add(fn)
  return () => wakingListeners.delete(fn)
}

export function getBackendWakingSnapshot(): boolean {
  return activeRetries > 0
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let lastError: unknown
  let retrying = false
  try {
    for (let attempt = 0; attempt <= WAKE_RETRY_DELAYS_MS.length; attempt++) {
      let res: Response
      try {
        res = await fetch(`${BASE}${path}`, {
          headers: { 'Content-Type': 'application/json' },
          ...options,
        })
      } catch (err) {
        // A thrown fetch (network error, CORS preflight failure, DNS, connection refused) is
        // exactly as likely to be "backend still waking up" as a 502 is -- treat it the same way.
        lastError = err
        if (attempt < WAKE_RETRY_DELAYS_MS.length) {
          if (!retrying) {
            retrying = true
            setWaking(true)
          }
          await sleep(WAKE_RETRY_DELAYS_MS[attempt])
          continue
        }
        throw new ApiError(0, 'Could not reach the backend after several attempts.')
      }
      if (!res.ok) {
        if (RETRYABLE_STATUSES.has(res.status) && attempt < WAKE_RETRY_DELAYS_MS.length) {
          lastError = new ApiError(res.status, res.statusText)
          if (!retrying) {
            retrying = true
            setWaking(true)
          }
          await sleep(WAKE_RETRY_DELAYS_MS[attempt])
          continue
        }
        let detail = res.statusText
        try {
          const body = await res.json()
          detail =
            typeof body.detail === 'string'
              ? body.detail
              : Array.isArray(body.detail)
                ? body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
                : JSON.stringify(body.detail)
        } catch {
          // response wasn't JSON; fall back to statusText
        }
        throw new ApiError(res.status, detail)
      }
      return res.json() as Promise<T>
    }
    throw lastError instanceof Error ? lastError : new ApiError(0, 'Could not reach the backend.')
  } finally {
    if (retrying) setWaking(false)
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
}
