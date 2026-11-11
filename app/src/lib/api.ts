// Backend access (Google Apps Script). Same endpoint and key as BuffOps v1.
import { OPTIONAL_KEYS, STATE_KEYS, type AppState, type MpDailyRow, type MpStockRow, type Receipt, type RedashRow } from './types'

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
  return normalizeState(data as Record<string, unknown>)
}

/** Optional collections that older data doesn't have become empty lists. */
export function normalizeState(d: Record<string, unknown>): AppState {
  const s = { ...d } as Record<string, unknown>
  for (const k of OPTIONAL_KEYS) if (!Array.isArray(s[k])) s[k] = []
  return s as unknown as AppState
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
  // A backend older than v8 drops these silently — the Utilization screen locks budget editing until v8 is live.
  for (const k of OPTIONAL_KEYS) body[k] = s[k]
  await fetch(`${API_URL}?key=${APP_KEY}`, { method: 'POST', mode: 'no-cors', body: JSON.stringify(body) })
}

/**
 * Sales query (Redash 2672). The backend starts it and returns at once; we poll the job
 * (onProgress gets 'queued' | 'running' and seconds waited). Setting ctl.cancelled stops polling;
 * redashCancel(ctl.job) also stops the run inside Redash.
 */
export async function fetchRedash(from: string, to: string, ctl: PullControl = { cancelled: false }, onProgress?: (state: string, seconds: number) => void): Promise<RedashRow[]> {
  const d = await runRedash<RedashRow>(`${API_URL}?action=redash&async=1&from=${from}&to=${to}&key=${APP_KEY}`, ctl, onProgress, 4000)
  return d.rows || []
}

type JobReply<R> = { rows?: R[]; error?: string; pending?: boolean; job?: string; state?: string }

/** Starts a backend Redash run and polls ?action=redashJob until it has rows (or fails / is cancelled). */
async function runRedash<R>(startUrl: string, ctl: PullControl, onProgress: ((state: string, seconds: number) => void) | undefined, everyMs: number): Promise<JobReply<R>> {
  const t0 = Date.now()
  let d = (await getJson(startUrl, 2)) as JobReply<R>
  while (d.pending && d.job) {
    ctl.job = d.job
    if (ctl.cancelled) throw new PullCancelled()
    const waited = Math.round((Date.now() - t0) / 1000)
    onProgress?.(d.state || 'queued', waited)
    if (waited > 15 * 60) throw new Error('Redash has been running for 15 minutes — try again later')
    await new Promise((r) => setTimeout(r, everyMs))
    if (ctl.cancelled) throw new PullCancelled()
    d = (await getJson(`${API_URL}?action=redashJob&job=${encodeURIComponent(d.job)}&key=${APP_KEY}`, 3)) as JobReply<R>
  }
  if (ctl.cancelled) throw new PullCancelled()
  if (d.error) throw new Error(d.error)
  return d
}

/** The live backend is older than v8 (it answers unknown actions with the whole state). */
export class BackendOutdated extends Error { constructor() { super('The Google backend needs the v8 update (Code-v8-mp-utilization.gs)') } }

/** Backend version: 8+ answers ?action=version; older ones return the state instead → 0. */
export async function backendVersion(): Promise<number> {
  const d = (await getJson(`${API_URL}?action=version&key=${APP_KEY}`, 2)) as { version?: unknown }
  return typeof d.version === 'number' ? d.version : 0
}

/** Marketplace purchases per day (backend v8). `to` is exclusive. */
export async function fetchMpDaily(from: string, to: string, ctl: PullControl = { cancelled: false }, onProgress?: (state: string, seconds: number) => void): Promise<MpDailyRow[]> {
  return mpq<MpDailyRow>(`q=mpdaily&from=${from}&to=${to}`, ctl, onProgress)
}

/** Live stock and demand per active item (backend v8). */
export async function fetchMpStock(ctl: PullControl = { cancelled: false }, onProgress?: (state: string, seconds: number) => void): Promise<MpStockRow[]> {
  return mpq<MpStockRow>('q=mpstock', ctl, onProgress)
}

async function mpq<R>(params: string, ctl: PullControl, onProgress?: (state: string, seconds: number) => void): Promise<R[]> {
  const d = await runRedash<R>(`${API_URL}?action=mpq&${params}&key=${APP_KEY}`, ctl, onProgress, 3000)
  // An older backend has no "mpq": it falls through to the default and returns the whole state.
  if (!Array.isArray(d.rows)) throw new BackendOutdated()
  return d.rows
}

