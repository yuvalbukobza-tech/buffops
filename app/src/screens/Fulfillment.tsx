import { useCallback, useEffect, useMemo, useState } from 'react'
import { WRITE_ENABLED, fulfillAction, fulfillFormLink, fulfillList, fulfillPull, type FulfillRow } from '../lib/api'
import { C, Card, Drawer, Icon, Kpi, Toast, useEntrance } from '../ui/kit'

const DAY = 86400000
const TOKEN_TTL_DAYS = 14 // same rule as the backend: a form link expires 14 days after it was emailed
const STAGES = [
  { status: 'pending', name: 'New', color: '#6B7079' },
  { status: 'emailed', name: 'Emailed', color: C.sky },
  { status: 'details_received', name: 'Details in', color: C.warn },
  { status: 'ordered', name: 'Ordered', color: C.violet },
  { status: 'done', name: 'Done', color: C.good },
]
const SEG = [['Waiting on us', '#3A3D44'], ['Waiting on customer', C.sky], ['To order', C.warn], ['Shipping', C.violet]] as const

const toDate = (s?: string) => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d }
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY)
const fmt = (s?: string) => { const d = toDate(s); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' }
const isTest = (r: FulfillRow) => /@buff\.game$/i.test(r.email || '') || /^test/i.test(r.product || '') || r.purchaseDate === 'test'

function alertOf(r: FulfillRow, now: Date): { short: string; long: string } | null {
  if (r.status === 'emailed') {
    const sent = toDate(r.emailedAt || r.createdAt)
    if (sent && days(sent, now) > TOKEN_TTL_DAYS) {
      const expired = new Date(sent.getTime() + TOKEN_TTL_DAYS * DAY)
      return { short: `Link expired ${days(expired, now)} days ago`, long: `The form link expired on ${fmt(expired.toISOString())} and the customer never filled it in. Resend the email to create a fresh link.` }
    }
    return sent ? { short: `Waiting ${days(sent, now)} days`, long: `Emailed ${fmt(r.emailedAt)}. The link works until ${fmt(new Date(sent.getTime() + TOKEN_TTL_DAYS * DAY).toISOString())}.` } : null
  }
  if (r.status === 'details_received') {
    const at = toDate(r.detailsAt)
    return { short: `Waiting on us${at ? ` · ${days(at, now)} days` : ''}`, long: `Shipping details arrived${at ? ` on ${fmt(r.detailsAt)}` : ''}. The order has not been placed on Amazon yet.` }
  }
  if (r.status === 'pending') return { short: 'Send email #1', long: 'New from Redash — the customer has not been contacted yet.' }
  return null
}

function orderCard(r: FulfillRow) {
  return [`Full name: ${r.fullName || r.name}`, `Address: ${[r.address, r.apt].filter(Boolean).join(', ')}`, `City / State / Zip: ${[r.city, r.state, r.zip].filter(Boolean).join(', ')}`,
    `Country: ${r.country || ''}`, `Phone: ${r.phone || ''}`, `Product: ${r.product || ''}`].join('\n')
}

export default function Fulfillment() {
  const t = useEntrance()
  const [rows, setRows] = useState<FulfillRow[] | null>(null)
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [showTests, setShowTests] = useState(false)
  const [orderNo, setOrderNo] = useState('')
  const [toast, setToast] = useState('')
  const now = useMemo(() => new Date(), [])

  const load = useCallback(() => {
    setState('loading')
    fulfillList().then((r) => { setRows(r); setState('idle') }).catch((e: Error) => { setError(e.message); setState('error') })
  }, [])
  useEffect(() => { load() }, [load])

  const pull = () => {
    setBusy('pull')
    fulfillPull().then((r) => { setRows(r); setToast('Pulled new customers from Redash') }).catch((e: Error) => setToast(e.message)).finally(() => setBusy(''))
  }
  const act = (r: FulfillRow, action: 'fulfillEmail1' | 'fulfillEmail2' | 'fulfillSetStatus', params: Record<string, string | undefined>, ok: string) => {
    setBusy(r.key)
    fulfillAction(action, params)
      .then(() => { setToast(ok); return fulfillList().then(setRows) })
      .catch((e: Error) => setToast(e.message))
      .finally(() => setBusy(''))
  }
  const email1 = (r: FulfillRow) => act(r, 'fulfillEmail1', { rowkey: r.key, userId: r.userId, name: r.name, email: r.email, product: r.product, country: r.country, purchaseDate: r.purchaseDate }, `Email sent to ${r.name}`)
  const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => setToast(`${what} copied`))

  const all = rows || []
  const shown = all.filter((r) => showTests || !isTest(r))
  const tests = all.length - all.filter((r) => !isTest(r)).length
  const needs = shown.filter((r) => r.status === 'pending' || r.status === 'details_received' || (r.status === 'emailed' && alertOf(r, now)?.short.startsWith('Link expired')))
  const done = shown.filter((r) => r.status === 'done' && toDate(r.emailedAt) && toDate(r.doneAt))
  const avg = done.length ? done.reduce((a, r) => a + days(toDate(r.emailedAt)!, toDate(r.doneAt)!), 0) / done.length : 0
  const fastest = done.length ? Math.min(...done.map((r) => days(toDate(r.emailedAt)!, toDate(r.doneAt)!))) : 0

  // journey timeline range: earliest purchase → today (+3 days)
  const dated = shown.map((r) => ({ r, pts: [r.purchaseDate, r.emailedAt, r.detailsAt, r.orderedAt, r.doneAt].map(toDate) })).filter((x) => x.pts[0] || x.pts[1])
  const startMs = Math.min(now.getTime() - 30 * DAY, ...dated.map((x) => (x.pts[0] || x.pts[1])!.getTime())) - 2 * DAY
  const endMs = now.getTime() + 3 * DAY
  const pos = (d: Date) => ((d.getTime() - startMs) / (endMs - startMs)) * 100
  const ticks = Array.from({ length: 5 }, (_, i) => new Date(startMs + ((endMs - startMs) * (i + 0.5)) / 5))

  const cur = all.find((r) => r.key === sel)
  const curAlert = cur ? alertOf(cur, now) : null

  return (
    <div className="page">
      <div className="between a-up">
        <div><h1 className="h1">Amazon fulfillment</h1><div className="sub">Physical prizes owed to customers{tests ? ` · ${tests} staff test row${tests > 1 ? 's' : ''} ${showTests ? 'shown' : 'hidden'}` : ''}</div></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {tests > 0 && <label className="row caption" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={showTests} onChange={(e) => setShowTests(e.target.checked)} />Show test rows</label>}
          <button className="icon-btn" aria-label="Reload from sheet" onClick={load}>{Icon.refresh}</button>
          <button className="btn" onClick={pull} disabled={busy === 'pull'} title={WRITE_ENABLED ? '' : 'Disabled in preview: it writes new rows to the sheet'}>{Icon.refresh}{busy === 'pull' ? 'Pulling… (slow)' : 'Pull new from Redash'}</button>
        </div>
      </div>
      {!WRITE_ENABLED && <div className="caption" style={{ color: C.warn }}>Preview: you can browse and copy, but emails to customers and status changes are disabled.</div>}
      {state === 'error' && <div className="card" style={{ padding: '12px 16px', borderColor: '#4A1D1D', color: C.bad, fontSize: 13 }}>Couldn't read the Fulfillment sheet: {error} <button className="btn small" onClick={load}>Retry</button></div>}
      {state === 'loading' && !rows && <div className="caption">Loading the Fulfillment sheet…</div>}

      {rows && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Kpi label="Needs action" value={String(Math.round(needs.length * t))} sub={needs.length ? needs.map((r) => alertOf(r, now)?.short.split(' ·')[0]).join(' · ') : 'All clear'} color={needs.length ? C.warn : C.good} delay={120} />
            <Kpi label="In progress" value={String(Math.round(shown.filter((r) => ['emailed', 'details_received', 'ordered'].includes(r.status)).length * t))} sub="emailed · details in · ordered" delay={200} />
            <Kpi label="Delivered" value={String(Math.round(shown.filter((r) => r.status === 'done').length * t))} sub="all time" color={C.lime} delay={280} />
            <Kpi label="Email → delivered" value={done.length ? (avg * t).toFixed(1) + 'd' : '—'} sub={done.length ? `average · fastest ${fastest} days` : 'no deliveries yet'} delay={360} />
          </div>

          <div className="grid a-up" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, animationDelay: '420ms' }}>
            {STAGES.map((st, ci) => {
              const items = shown.filter((r) => r.status === st.status)
              return (
                <div key={st.status} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, padding: 12, borderRadius: 14, background: '#111215', border: `1px solid ${C.line}` }}>
                  <div className="between" style={{ alignItems: 'center', padding: '2px 4px 6px' }}><span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: st.color }} />{st.name}</span><span className="mono caption">{items.length}</span></div>
                  {items.map((r, i) => {
                    const a = alertOf(r, now)
                    const warn = a && r.status !== 'done'
                    return (
                      <button key={r.key} className="a-up" onClick={() => { setSel(r.key); setOrderNo('') }} style={{ animationDelay: `${560 + (ci * 2 + i) * 80}ms`, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, width: '100%', padding: 12, borderRadius: 10, color: C.text, textAlign: 'left', cursor: 'pointer', transition: 'all .2s', background: sel === r.key ? '#1A1C20' : '#17191C', border: `1px solid ${warn ? '#3D2A0A' : sel === r.key ? '#3A3D44' : C.line}` }}>
                        <span className="between" style={{ width: '100%', alignItems: 'center' }}><b style={{ fontSize: 13 }}>{r.name}</b><span className="caption">{r.country}</span></span>
                        <span style={{ fontSize: 12, color: '#B4B8BF', lineHeight: 1.35 }}>{r.product}</span>
                        {warn && <span className="row" style={{ gap: 6, fontSize: 11, fontWeight: 500, color: C.warn }}><span className="a-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: C.warn }} />{a!.short}</span>}
                        <span style={{ fontSize: 11, color: C.faint }}>{r.status === 'done' && toDate(r.emailedAt) && toDate(r.doneAt) ? `Delivered ${fmt(r.doneAt)} · ${days(toDate(r.emailedAt)!, toDate(r.doneAt)!)} days` : `Bought ${fmt(r.purchaseDate)}`}</span>
                      </button>
                    )
                  })}
                  {items.length === 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #23262B', borderRadius: 10, fontSize: 12, color: C.ghost, textAlign: 'center', padding: 10 }}>{st.status === 'pending' ? 'Nothing new — pull from Redash' : 'Nothing here'}</div>}
                </div>
              )
            })}
          </div>

          <Card delay={560}>
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div><h2 className="h2">Order journeys</h2><div className="caption" style={{ marginTop: 4 }}>From purchase to delivery · who we were waiting for at each moment</div></div>
              <div className="row" style={{ gap: 14, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>{SEG.map(([n, c]) => <span key={n} className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 2, background: c }} />{n}</span>)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <div style={{ marginLeft: 150, position: 'relative', height: 16 }}>{ticks.map((d) => <span key={d.getTime()} className="mono" style={{ position: 'absolute', left: `${pos(d)}%`, transform: 'translateX(-50%)', fontSize: 11, color: C.faint }}>{fmt(d.toISOString())}</span>)}</div>
              {dated.map(({ r, pts }, i) => {
                const segs: { left: number; width: number; color: string; open: boolean; k: number }[] = []
                for (let k = 0; k < 4; k++) {
                  const a = pts[k]
                  if (!a) continue
                  const next = pts.slice(k + 1).find(Boolean)
                  const b = pts[k + 1] || (r.status === 'done' ? next : now)
                  if (!b) break
                  segs.push({ left: pos(a), width: Math.max(0.6, pos(b) - pos(a)), color: SEG[k][1], open: !pts[k + 1], k })
                  if (!pts[k + 1]) break
                }
                const end = pts[4] || now
                const start = pts[0] || pts[1]!
                return (
                  <button key={r.key} onClick={() => setSel(r.key)} className="row" style={{ gap: 12, width: '100%', padding: '6px 0', border: 'none', background: 'transparent', color: C.text, cursor: 'pointer' }}>
                    <span style={{ width: 138, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}><b style={{ fontSize: 13 }}>{r.name}</b><span style={{ fontSize: 11, color: C.faint }}>{pts[4] ? `${days(start, end)} days purchase → door` : `open · ${days(start, now)} days`}</span></span>
                    <span style={{ flex: 1, position: 'relative', height: 20, borderRadius: 6, background: '#0B0C0E' }}>
                      {segs.map((s) => <span key={s.k} className="a-gx" style={{ position: 'absolute', top: 3, bottom: 3, borderRadius: 4, left: `${s.left}%`, width: `${s.width}%`, background: s.color, backgroundImage: s.open ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.25) 0 4px, transparent 4px 8px)' : undefined, animationDelay: `${800 + i * 120 + s.k * 90}ms` }} />)}
                      {pts[4] && <span className="a-pop" style={{ position: 'absolute', top: 1, width: 18, height: 18, marginLeft: -9, borderRadius: '50%', background: C.good, left: `${pos(pts[4])}%`, boxShadow: '0 0 0 3px #111215', animationDelay: `${1300 + i * 120}ms` }} />}
                      <span style={{ position: 'absolute', top: -4, bottom: -4, left: `${pos(now)}%`, borderLeft: `1px dashed ${C.faint}` }} />
                    </span>
                  </button>
                )
              })}
              <div style={{ marginLeft: 150, position: 'relative', height: 14 }}><span style={{ position: 'absolute', left: `${pos(now)}%`, transform: 'translateX(-50%)', fontSize: 10, color: C.muted }}>today</span></div>
            </div>
          </Card>
        </>
      )}

      {cur && (
        <Drawer open onClose={() => setSel(null)} title={`Order ${cur.name}`}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div><div className="caption">Order · {cur.country}{cur.amount ? ` · ${Number(cur.amount).toLocaleString()} Buffs` : ''}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{cur.name}</div><div style={{ fontSize: 13, color: '#B4B8BF', marginTop: 4 }}>{cur.product}</div></div>
            <button className="icon-btn" aria-label="Close" onClick={() => setSel(null)}>{Icon.close}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {([['Purchased', cur.purchaseDate], ['Email #1 sent', cur.emailedAt], ['Details received', cur.detailsAt], ['Ordered on Amazon', cur.orderedAt], ['Delivered', cur.doneAt]] as const).map(([label, d], k, arr) => {
              const reached = arr.filter((x) => toDate(x[1])).length
              const has = !!toDate(d)
              const prev = k > 0 ? toDate(arr[k - 1][1]) : null
              return (
                <div key={label} className="row" style={{ gap: 12, alignItems: 'stretch', minHeight: 48 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3, boxSizing: 'border-box', background: has ? C.lime : 'transparent', border: has ? 'none' : `2px solid ${k === reached ? C.warn : C.line2}` }} />{k < 4 && <span style={{ flex: 1, width: 2, background: toDate(arr[k + 1][1]) ? C.lime : '#23262B' }} />}</div>
                  <div style={{ paddingBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 600, color: has ? C.text : k === reached ? C.warn : C.ghost }}>{label}{label === 'Ordered on Amazon' && cur.orderNumber ? ` · #${cur.orderNumber}` : ''}</div><div className="caption">{has ? `${fmt(d)}${prev && toDate(d) ? ` · +${days(prev, toDate(d)!)}d` : ''}` : k === reached ? 'Next step' : '—'}</div></div>
                </div>
              )
            })}
          </div>
          {curAlert && cur.status !== 'done' && <div style={{ padding: '12px 14px', borderRadius: 12, background: '#1A1408', border: '1px solid #3D2A0A', fontSize: 12, color: C.warn, lineHeight: 1.45 }}>{curAlert.long}</div>}
          {(cur.fullName || cur.address) && (
            <div style={{ padding: 14, borderRadius: 12, background: '#17191C', fontSize: 13, lineHeight: 1.6 }}>
              <div className="label" style={{ marginBottom: 6 }}>Ship to</div>
              <div>{cur.fullName}</div><div>{[cur.address, cur.apt].filter(Boolean).join(', ')}</div><div>{[cur.city, cur.state, cur.zip].filter(Boolean).join(', ')} · {cur.country}</div><div className="mono" style={{ color: C.muted }}>{cur.phone}</div>
            </div>
          )}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cur.status === 'pending' && <button className="btn primary" disabled={busy === cur.key} onClick={() => email1(cur)} style={{ height: 46, justifyContent: 'center' }}>{busy === cur.key ? 'Sending…' : 'Send email #1'}</button>}
            {cur.status === 'emailed' && <>
              <button className="btn primary" disabled={busy === cur.key} onClick={() => email1(cur)} style={{ height: 46, justifyContent: 'center' }}>Resend email with a new link</button>
              <button className="btn" onClick={() => copy(fulfillFormLink(cur.token), 'Form link')} style={{ justifyContent: 'center' }}>Copy form link</button>
            </>}
            {cur.status === 'details_received' && <>
              <div className="row"><input className="input mono" placeholder="Amazon order # e.g. 114-4934714-3860242" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} /></div>
              <button className="btn primary" disabled={!orderNo.trim() || busy === cur.key} onClick={() => act(cur, 'fulfillSetStatus', { token: cur.token, status: 'ordered', orderNumber: orderNo.trim() }, 'Marked as ordered')} style={{ height: 46, justifyContent: 'center' }}>Mark ordered</button>
            </>}
            {cur.status === 'ordered' && <>
              <button className="btn primary" disabled={busy === cur.key} onClick={() => act(cur, 'fulfillEmail2', { token: cur.token }, 'Confirmation sent')} style={{ height: 46, justifyContent: 'center' }}>Send "on its way" email</button>
              <button className="btn" disabled={busy === cur.key} onClick={() => act(cur, 'fulfillSetStatus', { token: cur.token, status: 'done' }, 'Marked as done')} style={{ justifyContent: 'center' }}>Mark done</button>
            </>}
            {(cur.fullName || cur.address) && <button className="btn" onClick={() => copy(orderCard(cur), 'Order card')} style={{ justifyContent: 'center' }}>Copy order card for Claude</button>}
          </div>
        </Drawer>
      )}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  )
}
