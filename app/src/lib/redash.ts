import { useEffect, useState } from 'react'
import { fetchRedash } from './api'
import type { RedashRow } from './types'

export type Range = '7' | '17' | '30'
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// Redash results are cached per range for the browser session — the query is slow (≈1 min).
const cache = new Map<string, RedashRow[]>()
export function useRedash(range: Range) {
  const to = iso(new Date())
  const from = iso(new Date(Date.now() - (Number(range) - 1) * 86400000))
  const key = `${from}_${to}`
  const [rows, setRows] = useState<RedashRow[] | null>(() => cache.get(key) || readSession(key))
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const load = (force = false) => {
    if (!force && (cache.get(key) || readSession(key))) { setRows(cache.get(key) || readSession(key)); return }
    setState('loading'); setError('')
    fetchRedash(from, to)
      .then((r) => { cache.set(key, r); try { sessionStorage.setItem('bo2_redash_' + key, JSON.stringify(r)) } catch { /* full */ } setRows(r); setState('idle') })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setState('error') })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setRows(cache.get(key) || readSession(key)); load() }, [key])
  return { rows, loading: state === 'loading', error, from, to, days: Number(range), refresh: () => load(true) }
}
function readSession(key: string): RedashRow[] | null {
  try { return JSON.parse(sessionStorage.getItem('bo2_redash_' + key) || 'null') } catch { return null }
}

