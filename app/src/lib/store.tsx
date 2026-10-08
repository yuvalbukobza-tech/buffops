import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { WRITE_ENABLED, counts, loadState, looksLikeWipe, saveState } from './api'
import type { AppState } from './types'

type Status = 'loading' | 'ready' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'preview' | 'blocked' | 'error'

interface Store {
  state: AppState | null
  status: Status
  error: string
  saveStatus: SaveStatus
  dirty: boolean
  readOnly: boolean
  reload: () => void
  update: (fn: (s: AppState) => AppState) => void
  discard: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dirty, setDirty] = useState(false)
  const loaded = useRef<AppState | null>(null)
  const baseline = useRef<ReturnType<typeof counts> | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const reload = useCallback(() => {
    setStatus('loading')
    setError('')
    loadState()
      .then((s) => {
        loaded.current = s
        baseline.current = counts(s)
        setState(s)
        setDirty(false)
        setSaveStatus(WRITE_ENABLED ? 'saved' : 'preview')
        setStatus('ready')
      })
      .catch((e: unknown) => {
        // Never fall back to empty data: show the error and keep everything unsaved.
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
  }, [])

  useEffect(() => { reload() }, [reload])

  const current = useRef<AppState | null>(null)
  current.current = state

  const update = useCallback((fn: (s: AppState) => AppState) => {
    const prev = current.current
    if (!prev) return
    const next = fn(prev)
    current.current = next
    setState(next)
    setDirty(true)
    if (!WRITE_ENABLED) { setSaveStatus('preview'); return }
    if (baseline.current && looksLikeWipe(baseline.current, counts(next))) { setSaveStatus('blocked'); return }
    setSaveStatus('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveState(next)
        .then(() => { baseline.current = counts(next); setSaveStatus('saved') })
        .catch(() => setSaveStatus('error'))
    }, 1200)
  }, [])

  const discard = useCallback(() => {
    if (loaded.current) { setState(loaded.current); setDirty(false) }
  }, [])

  return (
    <Ctx.Provider value={{ state, status, error, saveStatus, dirty, readOnly: !WRITE_ENABLED, reload, update, discard }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

/** For screens: the loaded state (only rendered once status === 'ready'). */
export function useData(): AppState {
  const { state } = useStore()
  if (!state) throw new Error('data not loaded')
  return state
}
