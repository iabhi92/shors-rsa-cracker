import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'

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
 * render. */
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
      throw err
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, run, reset }
}
