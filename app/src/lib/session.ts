import { createContext, useContext } from 'react'
import type { Session } from './auth'

export const SessionCtx = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(SessionCtx)
  if (!s) throw new Error('useSession outside SessionCtx')
  return s
}
