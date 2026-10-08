// Finance requests: same record shape and email text as BuffOps v1.
import { DEPTS, type Dept, type Transaction } from './types'

export const DEPT_LABELS: Record<Dept, string> = {
  productDesktop: 'Product Desktop', productMobile: 'Product Mobile', marketing: 'Marketing', buffPay: 'Buff Pay', dataProject: 'Data project',
}

const usd = (v: number) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function totalOf(amounts: Partial<Record<Dept, number>>): number {
  return DEPTS.reduce((a, d) => a + (Number(amounts[d]) || 0), 0)
}

/** "Product Desktop: $6,800.00 / Data project: $500.00" — only departments with an amount. */
export function splitText(amounts: Partial<Record<Dept, number>>): string {
  return DEPTS.filter((d) => (Number(amounts[d]) || 0) > 0).map((d) => `${DEPT_LABELS[d]}: ${usd(Number(amounts[d]))}`).join(' / ')
}

export function nextId(txs: Transaction[]): number {
  return txs.length ? Math.max(...txs.map((t) => Number(t.id) || 0)) + 1 : 1
}

export function makeRequest(txs: Transaction[], f: { vendor: string; amounts: Partial<Record<Dept, number>>; note: string; enteredBy: string; date: string }): Transaction {
  const t: Transaction = {
    id: nextId(txs), vendor: f.vendor, totalAmount: totalOf(f.amounts), note: f.note, enteredBy: f.enteredBy,
    dateRequested: f.date, status: 'pending', lastUpdate: new Date().toISOString(), departmentsSplit: splitText(f.amounts),
  }
  for (const d of DEPTS) t[d] = Number(f.amounts[d]) || 0
  return t
}

export function newRequestEmail(t: Transaction, fallbackName: string) {
  const deptLines = DEPTS.map((d) => `  ${DEPT_LABELS[d]}: ${usd(Number(t[d]) || 0)}`).join('\n')
  const body = ['A new transaction has been created.', '', `Vendor: ${t.vendor}`, `Transaction ID: ${t.id}`, `Amount: ${usd(t.totalAmount)}`,
    `Date Requested: ${t.dateRequested}`, `Entered By: ${t.enteredBy || fallbackName || '—'}`, ...(t.note ? [`Notes: ${t.note}`] : []), '', 'Departments Breakdown:', deptLines].join('\n')
  return { subject: `Finance Request #${t.id} - ${t.vendor} - ${usd(t.totalAmount)}`, body }
}

export function statusEmail(t: Transaction, status: string, who: string, whoEmail: string, today: string) {
  const body = ['Transaction status has been updated.', '', `Vendor: ${t.vendor}`, `Transaction ID: #${t.id}`, `Amount: ${usd(t.totalAmount)}`, `New Status: ${cap(status)}`,
    `Updated by: ${who}${whoEmail ? ` <${whoEmail}>` : ''}`, `Date: ${today}`, '', 'Note: Reply to this email to reach the person who made this update.'].join('\n')
  return { subject: `Status Update: Finance Request #${t.id} - ${t.vendor} - ${cap(status)}`, body }
}

/** Mail text used by the "Email finance" link and "Copy" (v1 detail modal). */
export function financeMailText(t: Transaction) {
  const deptLines = DEPTS.filter((d) => (Number(t[d]) || 0) > 0).map((d) => `  - ${DEPT_LABELS[d]}: ${usd(Number(t[d]))}`).join('\n')
  const body = ['Hi Finance Team,', '', `Finance Request #${t.id} details:`, '', `Vendor: ${t.vendor}`, `Date: ${t.dateRequested}`, `Total: ${usd(t.totalAmount)}`, `Status: ${t.status}`, '',
    'Department Breakdown:', deptLines || '  (no split recorded)', ...(t.note ? ['', `Notes: ${t.note}`] : []), '', `Requested by: ${t.enteredBy || '—'}`].join('\n')
  return { subject: `Finance Request #${t.id} — ${t.vendor} — ${t.dateRequested}`, body }
}

export interface MonthTotal { key: string; total: number; count: number; split: Record<Dept, number> }

/** Every month from the first request to `untilKey` (YYYY-MM), empty months included. */
export function monthlyTotals(txs: Transaction[], untilKey: string): MonthTotal[] {
  const keys = txs.map((t) => (t.dateRequested || '').slice(0, 7)).filter(Boolean).sort()
  if (!keys.length) return []
  const out: MonthTotal[] = []
  let [y, m] = keys[0].split('-').map(Number)
  const [ey, em] = untilKey.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const items = txs.filter((t) => (t.dateRequested || '').startsWith(key))
    const split = Object.fromEntries(DEPTS.map((d) => [d, items.reduce((a, t) => a + (Number(t[d]) || 0), 0)])) as Record<Dept, number>
    out.push({ key, total: DEPTS.reduce((a, d) => a + split[d], 0), count: items.length, split })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}
