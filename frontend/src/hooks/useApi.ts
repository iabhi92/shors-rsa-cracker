import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError, getBackendWakingSnapshot, subscribeBackendWaking } from '../api/client'

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

/** Fetches on mount (and whenever `deps` changes). For GET-style, load-on-render data. */
export function useFetchOnMount<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Request failed' })
      })
    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `deps` is an intentionally
    // caller-controlled dependency array (this is a generic "fetch on mount / on deps change"
    // hook), not a fixed list this function's own body could statically declare.
  }, deps)

  return state
}

/** For button-triggered POST actions: exposes `run(...)` plus the current state.
 *
 * `run` is memoized with an empty dependency array so it has a stable identity across
 * renders, but `action` is a fresh closure every render (it typically closes over page-level
 * state like a form field). A previous version called `action` directly inside the
 * `useCallback` body with `[]` as deps, which made `run` permanently call the *first*
 * render's `action` closure -- e.g. the RSA Lab page's keygen button kept POSTing the initial
 * `bits` value forever, ignoring later input changes, caught by
 * e2e/smoke.spec.ts's invalid-input test unexpectedly succeeding when it should have 422'd.
 * Routing every call through a ref that's updated on every render fixes this: `run` stays
 * referentially stable, but always invokes whichever `action` was passed on the most recent
 * render.
 *
 * On failure, `run` resolves (doesn't reject) after recording the error into `state` -- every
 * one of this hook's ~15 call sites across the site fires it from a bare `onClick={() =>
 * ...run(...)}` with no `await`/`.catch()`, since `state.status === 'error'` is already the
 * intended way to observe a failure. An earlier version rethrew here, which meant every single
 * failed request (any 4xx, any network error) surfaced as an unhandled promise rejection logged
 * straight to the browser console -- caught live while regenerating an RSA keypair mid-attack on
 * the Malleability Lab. */
export function useAction<Args extends unknown[], T>(action: (...args: Args) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' })
  const actionRef = useRef(action)
  actionRef.current = action

  const run = useCallback(async (...args: Args) => {
    setState({ status: 'loading' })
    try {
      const data = await actionRef.current(...args)
      setState({ status: 'success', data })
      return data
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Request failed'
      setState({ status: 'error', message })
      return undefined
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, run, reset }
}

/** True while any in-flight request is in `client.ts`'s cold-start retry loop, i.e. the Render
 * free-tier backend looks like it's waking up. Backed by an external store, not component
 * state, since the thing that's changing lives in the API client and can be triggered by any
 * page's request -- a single subscriber here (see home/HarbourBridgeIncident.tsx) reflects it
 * site-wide. */
export function useBackendWaking(): boolean {
  return useSyncExternalStore(subscribeBackendWaking, getBackendWakingSnapshot, () => false)
}

export type BridgeIncidentPhase = 'havoc' | 'quake' | 'connected'

const QUAKE_MS = 1300

/** Drives the homepage hero's "self-driving car wrecks the bridge, then the crack it falls
 * through heals over once the backend reconnects" easter egg.
 *
 * Defaults to 'connected', not some empty/neutral state: the previous version defaulted to a
 * phase that rendered nothing at all until a wake-up had actually been observed this session,
 * which meant a visitor who arrived while the backend was already warm (the common case) would
 * never see the reconnect scene -- it was gated behind an edge (down -> up), not a state (up).
 * Optimistically assuming "connected" and only dropping to 'havoc' once client.ts actually
 * starts retrying fixes that: the reconnect scene is the resting state of the illustration
 * whenever the backend is fine, exactly matching the "should stay up as long as the backend is
 * live" request, and 'havoc' becomes the temporary interruption instead of the reverse. */
export function useBridgeIncidentPhase(): BridgeIncidentPhase {
  const waking = useBackendWaking()
  const [phase, setPhase] = useState<BridgeIncidentPhase>('connected')
  const wasWaking = useRef(false)

  useEffect(() => {
    if (waking) {
      wasWaking.current = true
      setPhase('havoc')
      return
    }
    if (!wasWaking.current) return
    wasWaking.current = false
    setPhase('quake')
    const toConnected = setTimeout(() => setPhase('connected'), QUAKE_MS)
    return () => clearTimeout(toConnected)
  }, [waking])

  return phase
}
