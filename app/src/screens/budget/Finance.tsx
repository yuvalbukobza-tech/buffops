import { useMemo, useState } from 'react'
import { WRITE_ENABLED, sendEmail } from '../../lib/api'
import { DAYS_PER_MONTH, VENDORS, vendorBudgets } from '../../lib/calc'
import { DEPT_LABELS, financeMailText, makeRequest, monthlyTotals, newRequestEmail, splitText, statusEmail, totalOf } from '../../lib/finance'
import { useSession } from '../../lib/session'
import { useData, useStore } from '../../lib/store'
import { DEPTS, type Dept, type Transaction } from '../../lib/types'
import { C, Card, Drawer, Icon, Toast, money, useEntrance } from '../../ui/kit'

export const DEPT_COLOR: Record<Dept, string> = { productDesktop: C.lime, productMobile: C.sky, marketing: C.orange, buffPay: C.violet, dataProject: C.pink }
const MONTH = (key: string, style: 'short' | 'long' = 'short') => new Date(key + '-15T12:00:00').toLocaleString('en-US', { month: style })
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const fmtDate = (d: string) => (d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')

export interface FinancePrefill { vendor: string; amount: number; note?: string }

function EditDrawer({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { update } = useStore()
  const [f, setF] = useState<Transaction>(tx)
  const amounts = Object.fromEntries(DEPTS.map((d) => [d, Number(f[d]) || 0])) as Record<Dept, number>
  const save = () => {
    const next: Transaction = { ...f, totalAmount: totalOf(amounts), departmentsSplit: splitText(amounts), lastUpdate: new Date().toISOString() }
    update((s) => ({ ...s, transactions: s.transactions.map((t) => (t.id === tx.id ? next : t)) }))
    onClose()
  }
  return (
    <Drawer open onClose={onClose} title={`Edit request ${tx.id}`}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">Edit · admin</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>Request #{tx.id}</div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Vendor</span><select className="input" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>{[...new Set([...VENDORS, f.vendor])].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Date</span><input className="input" type="date" value={f.dateRequested} onChange={(e) => setF({ ...f, dateRequested: e.target.value })} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Status</span><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="pending">Pending</option><option value="delivered">Delivered</option></select></label>
      </div>
      {DEPTS.map((d) => (
        <label key={d} className="row" style={{ gap: 10, height: 40, padding: '0 6px 0 12px', borderRadius: 10, background: '#17191C' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: DEPT_COLOR[d] }} /><span style={{ flex: 1, fontSize: 13 }}>{DEPT_LABELS[d]}</span>
          <input className="input mono" type="number" min={0} step={100} value={amounts[d] || ''} onChange={(e) => setF({ ...f, [d]: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 110, height: 30, textAlign: 'right' }} />
        </label>
      ))}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Note</span><input className="input" value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <div className="row" style={{ marginTop: 'auto' }}>
        <span className="mono" style={{ flex: 1, fontSize: 18 }}>{money(totalOf(amounts), 2)}</span>
        <button className="btn primary" onClick={save} disabled={!totalOf(amounts)} style={{ height: 44, padding: '0 22px' }}>Save</button>
      </div>
    </Drawer>
  )
}

export default function Finance({ prefill, clearPrefill }: { prefill: FinancePrefill | null; clearPrefill: () => void }) {
  const data = useData()
  const { update } = useStore()
  const session = useSession()
  const t = useEntrance()
  const me = data.appUsers.find((u) => u.username === session.username)

  const plan = useMemo(() => vendorBudgets(data.allocs, data.products, data.raffles, data.budgetExtras), [data])
  const planMonthly = plan.reduce((a, v) => a + v.monthly, 0)
  const half = (vendor: string) => Math.round(((plan.find((p) => p.vendor === vendor)?.monthly || 0) / DAYS_PER_MONTH) * 15)

  // ── new request form ───────────────────────────────────────────────
  const [vendor, setVendor] = useState(prefill?.vendor || 'GCOW')
  const [amounts, setAmounts] = useState<Partial<Record<Dept, number>>>(prefill ? { productDesktop: prefill.amount } : {})
  const [note, setNote] = useState(prefill?.note || '')
  const [date, setDate] = useState(today())
  const [to, setTo] = useState<Record<string, boolean>>(() => Object.fromEntries(data.appUsers.filter((u) => u.defaultRecipient && u.email).map((u) => [u.username, true])))
  const [toast, setToast] = useState('')
  const total = totalOf(amounts)
  const recipients = data.appUsers.filter((u) => to[u.username] && u.email)
  const submit = () => {
    const tx = makeRequest(data.transactions, { vendor, amounts, note, enteredBy: session.display, date })
    update((s) => ({ ...s, transactions: [tx, ...s.transactions] }))
    setAmounts({}); setNote(''); clearPrefill()
    setOpen(tx.id)
    if (recipients.length) {
      const e = newRequestEmail(tx, session.display)
      sendEmail(recipients.map((u) => u.email), e.subject, e.body)
        .then(() => setToast(`Request #${tx.id} added · email sent to ${recipients.length}`))
        .catch((err: Error) => setToast(`Request #${tx.id} added · ${WRITE_ENABLED ? 'email failed: ' + err.message : 'email not sent (preview)'}`))
    } else setToast(`Request #${tx.id} added`)
  }

  // ── list, months ───────────────────────────────────────────────────
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all')
  const [month, setMonth] = useState<string | null>(null)
  const [hAll, setHAll] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [notify, setNotify] = useState(true)
  const nowKey = today().slice(0, 7)
  const months = useMemo(() => monthlyTotals(data.transactions, nowKey), [data.transactions, nowKey])
  const recent = months.slice(-5)
  const maxM = Math.max(1, ...months.map((m) => m.total))
  const scale = maxM * 1.06
  const full = months.filter((m) => m.key !== nowKey)
  const avg = full.length ? full.reduce((a, m) => a + m.total, 0) / full.length : 0
  const allTotal = months.reduce((a, m) => a + m.total, 0)
  const pending = data.transactions.filter((x) => x.status === 'pending')
  const listed = data.transactions
    .filter((x) => (filter === 'all' || x.status === filter) && (!month || (x.dateRequested || '').startsWith(month)))
    .sort((a, b) => (b.dateRequested || '').localeCompare(a.dateRequested || '') || b.id - a.id)
  const groups = [...new Set(listed.map((x) => (x.dateRequested || '').slice(0, 7)))].map((key) => ({ key, rows: listed.filter((x) => (x.dateRequested || '').startsWith(key)), m: months.find((m) => m.key === key) }))
  const focusKey = hAll || month
  const fm = months.find((m) => m.key === focusKey)

  const setStatus = (tx: Transaction, status: string) => {
    update((s) => ({ ...s, transactions: s.transactions.map((x) => (x.id === tx.id ? { ...x, status, lastUpdate: new Date().toISOString(), statusChangedAt: new Date().toISOString(), statusChangedBy: session.display } : x)) }))
    const rec = data.appUsers.filter((u) => u.defaultRecipient && u.email)
    if (notify && rec.length) {
      const e = statusEmail(tx, status, session.display, me?.email || '', today())
      sendEmail(rec.map((u) => u.email), e.subject, e.body, { name: session.display, email: me?.email })
        .then(() => setToast(`#${tx.id} marked ${status} · finance notified`))
        .catch(() => setToast(`#${tx.id} marked ${status}${WRITE_ENABLED ? ' · email failed' : ' · email not sent (preview)'}`))
    } else setToast(`#${tx.id} marked ${status}`)
  }
  const remove = (tx: Transaction) => {
    if (!window.confirm(`Delete finance request #${tx.id} (${tx.vendor}, ${money(tx.totalAmount)})?`)) return
    update((s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== tx.id) }))
    setOpen(null)
  }
  const copy = (tx: Transaction) => { navigator.clipboard?.writeText(financeMailText(tx).body).then(() => setToast('Email text copied')) }
  const editTx = data.transactions.find((x) => x.id === editing)

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="card a-up" style={{ padding: '14px 18px', animationDelay: '80ms' }}><div className="caption">Pending</div><div className="mono" style={{ fontSize: 22, color: pending.length ? C.warn : C.text, marginTop: 4 }}>{money(pending.reduce((a, x) => a + x.totalAmount, 0) * t)}</div><div className="caption">{pending.length} request{pending.length === 1 ? '' : 's'}</div></div>
        <div className="card a-up" style={{ padding: '14px 18px', animationDelay: '140ms' }}><div className="caption">This month so far</div><div className="mono" style={{ fontSize: 22, marginTop: 4 }}>{money((months.at(-1)?.total || 0) * t)}</div><div className="caption">{Math.round(((months.at(-1)?.total || 0) / planMonthly) * 100)}% of today's {money(planMonthly)} plan</div></div>
        <div className="card a-up" style={{ padding: '14px 18px', animationDelay: '200ms' }}><div className="caption">All time</div><div className="mono" style={{ fontSize: 22, marginTop: 4 }}>{money(allTotal * t)}</div><div className="caption">{data.transactions.length} requests · {months.length} months</div></div>
      </div>

      <Card delay={160}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div><h2 className="h2">Every month side by side</h2><div className="caption" style={{ marginTop: 4 }}>Transfers per month, split by department · click a month to filter</div></div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <div className="row hide-sm" style={{ gap: 14, fontSize: 12, color: C.muted, paddingTop: 4 }}>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 16, borderTop: '2px dashed #EDEEF0' }} />Plan {money(planMonthly)}</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 16, borderTop: `2px solid ${C.orange}` }} />Average {money(avg)}</span>
            </div>
            <div style={{ textAlign: 'right', minWidth: 240, minHeight: 40 }}>
              <div className="mono" style={{ fontSize: 17, fontWeight: 600, color: fm ? (fm.total > planMonthly ? C.orange : C.lime) : C.text }}>{fm ? `${MONTH(fm.key, 'long')} ${fm.key.slice(0, 4)}${fm.key === nowKey ? ' (so far)' : ''} · ${money(fm.total)}` : `${money(allTotal * t)} in ${months.length} months`}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{fm ? `${fm.count} request${fm.count === 1 ? '' : 's'} · ${Math.round((fm.total / planMonthly) * 100)}% of plan · ${DEPTS.filter((d) => fm.split[d]).map((d) => `${DEPT_LABELS[d].replace('Product ', '')} ${money(fm.split[d])}`).join(' · ')}` : 'Hover a month for the split'}</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', height: 230, marginTop: 18 }}>
          <div className="a-gx" style={{ position: 'absolute', left: 0, right: 0, bottom: `${(planMonthly / scale) * 100}%`, borderTop: '2px dashed rgba(237,238,240,0.55)', zIndex: 2, pointerEvents: 'none', animationDelay: '1300ms' }} />
          <div className="a-gx" style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avg / scale) * 100}%`, borderTop: '2px solid rgba(251,146,60,0.8)', zIndex: 2, pointerEvents: 'none', animationDelay: '1450ms' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 8, borderBottom: `1px solid ${C.line2}` }}>
            {months.map((m, i) => {
              const lit = hAll === m.key || month === m.key
              const dim = (hAll || month) && !lit
              return (
                <button key={m.key} aria-label={`${MONTH(m.key, 'long')} ${m.key.slice(0, 4)} ${money(m.total)}`} onMouseEnter={() => setHAll(m.key)} onMouseLeave={() => setHAll(null)} onClick={() => setMonth(month === m.key ? null : m.key)}
                  style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 0, border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', background: lit ? 'rgba(200,255,0,0.05)' : 'transparent', transition: 'background .2s' }}>
                  <span className="mono hide-sm" style={{ fontSize: 11, fontWeight: 600, color: lit ? C.lime : C.muted, marginBottom: 6 }}>{m.total ? `$${(m.total / 1000).toFixed(m.total >= 10000 ? 0 : 1)}k` : ''}</span>
                  <span className="a-gy" style={{ display: 'flex', flexDirection: 'column-reverse', height: `${(m.total / scale) * 100}%`, borderRadius: '6px 6px 0 0', overflow: 'hidden', opacity: dim ? 0.3 : 1, transition: 'opacity .2s', animationDelay: `${380 + i * 55}ms`, boxShadow: month === m.key ? `0 0 0 2px ${C.lime}` : 'none', backgroundImage: m.key === nowKey ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 4px, transparent 4px 8px)' : undefined }}>
                    {DEPTS.filter((d) => m.split[d]).map((d) => <span key={d} style={{ display: 'block', height: `${(m.split[d] / m.total) * 100}%`, background: DEPT_COLOR[d], borderTop: '1px solid #111215' }} />)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {months.map((m, i) => <span key={m.key} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: hAll === m.key || month === m.key ? C.text : C.faint }}>{MONTH(m.key)}{(i === 0 || m.key.endsWith('-01')) && <span style={{ display: 'block', fontSize: 10, color: C.ghost }}>{m.key.slice(0, 4)}</span>}</span>)}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: 18, alignItems: 'start' }}>
        <Card delay={260} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 className="h2">New request</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Vendor</span>
            <select className="input" value={vendor} onChange={(e) => setVendor(e.target.value)}>{VENDORS.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          {half(vendor) > 0 && (
            <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.18)', fontSize: 12 }}>
              <span style={{ color: '#B4B8BF' }}>Plan for the next 15 days: <b className="mono" style={{ color: C.lime }}>{money(half(vendor))}</b></span>
              <button onClick={() => setAmounts({ productDesktop: half(vendor) })} style={{ border: 'none', background: 'transparent', color: C.lime, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Use →</button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="caption">Department split</span>
            {DEPTS.map((d) => (
              <label key={d} className="row" style={{ gap: 10, height: 40, padding: '0 6px 0 12px', borderRadius: 10, background: '#17191C' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: DEPT_COLOR[d] }} /><span style={{ flex: 1, fontSize: 13 }}>{DEPT_LABELS[d]}</span>
                <span className="mono" style={{ fontSize: 11, color: C.faint, width: 36, textAlign: 'right' }}>{total && amounts[d] ? Math.round(((amounts[d] || 0) / total) * 100) + '%' : ''}</span>
                <input className="input mono" aria-label={`${DEPT_LABELS[d]} amount`} type="number" min={0} step={100} value={amounts[d] || ''} onChange={(e) => setAmounts({ ...amounts, [d]: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 100, height: 30, textAlign: 'right' }} />
              </label>
            ))}
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#17191C', marginTop: 4 }}>
              {DEPTS.filter((d) => (amounts[d] || 0) > 0).map((d) => <span key={d} style={{ height: '100%', width: `${((amounts[d] || 0) / total) * 100}%`, background: DEPT_COLOR[d], borderRight: '2px solid #111215', transition: 'width .35s var(--ease)' }} />)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="caption">Email to</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {data.appUsers.filter((u) => u.email).map((u) => {
                const on = !!to[u.username]
                return <button key={u.username} aria-pressed={on} onClick={() => setTo({ ...to, [u.username]: !on })} style={{ height: 30, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${on ? 'rgba(200,255,0,0.4)' : C.line2}`, background: on ? 'rgba(200,255,0,0.08)' : 'transparent', color: on ? C.lime : C.muted }}>{u.firstName} {u.lastName[0]}.</button>
              })}
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 140px', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Note</span><input className="input" placeholder="e.g. First October budget" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          <button className="btn primary" disabled={!total} onClick={submit} style={{ height: 46, justifyContent: 'center', fontSize: 14 }}>{total ? `Submit ${money(total)}${recipients.length ? ` · email ${recipients.length}` : ''}` : 'Enter an amount'}</button>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <Card delay={340} style={{ padding: 16 }}>
            <div className="between" style={{ alignItems: 'center', padding: '0 4px 12px' }}><h2 className="h2">Recent months</h2><span className="caption">Dashed line = today's plan</span></div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${recent.length}, minmax(0, 1fr))`, gap: 8 }}>
              {recent.map((m, i) => {
                const prev = months[months.indexOf(m) - 1]
                const d = prev && prev.total ? Math.round(((m.total - prev.total) / prev.total) * 100) : null
                const on = month === m.key
                const cap = Math.max(planMonthly * 1.6, ...recent.map((x) => x.total))
                return (
                  <button key={m.key} onClick={() => setMonth(on ? null : m.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, cursor: 'pointer', textAlign: 'left', color: C.text, transition: 'all .2s', background: on ? 'rgba(200,255,0,0.06)' : '#0B0C0E', border: `1px solid ${on ? 'rgba(200,255,0,0.5)' : C.line}` }}>
                    <span className="row" style={{ width: '100%', justifyContent: 'space-between' }}><b style={{ fontSize: 13, fontWeight: 600 }}>{MONTH(m.key)}{m.key === nowKey ? ' · so far' : ''}</b>{d !== null && m.key !== nowKey && <span className="mono" style={{ fontSize: 11, color: d >= 0 ? C.good : C.bad }}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)}%</span>}</span>
                    <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: on ? C.lime : C.text }}>{money(m.total)}</span>
                    <span style={{ display: 'block', width: '100%', height: 30, position: 'relative', borderRadius: 6, background: '#17191C', overflow: 'hidden' }}>
                      <span className="a-gx" style={{ position: 'absolute', inset: '0 auto 0 0', display: 'flex', width: `${(m.total / cap) * 100}%`, animationDelay: `${600 + i * 90}ms` }}>
                        {DEPTS.filter((x) => m.split[x]).map((x) => <span key={x} style={{ height: '100%', width: `${(m.split[x] / m.total) * 100}%`, background: DEPT_COLOR[x] }} />)}
                      </span>
                      <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${(planMonthly / cap) * 100}%`, borderLeft: `1px dashed ${C.muted}` }} />
                    </span>
                    <span style={{ fontSize: 11, color: C.faint }}>{m.count} request{m.count === 1 ? '' : 's'} · {Math.round((m.total / planMonthly) * 100)}% of plan</span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card pad={false} delay={420}>
            <div className="between" style={{ alignItems: 'center', padding: '14px 20px' }}>
              <div className="seg">{(['all', 'pending', 'delivered'] as const).map((k) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{k === 'all' ? 'All' : k === 'pending' ? `Pending · ${pending.length}` : 'Delivered'}</button>)}</div>
              <span className="caption">{month ? <>{MONTH(month, 'long')} {month.slice(0, 4)} · <button onClick={() => setMonth(null)} style={{ border: 'none', background: 'none', color: C.lime, cursor: 'pointer', padding: 0, fontSize: 12 }}>show all</button></> : 'Grouped by month · newest first'}</span>
            </div>
            {groups.map((g) => {
              const pct = g.m ? (g.m.total / planMonthly) * 100 : 0
              const pend = g.rows.filter((x) => x.status === 'pending')
              return (
                <div key={g.key}>
                  <div className="row" style={{ gap: 16, padding: '18px 20px 14px', background: '#15171A', borderTop: '1px solid #23262B', borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 160 }}><div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{MONTH(g.key, 'long')}{g.key === nowKey ? ' · so far' : ` ${g.key.slice(0, 4)}`}</div><div className="caption" style={{ color: C.muted }}>{g.m?.count} request{g.m?.count === 1 ? '' : 's'} · {[...new Set(g.rows.map((x) => x.vendor))].join(', ')}</div></div>
                    <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ display: 'block', height: 8, borderRadius: 4, background: '#23262B', overflow: 'hidden' }}><span className="a-gx" style={{ display: 'block', height: '100%', borderRadius: 4, width: `${Math.min(pct, 100)}%`, background: pct > 100 ? C.orange : C.lime, animationDelay: '700ms' }} /></span>
                      <span style={{ fontSize: 11, color: C.muted }}>{Math.round(pct)}% of today's {money(planMonthly)} plan · {pct > 100 ? `${money((g.m?.total || 0) - planMonthly)} over` : `${money(planMonthly - (g.m?.total || 0))} left`}</span>
                    </div>
                    {pend.length > 0 && <span className="pill" style={{ color: C.warn, background: '#2A1F08' }}>{pend.length} pending · {money(pend.reduce((a, x) => a + x.totalAmount, 0))}</span>}
                    <span className="mono" style={{ fontSize: 20, fontWeight: 600, minWidth: 110, textAlign: 'right', color: g.key === nowKey ? C.lime : C.text }}>{money(g.m?.total || 0)}</span>
                  </div>
                  {g.rows.map((x) => {
                    const isOpen = open === x.id
                    const pendingRow = x.status === 'pending'
                    const mail = financeMailText(x)
                    return (
                      <div key={x.id} style={{ borderTop: '1px solid #17191C', background: isOpen ? '#15171A' : 'transparent', transition: 'background .2s' }}>
                        <button onClick={() => setOpen(isOpen ? null : x.id)} aria-expanded={isOpen} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 120px 110px 100px', gap: 14, alignItems: 'center', width: '100%', padding: '0 20px', height: 56, border: 'none', background: 'transparent', color: C.text, textAlign: 'left', cursor: 'pointer' }}>
                          <span className="mono" style={{ fontSize: 12, color: C.faint }}>#{x.id}</span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}><b style={{ fontSize: 14, fontWeight: 600 }}>{x.vendor} <span style={{ fontWeight: 400, fontSize: 12, color: C.faint }}>· {fmtDate(x.dateRequested)}</span></b><span style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.note || '—'}</span></span>
                          <span style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#17191C' }}>{DEPTS.filter((d) => (Number(x[d]) || 0) > 0).map((d) => <span key={d} style={{ width: `${((Number(x[d]) || 0) / (x.totalAmount || 1)) * 100}%`, background: DEPT_COLOR[d] }} />)}</span>
                          <span className="pill" style={{ justifySelf: 'start', color: pendingRow ? C.warn : C.good, background: pendingRow ? '#2A1F08' : '#0F2418' }}><span className={pendingRow ? 'a-pulse' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{pendingRow ? 'Pending' : 'Delivered'}</span>
                          <span className="mono" style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{money(x.totalAmount)}</span>
                        </button>
                        {isOpen && (
                          <div className="a-up" style={{ padding: '4px 20px 18px 86px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', animationDuration: '.4s' }}>
                            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {DEPTS.filter((d) => (Number(x[d]) || 0) > 0).map((d) => (
                                <div key={d} className="row" style={{ gap: 10, fontSize: 13 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: DEPT_COLOR[d] }} /><span style={{ flex: 1, color: '#B4B8BF' }}>{DEPT_LABELS[d]}</span><span className="mono">{money(Number(x[d]), 2)}</span><span className="mono" style={{ fontSize: 12, color: C.faint, width: 40, textAlign: 'right' }}>{Math.round(((Number(x[d]) || 0) / (x.totalAmount || 1)) * 100)}%</span></div>
                              ))}
                              <div className="caption" style={{ marginTop: 4 }}>Requested {fmtDate(x.dateRequested)} by {x.enteredBy || '—'}{x.lastUpdate ? ` · updated ${fmtDate(x.lastUpdate)}` : ''}{x.statusChangedBy ? ` by ${x.statusChangedBy}` : ''}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 190 }}>
                              <button className="btn primary" onClick={() => setStatus(x, pendingRow ? 'delivered' : 'pending')} style={pendingRow ? { justifyContent: 'center' } : { justifyContent: 'center', background: '#1F2226', borderColor: '#1F2226', color: C.text }}>{pendingRow ? 'Mark delivered' : 'Mark pending'}</button>
                              <label className="row" style={{ gap: 8, fontSize: 12, color: C.muted, cursor: 'pointer' }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email finance about it</label>
                              <a className="btn" href={`mailto:?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`} style={{ justifyContent: 'center' }}>Open in mail app</a>
                              <button className="btn" onClick={() => copy(x)} style={{ justifyContent: 'center' }}>Copy email text</button>
                              {session.isAdmin && <div className="row"><button className="btn small" onClick={() => setEditing(x.id)} style={{ flex: 1, justifyContent: 'center' }}>{Icon.edit}Edit</button><button className="btn small" onClick={() => remove(x)} style={{ flex: 1, justifyContent: 'center', color: C.bad, borderColor: '#4A1D1D' }}>Delete</button></div>}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {groups.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.faint }}>No requests match.</div>}
          </Card>
        </div>
      </div>
      {editTx && <EditDrawer tx={editTx} onClose={() => setEditing(null)} />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </>
  )
}
