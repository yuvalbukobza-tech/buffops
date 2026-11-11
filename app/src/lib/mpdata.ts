// Marketplace data hooks for the Utilization screen (backend v8 ?action=mpq).
// Same pattern as useRedash: cached for the browser session, progress text, cancel stops the run in Redash too.
import { useEffect, useRef, useState } from 'react'
import { BackendOutdated, PullCancelled, backendVersion, fetchMpDaily, fetchMpStock, redashCancel, type PullControl } from './api'
import type { MpDailyRow, MpStockRow } from './types'

export const MP_CANCELLED = 'cancelled'
export const MP_OUTDATED = 'outdated'

type Fetcher<R> = (ctl: PullControl, onProgress: (state: string, seconds: number) => void) => Promise<R[]>

const cache = new Map<string, unknown[]>()
function readSession<R>(key: string): R[] | null {
  if (cache.has(key)) return cache.get(key) as R[]
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}

function useMpQuery<R>(key: string, fetcher: Fetcher<R>, enabled = true) {
  const [rows, setRows] = useState<R[] | null>(() => readSession<R>(key))
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const ctl = useRef<PullControl | null>(null)
  const load = (force = false) => {
    const hit = readSession<R>(key)
    if (!force && hit) { setRows(hit); return }
    if (ctl.current) ctl.current.cancelled = true
    const c: PullControl = { cancelled: false }
    ctl.current = c
    setState('loading'); setError(''); setProgress('')
    fetcher(c, (st, sec) => setProgress(`${st === 'running' ? 'Redash running' : 'In Redash queue'} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`))
      .then((r) => {
        cache.set(key, r)
        try { sessionStorage.setItem(key, JSON.stringify(r)) } catch { /* storage full — memory cache still works */ }
        setRows(r); setState('idle')
      })
      .catch((e: unknown) => {
        if (e instanceof PullCancelled) return
        setError(e instanceof BackendOutdated ? MP_OUTDATED : e instanceof Error ? e.message : String(e)); setState('error')
      })
      .finally(() => { if (ctl.current === c) ctl.current = null })
  }
  const cancel = () => {
    const c = ctl.current
    if (!c) return
    c.cancelled = true; ctl.current = null
    setState('error'); setError(MP_CANCELLED); setProgress('')
    if (c.job) redashCancel(c.job).catch(() => { /* already over */ })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setRows(readSession<R>(key)); if (enabled) load() }, [key, enabled])
  useEffect(() => () => { if (ctl.current) ctl.current.cancelled = true }, [])
  return { rows, loading: state === 'loading', error, progress, refresh: () => load(true), cancel }
}

/** Gift cards bought per day per product for [from, to) — to is exclusive. */
export const useMpDaily = (from: string, to: string, enabled = true) =>
  useMpQuery<MpDailyRow>(`bo2_mp_daily_${from}_${to}`, (c, p) => fetchMpDaily(from, to, c, p), enabled)

/** Live stock + 14/30-day demand per active marketplace item. */
export const useMpStock = (enabled = true) => useMpQuery<MpStockRow>('bo2_mp_stock', (c, p) => fetchMpStock(c, p), enabled)

/** Backend version (0 = unknown / older than v8). Checked once per page load. */
let versionPromise: Promise<number> | null = null
export function useBackendVersion(): number | null {
  const [v, setV] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    versionPromise ||= backendVersion().catch(() => { versionPromise = null; return 0 })
    versionPromise.then((n) => { if (live) setV(n) })
    return () => { live = false }
  }, [])
  return v
}