/** Stops a BuffOps run inside Redash (sales or Fulfillment) so it stops loading the database. */
export async function redashCancel(job: string): Promise<void> {
  const d = (await getJson(`${API_URL}?action=redashCancel&job=${encodeURIComponent(job)}&key=${APP_KEY}`, 2)) as { ok?: boolean; error?: string }
  if (d.error) throw new Error(d.error)
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

// ── Receipts on finance requests (files in the script owner's Drive, private) ──
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024
export const RECEIPT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,application/pdf'

const toBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result).split(',')[1] || '')
  r.onerror = () => rej(new Error('Could not read the file'))
  r.readAsDataURL(b)
})

/** Uploads one file; returns the reference to store on the transaction. Disabled in preview mode. */
export async function uploadReceipt(file: Blob, name: string, txId: number, by: string): Promise<Omit<Receipt, 'uploadedAt' | 'uploadedBy'>> {
  if (!WRITE_ENABLED) throw new Error('Uploading is disabled in preview mode')
  const mime = file.type || 'application/octet-stream'
  const body = JSON.stringify({ name, mime, txId, by, data: await toBase64(file) })
  const r = await fetch(`${API_URL}?action=uploadReceipt&key=${APP_KEY}`, { method: 'POST', body })
  const text = await r.text()
  if (!text.trimStart().startsWith('{')) throw new Error('Unexpected response from Google')
  const d = JSON.parse(text) as { ok?: boolean; id?: string; name?: string; mime?: string; size?: number; error?: string }
  // An older backend treats this POST as a state save and rejects it ("Invalid data …") — nothing is written.
  if (d.error) throw new Error(/Invalid data/.test(d.error) ? 'the Google backend has not been updated for receipts yet (Code-v3-receipts.gs)' : d.error)
  if (!d.ok || !d.id) throw new Error('Upload failed')
  return { id: d.id, name: d.name || name, mime: d.mime || mime, size: d.size || file.size }
}

const receiptCache = new Map<string, Promise<Blob>>()

/** Read-only: downloads a receipt as a Blob (cached for the session). */
export function fetchReceipt(id: string): Promise<Blob> {
  let p = receiptCache.get(id)
  if (!p) {
    p = (getJson(`${API_URL}?action=receipt&id=${encodeURIComponent(id)}&key=${APP_KEY}`, 2) as Promise<{ data?: string; mime?: string; error?: string }>).then((d) => {
      if (d.error || !d.data) throw new Error(d.error || 'Receipt not available')
      const bin = atob(d.data)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new Blob([bytes], { type: d.mime || 'application/octet-stream' })
    })
    p.catch(() => receiptCache.delete(id))
    receiptCache.set(id, p)
  }
  return p
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

type PullReply = { rows?: FulfillRow[]; error?: string; pending?: boolean; job?: string; state?: string }

/**
 * Writes: pulls new owed customers from Redash into the sheet. Disabled in preview mode.
 * The Redash query can run for minutes, so the backend starts it and we poll the job
 * (onProgress gets 'queued' | 'running' and the seconds waited) until the rows are in.
 */
export class PullCancelled extends Error { constructor() { super('Pull cancelled') } }

/** Lets the screen cancel a running pull; `job` is the Redash job once it is known. */
export interface PullControl { cancelled: boolean; job?: string }

export async function fulfillPull(onProgress?: (state: string, seconds: number) => void, ctl: PullControl = { cancelled: false }): Promise<FulfillRow[]> {
  if (!WRITE_ENABLED) throw new Error('Pulling from Redash writes to the sheet — disabled in preview mode')
  const t0 = Date.now()
  let d = (await getJson(`${API_URL}?action=fulfillPull&key=${APP_KEY}`, 1)) as PullReply
  while (d.pending && d.job) {
    ctl.job = d.job
    if (ctl.cancelled) throw new PullCancelled()
    const waited = Math.round((Date.now() - t0) / 1000)
    onProgress?.(d.state || 'queued', waited)
    if (waited > 20 * 60) throw new Error('Redash has been running the query for 20 minutes — try again later')
    await new Promise((r) => setTimeout(r, 5000))
    if (ctl.cancelled) throw new PullCancelled()
    d = (await getJson(`${API_URL}?action=fulfillPullJob&job=${encodeURIComponent(d.job)}&key=${APP_KEY}`, 3)) as PullReply
  }
  if (ctl.cancelled) throw new PullCancelled()
  if (d.error) throw new Error(d.error === 'Timeout' ? 'Redash did not finish in time (the Google backend needs the pull update, Code-v4-pull.gs)' : d.error)
  return d.rows || []
}

/** Stops the running pull in Redash itself, so the query stops loading the database. */
export async function fulfillPullCancel(job?: string): Promise<void> {
  if (!WRITE_ENABLED) throw new Error('Disabled in preview mode')
  const d = (await getJson(`${API_URL}?action=fulfillPullCancel&job=${encodeURIComponent(job || '')}&key=${APP_KEY}`, 2)) as { ok?: boolean; error?: string }
  if (d.error) throw new Error(d.error)
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
