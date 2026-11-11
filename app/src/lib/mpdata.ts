// Marketplace data hooks for the Utilization screen (backend v8 ?action=mpq).
// Same pattern as useRedash: cached for the browser session, progress text, cancel stops the run in Redash too.
import { useEffect, useRef, useState } from 'react'
import { BackendOutdated, PullCancelled, backendVersion, fetchMpDaily, fetchMpStock, fetchRaffles, redashCancel, type PullControl } from './api'
import type { MpDailyRow, MpStockRow, RaffleRow } from './types'

export const MP_CANCELLED = 'cancelled'
export const MP_OUTDATED = 'outdated'

type Fetcher<R> = (ctl: PullControl, onProgress: (state: string, seconds: number) => void) => Promise<R[]>

const cache = new Map<string, unknown[]>()
function readSession<R>(key: string): R[] | null {
  if (cache.has(key)) return cache.get(key) as R[]
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}

/**
 * `derive` can answer from data already loaded (e.g. a shorter range cut from a longer one) — no query then.
 * With `keepStale`, the previous key's rows stay up while a new key loads (`stale` is true until it lands).
 */
function useMpQuery<R>(key: string, fetcher: Fetcher<R>, enabled = true, derive?: () => R[] | null, keepStale = false) {
  const lookup = (): R[] | null => {
    const hit = readSession<R>(key)
    if (hit) return hit
    const d = derive?.() ?? null
    if (d) cache.set(key, d)
    return d
  }
  const [rows, setRows] = useState<R[] | null>(lookup)
  const [rowsKey, setRowsKey] = useState(key)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const ctl = useRef<PullControl | null>(null)
  const load = (force = false) => {
    const hit = force ? null : lookup()
    if (hit) { setRows(hit); setRowsKey(key); setState('idle'); setError(''); return }
    if (ctl.current) ctl.current.cancelled = true
    const c: PullControl = { cancelled: false }
    ctl.current = c
    setState('loading'); setError(''); setProgress('')
    fetcher(c, (st, sec) => setProgress(`${st === 'running' ? 'Redash running' : 'In Redash queue'} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`))
      .then((r) => {
        cache.set(key, r)
        store(key, r)
        setRows(r); setRowsKey(key); setState('idle')
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
  useEffect(() => {
    const hit = lookup()
    if (hit || !keepStale) { setRows(hit); setRowsKey(key) }
    if (enabled) load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])
  useEffect(() => () => { if (ctl.current) ctl.current.cancelled = true }, [])
  return { rows, stale: rows !== null && rowsKey !== key, loading: state === 'loading', error, progress, refresh: () => load(true), cancel }
}

// ── Purchases per day: ranges are keyed "bo2_mp_daily2_<from>_<to>" ([from, to), to exclusive) ──
const DAILY = 'bo2_mp_daily2_'
const rangeOf = (key: string) => key.slice(DAILY.length).split('_') as [string, string]
function dailyKeys(): string[] {
  const keys = new Set([...cache.keys()].filter((k) => k.startsWith(DAILY)))
  try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(DAILY)) keys.add(k) } } catch { /* no storage */ }
  return [...keys]
}
/** Rows for [from, to) cut from an already-loaded range that covers it, or null. */
function dailyFromLoaded(from: string, to: string): MpDailyRow[] | null {
  for (const k of dailyKeys()) {
    const [f, t] = rangeOf(k)
    if (f > from || t < to) continue
    const rows = readSession<MpDailyRow>(k)
    if (rows) return rows.filter((r) => { const d = String(r.day).slice(0, 10); return d >= from && d < to })
  }
  return null
}
/** Session storage holds ~5 MB: a longer range replaces the ranges it covers. */
function store(key: string, rows: unknown[]) {
  try {
    if (key.startsWith(DAILY)) {
      const [f, t] = rangeOf(key)
      for (const k of dailyKeys()) { const [kf, kt] = rangeOf(k); if (k !== key && kf >= f && kt <= t) sessionStorage.removeItem(k) }
    }
    sessionStorage.setItem(key, JSON.stringify(rows))
  } catch { /* storage full — the memory cache still works */ }
}

/** Gift cards bought per day per product for [from, to) — to is exclusive. Answers from a longer loaded range when it can. */
export const useMpDaily = (from: string, to: string, enabled = true, keepStale = false) =>
  useMpQuery<MpDailyRow>(`${DAILY}${from}_${to}`, (c, p) => fetchMpDaily(from, to, c, p), enabled, () => dailyFromLoaded(from, to), keepStale)

/** Live stock + 14/30-day demand per active marketplace item. */
export const useMpStock = (enabled = true) => useMpQuery<MpStockRow>('bo2_mp_stock', (c, p) => fetchMpStock(c, p), enabled)

/** Raffles of the last 120 days (backend v9). */
export const useRaffles = (enabled = true) => useMpQuery<RaffleRow>('bo2_mp_raffles', (c, p) => fetchRaffles(c, p), enabled)

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
