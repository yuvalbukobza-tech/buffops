import type { AppUser } from './types'

// Admin is decided by username; passwords live only in the data (appUsers), never in this code.
const ADMINS = ['yuvalbukobza']
const KEY = 'bo2_session'

export interface Session { username: string; display: string; isAdmin: boolean }

export function login(username: string, password: string, users: AppUser[]): Session | null {
  const u = users.find((x) => x.username && x.password && x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password)
  if (!u) return null
  const s: Session = { username: u.username, display: `${u.firstName} ${u.lastName}`.trim() || u.username, isAdmin: ADMINS.includes(u.username) }
  try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: session lasts until reload */ }
  return s
}

export function restoreSession(users: AppUser[]): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Session | null
    // Only keep a session whose user still exists.
    if (s && users.some((u) => u.username === s.username)) return { ...s, isAdmin: ADMINS.includes(s.username) }
  } catch { /* ignore */ }
  return null
}

export function logout() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}
