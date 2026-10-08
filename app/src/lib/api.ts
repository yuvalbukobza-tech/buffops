// Backend access (Google Apps Script). Same endpoint and key as BuffOps v1.
import { STATE_KEYS, type AppState, type RedashRow } from './types'

const LIVE_URL = 'https://script.google.com/macros/s/AKfycbyDJ6nUT5l3Y7R95oi--vp9QM-VZ1urwB64-pMbCPdgyVArgDzQTOiMFvz-ZpWDXADy/exec'
export const API_URL: string = import.meta.env.VITE_API_URL || LIVE_URL
const APP_KEY = 'bk_01b77045cc321117d6d783a4ce81c3d7'

/**
 * Writes are OFF unless the build sets VITE_WRITE=1.
 * While v1 is still in use, v2 must never save: two apps saving the whole state would overwrite each other.
 */
export const WRITE_ENABLED = import.meta.env.VITE_WRITE === '1'

export function validateState(d: unknown): string {
  if (!d || typeof d !== 'object') return 'not an object'
  const o = d as Record<string, unknown>
  if (o.error) return String(o.error)
  for (const k of STATE_KEYS) if (o[k] === undefined || o[k] === null) return `missing "${k}"`
  for (const k of ['products', 'orders', 'transactions', 'appUsers', 'raffles', 'budgetExtras'] as const) if (!Array.isArray(o[k])) return `"${k}" is not a list`
  if (typeof o.allocs !== 'object' || Array.isArray(o.allocs)) return '"allocs" is not an object'
  return ''
}

async function getJson(url: string, tries = 3): Promise<unknown> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      const text = await r.text()
      if (text.trimStart().startsWith('{')) return JSON.parse(text)
      last = new Error('Unexpected response from Google')
    } catch (e) {
      last = e
    }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)))
  }
  throw last
}

export async function loadState(): Promise<AppState> {
  const data = await getJson(`${API_URL}?key=${APP_KEY}`)
  const bad = validateState(data)
  if (bad) throw new Error(`Invalid data from server: ${bad}`)
  return data as AppState
}

export function counts(s: AppState) {
  return {
    products: s.products.length,
    allocs: Object.values(s.allocs).reduce((a, r) => a + (r?.length || 0), 0),
    transactions: s.transactions.length,
    raffles: s.raffles.length,
  }
}

/** Same rule as v1 and the server: emptying (or halving) a collection of 3+ items is treated as a wipe. */
export function looksLikeWipe(was: ReturnType<typeof counts>, cur: ReturnType<typeof counts>): boolean {
  return (Object.keys(was) as (keyof typeof was)[]).some((k) => was[k] >= 3 && (cur[k] === 0 || cur[k] < was[k] / 2))
}

export async function saveState(s: AppState): Promise<void> {
  if (!WRITE_ENABLED) throw new Error('Saving is disabled in preview mode')
  const body: Record<string, unknown> = {}
  for (const k of STATE_KEYS) body[k] = s[k]
  await fetch(`${API_URL}?key=${APP_KEY}`, { method: 'POST', mode: 'no-cors', body: JSON.stringify(body) })
}

export async function fetchRedash(from: string, to: string): Promise<RedashRow[]> {
  const d = (await getJson(`${API_URL}?action=redash&from=${from}&to=${to}&key=${APP_KEY}`, 2)) as { rows?: RedashRow[]; error?: string }
  if (d.error) throw new Error(d.error)
  return d.rows || []
}

/** Sends a plain-text email through the backend (Gmail of the script owner). Disabled in preview mode. */
export async function sendEmail(to: string[], subject: string, body: string, sender?: { name: string; email?: string }): Promise<void> {
  if (!WRITE_ENABLED) throw new Error('Emails are not sent in preview mode')
  const p = new URLSearchParams({ action: 'sendEmail', key: APP_KEY, to: to.join(','), subject, body })
  if (sender?.name) p.set('senderName', sender.name)
  if (sender?.email) p.set('senderEmail', sender.email)
  const d = (await getJson(`${API_URL}?${p.toString()}`, 1)) as { ok?: boolean; error?: string }
  if (!d.ok) throw new Error(d.error || 'Email failed')
}

// ── Amazon fulfillment (rows live in the sheet's "Fulfillment" tab, not in the app state) ──
export interface FulfillRow {
  token: string; key: string; userId: string; name: string; email: string; product: string; purchaseDate: string; status: string
  fullName?: string; address?: string; apt?: string; city?: string; state?: string; zip?: string; country?: string; phone?: string
  orderNumber?: string; createdAt?: string; emailedAt?: string; detailsAt?: string; orderedAt?: string; doneAt?: string; notes?: string; amount?: string | number
}

function qs(params: Record<string, string | undefined>) {
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`).join('&')
}

/** Read-only: the rows already in the sheet. */
export async function fulfillList(): Promise<FulfillRow[]> {
  const d = (await getJson(`${API_URL}?action=fulfillList&key=${APP_KEY}`, 2)) as { rows?: FulfillRow[]; error?: string }
  if (d.error) throw new Error(d.error)
  return d.rows || []
}

/** Writes: pulls new owed customers from Redash into the sheet. Disabled in preview mode. */
export async function fulfillPull(): Promise<FulfillRow[]> {
  if (!WRITE_ENABLED) throw new Error('Pulling from Redash writes to the sheet — disabled in preview mode')
  const d = (await getJson(`${API_URL}?action=fulfillPull&key=${APP_KEY}`, 1)) as { rows?: FulfillRow[]; error?: string }
  if (d.error) throw new Error(d.error)
  return d.rows || []
}

/** Writes / emails customers: fulfillEmail1, fulfillEmail2, fulfillSetStatus. Disabled in preview mode. */
export async function fulfillAction(action: 'fulfillEmail1' | 'fulfillEmail2' | 'fulfillSetStatus', params: Record<string, string | undefined>): Promise<void> {
  if (!WRITE_ENABLED) throw new Error('Emails to customers and status changes are disabled in preview mode')
  const d = (await getJson(`${API_URL}?action=${action}&${qs(params)}&key=${APP_KEY}`, 1)) as { error?: string }
  if (d && d.error) throw new Error(d.error)
}

export const fulfillFormLink = (token: string) => `${API_URL}?action=fulfillForm&token=${encodeURIComponent(token)}`

export interface BackupEntry { row: number; at: string; counts: string }

/** Read-only: snapshots the server keeps (every save + one per day). */
export async function listBackups(): Promise<{ Backups: BackupEntry[]; DailyBackups: BackupEntry[] }> {
  const d = (await getJson(`${API_URL}?action=backups&key=${APP_KEY}`, 2)) as { Backups?: BackupEntry[]; DailyBackups?: BackupEntry[]; error?: string }
  if (d.error) throw new Error(d.error)
  return { Backups: d.Backups || [], DailyBackups: d.DailyBackups || [] }
}
