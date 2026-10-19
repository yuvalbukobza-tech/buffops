import { useEffect, useRef, useState } from 'react'
import { PullCancelled, fetchRedash, redashCancel, type PullControl } from './api'
import type { RedashRow } from './types'

export type Range = '7' | '17' | '30'
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export const REDASH_CANCELLED = 'cancelled'

// Redash results are cached per range for the browser session — the query is slow.
const cache = new Map<string, RedashRow[]>()
export function useRedash(range: Range) {
  const to = iso(new Date())
  const from = iso(new Date(Date.now() - (Number(range) - 1) * 86400000))
  const key = `${from}_${to}`
  const [rows, setRows] = useState<RedashRow[] | null>(() => cache.get(key) || readSession(key))
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const ctl = useRef<PullControl | null>(null)
  const load = (force = false) => {
    if (!force && (cache.get(key) || readSession(key))) { setRows(cache.get(key) || readSession(key)); return }
    if (ctl.current) ctl.current.cancelled = true // stop polling an older range (its Redash run keeps going and gets cached)
    const c: PullControl = { cancelled: false }
    ctl.current = c
    setState('loading'); setError(''); setProgress('')
    fetchRedash(from, to, c, (st, sec) => setProgress(`${st === 'running' ? 'Redash running' : 'In Redash queue'} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`))
      .then((r) => { cache.set(key, r); try { sessionStorage.setItem('bo2_redash_' + key, JSON.stringify(r)) } catch { /* full */ } setRows(r); setState('idle') })
      .catch((e: unknown) => { if (e instanceof PullCancelled) return; setError(e instanceof Error ? e.message : String(e)); setState('error') })
      .finally(() => { if (ctl.current === c) ctl.current = null })
  }
  /** Stops the query here and inside Redash. */
  const cancel = () => {
    const c = ctl.current
    if (!c) return
    c.cancelled = true; ctl.current = null
    setState('error'); setError(REDASH_CANCELLED); setProgress('')
    if (c.job) redashCancel(c.job).catch(() => { /* the run may already be over */ })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setRows(cache.get(key) || readSession(key)); load() }, [key])
  // Leaving the screen only stops polling; the Redash run finishes and is reused next time.
  useEffect(() => () => { if (ctl.current) ctl.current.cancelled = true }, [])
  return { rows, loading: state === 'loading', error, progress, from, to, days: Number(range), refresh: () => load(true), cancel }
}
function readSession(key: string): RedashRow[] | null {
  try { return JSON.parse(sessionStorage.getItem('bo2_redash_' + key) || 'null') } catch { return null }
}
