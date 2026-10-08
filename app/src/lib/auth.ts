import type { AppUser } from './types'

// Admin is decided by username; passwords live only in the data (appUsers), never in this code.
const ADMINS = ['yuvalbukobza']
const KEY = 'bo2_session'

export type Access = 'Admin' | 'Editor' | 'Viewer'
export interface Session { username: string; display: string; isAdmin: boolean; access: Access }

export function accessOf(u: Pick<AppUser, 'username' | 'access'>): Access {
  if (ADMINS.includes(u.username)) return 'Admin'
  return u.access || 'Editor'
}

export function login(username: string, password: string, users: AppUser[]): Session | null {
  const u = users.find((x) => x.username && x.password && x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password)
  if (!u) return null
  const access = accessOf(u)
  const s: Session = { username: u.username, display: `${u.firstName} ${u.lastName}`.trim() || u.username, isAdmin: access === 'Admin', access }
  try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: session lasts until reload */ }
  return s
}

export function restoreSession(users: AppUser[]): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Session | null
    // Only keep a session whose user still exists.
    const u = s && users.find((x) => x.username === s.username)
    // Access is re-read from the data each time, so a change in Admin applies on next load.
    if (s && u) { const access = accessOf(u); return { ...s, isAdmin: access === 'Admin', access } }
  } catch { /* ignore */ }
  return null
}

export function logout() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}
