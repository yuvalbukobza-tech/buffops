import { useEffect, useMemo, useState } from 'react'
import { fetchRedash } from '../lib/api'
import { COUNTRIES, DAYS_PER_MONTH, priceFromName, summarizeCountry, vendorBudgets } from '../lib/calc'
import { useData } from '../lib/store'
import { DEPTS, type RedashRow, type Transaction } from '../lib/types'
import { C, Card, Icon, Kpi, Seg, money, useEntrance } from '../ui/kit'

type Range = '7' | '17' | '30'
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const VENDOR_COLORS = [C.lime, C.sky, C.violet, C.orange, C.pink, C.good]
const DEPT_META: Record<string, [string, string]> = { productDesktop: ['Product Desktop', C.lime], productMobile: ['Product Mobile', C.sky], marketing: ['Marketing', C.orange], buffPay: ['Buff Pay', C.violet], dataProject: ['Data project', C.pink] }

// Redash results are cached per range for the browser session — the query is slow (≈1 min).
const cache = new Map<string, RedashRow[]>()
function useRedash(range: Range) {
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

function squarify<T extends { v: number }>(items: T[], x: number, y: number, w: number, h: number): (T & { x: number; y: number; w: number; h: number })[] {
  if (items.length === 0) return []
  if (items.length === 1) return [{ ...items[0], x, y, w, h }]
  const sum = items.reduce((a, b) => a + b.v, 0)
  let run = 0, k = 0
  while (k < items.length - 1 && run + items[k].v <= sum / 2) { run += items[k].v; k++ }
  if (k === 0) { run = items[0].v; k = 1 }
  const A = items.slice(0, k), B = items.slice(k)
  if (w >= h) { const wa = (w * run) / sum; return [...squarify(A, x, y, wa, h), ...squarify(B, x + wa, y, w - wa, h)] }
  const ha = (h * run) / sum
  return [...squarify(A, x, y, w, ha), ...squarify(B, x, y + ha, w, h - ha)]
}

function monthKey(t: Transaction) { return (t.dateRequested || '').slice(0, 7) }

export default function Dashboard({ go }: { go: (r: 'countries') => void }) {
  const data = useData()
  const [range, setRange] = useState<Range>('7')
  const red = useRedash(range)
  const t = useEntrance()
  const [hc, setHc] = useState<string | null>(null)
  const [hv, setHv] = useState<string | null>(null)
  const [ht, setHt] = useState<string | null>(null)
  const [hm, setHm] = useState<string | null>(null)

  const countries = useMemo(() => COUNTRIES.map((c) => summarizeCountry(c, data.allocs, data.products)).filter((s) => s.rows.length > 0).sort((a, b) => b.real - a.real), [data])
  const actualBy = useMemo(() => {
    const m = new Map<string, number>()
    const prod = new Map<string, { v: number; units: number }>()
    for (const r of red.rows || []) {
      const v = (r.purchases || 0) * priceFromName(r.product_name)
      const c = (r.country || '??').toUpperCase()
      m.set(c, (m.get(c) || 0) + v)
      const n = r.product_name || 'Unknown'
      const e = prod.get(n) || { v: 0, units: 0 }
      e.v += v; e.units += r.purchases || 0
      prod.set(n, e)
    }
    return { byCountry: m, byProduct: prod }
  }, [red.rows])
  const totalActual = [...actualBy.byCountry.values()].reduce((a, b) => a + b, 0)
  const plannedDaily = countries.reduce((a, c) => a + c.real, 0)
  const actualInPlan = countries.reduce((a, c) => a + (actualBy.byCountry.get(c.country) || 0), 0) / red.days
  const delivery = plannedDaily ? (actualInPlan / plannedDaily) * 100 : 0

  const vendors = useMemo(() => vendorBudgets(data.allocs, data.products, data.raffles, data.budgetExtras), [data])
  const vTotal = vendors.reduce((a, v) => a + v.monthly, 0)
  const pending = data.transactions.filter((x) => x.status === 'pending')

  // transfers, last 12 months
  const months = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const txs = data.transactions.filter((x) => monthKey(x) === key)
      const split: Record<string, number> = {}
      for (const x of txs) for (const k of DEPTS) split[k] = (split[k] || 0) + (Number(x[k]) || 0)
      const total = Object.values(split).reduce((a, b) => a + b, 0)
      return { key, label: d.toLocaleString('en-US', { month: 'short' }), total, split, count: txs.length, partial: i === 11 }
    })
  }, [data.transactions])
  const maxM = Math.max(1, ...months.map((m) => m.total))
  const sum12 = months.reduce((a, m) => a + m.total, 0)

  // treemap of real spend by product
  const tiles = useMemo(() => {
    const list = [...actualBy.byProduct.entries()].map(([name, e]) => ({ name, v: e.v, units: e.units })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
    const top = list.slice(0, 10)
    const rest = list.slice(10).reduce((a, b) => a + b.v, 0)
    const items = rest > 0 ? [...top, { name: `Other (${list.length - 10})`, v: rest, units: 0 }] : top
    return squarify(items, 0, 0, 640, 270)
  }, [actualBy])
  const SH = [C.lime, '#B6E600', '#9FCC00', '#86B000', '#6E9200', '#5E7D00', '#506A00', '#435800', '#384A00', '#2F3E00', '#2A2D33']

  const hcItem = countries.find((c) => c.country === hc)
  const htItem = tiles.find((x) => x.name === ht)
  const hvItem = vendors.find((v) => v.vendor === hv)
  const hmItem = months.find((m) => m.key === hm)
  const circ = 2 * Math.PI * 80
  let acc = 0

  return (
    <div className="page">
      <div className="between a-up">
        <div>
          <h1 className="h1">Dashboard</h1>
          <div className="sub">Real spend from Redash vs. your plan · {red.from} → {red.to} ({red.days} days)</div>
        </div>
        <div className="row">
          {red.loading && <span className="caption row" style={{ gap: 8 }}><span style={{ width: 14, height: 14, border: `2px solid ${C.line2}`, borderTopColor: C.lime, borderRadius: '50%', animation: 'bo-spin .8s linear infinite' }} />Fetching Redash… about a minute</span>}
          <button className="icon-btn" aria-label="Refresh real data" onClick={red.refresh} disabled={red.loading}>{Icon.refresh}</button>
          <Seg value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '17', label: '17 days' }, { value: '30', label: '30 days' }]} />
        </div>
      </div>
      {red.error && <div className="card" style={{ padding: '12px 16px', borderColor: '#4A1D1D', color: C.bad, fontSize: 13 }}>Redash didn't answer: {red.error}. Plan numbers below are still correct. <button className="btn small" onClick={red.refresh}>Try again</button></div>}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Kpi label="Real spend" value={red.rows ? money(totalActual * t) : '—'} sub={red.rows ? `${money(totalActual / red.days, 2)} / day · ${[...actualBy.byCountry.keys()].filter((k) => k !== '??').length} countries` : 'waiting for Redash'} color={C.lime} accent delay={120} />
        <Kpi label="Plan delivery" value={red.rows ? Math.round(delivery * t) + '%' : '—'} sub={`${money(actualInPlan, 2)} of ${money(plannedDaily, 2)} / day planned`} delay={200} />
        <Kpi label="Monthly budget" value={money(vTotal * t)} sub={vendors.map((v) => v.vendor).join(' · ')} delay={280} />
        <Kpi label="Pending transfers" value={money(pending.reduce((a, x) => a + (x.totalAmount || 0), 0) * t)} sub={`${pending.length} request${pending.length === 1 ? '' : 's'}`} color={pending.length ? C.warn : C.text} delay={360} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 }}>
        <Card delay={380}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div><h2 className="h2">Plan delivery by country</h2><div className="caption" style={{ marginTop: 4 }}>Real spend per day as a share of the planned (utilized) budget</div></div>
            <div style={{ textAlign: 'right', minHeight: 38 }}>
              <div className="mono" style={{ fontSize: 13 }}>{hcItem ? `${hcItem.country} · ${Math.round(((actualBy.byCountry.get(hcItem.country) || 0) / red.days / hcItem.real) * 100)}% delivered` : `${Math.round(delivery)}% overall`}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{hcItem ? `${money((actualBy.byCountry.get(hcItem.country) || 0) / red.days, 2)} real vs ${money(hcItem.real, 2)} planned / day` : 'Hover a country · click to open it'}</div>
            </div>
          </div>
          <div style={{ position: 'relative', marginTop: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ position: 'absolute', top: -18, bottom: 0, left: 'calc(64px + (100% - 140px) * 0.8333)', borderLeft: `1px dashed ${C.ghost}`, pointerEvents: 'none', zIndex: 1 }}><span style={{ position: 'absolute', left: 6, fontSize: 10, color: C.faint, whiteSpace: 'nowrap' }}>100% = plan</span></div>
            {countries.map((c, i) => {
              const real = (actualBy.byCountry.get(c.country) || 0) / red.days
              const p = c.real ? (real / c.real) * 100 : 0
              const col = p >= 90 ? C.lime : p >= 50 ? C.warn : C.bad
              const on = hc === c.country
              return (
                <button key={c.country} onMouseEnter={() => setHc(c.country)} onMouseLeave={() => setHc(null)} onClick={() => go('countries')}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', color: C.text, background: on ? '#17191C' : 'transparent', transition: 'background .2s' }}>
                  <span style={{ width: 44, fontWeight: 600, fontSize: 13, textAlign: 'left' }}>{c.country}</span>
                  <span style={{ flex: 1, height: 22, borderRadius: 6, background: '#17191C', position: 'relative', overflow: 'hidden' }}>
                    {red.rows && <span className="a-gx" style={{ position: 'absolute', inset: '0 auto 0 0', borderRadius: 6, width: `${Math.max(1.2, (Math.min(p, 120) / 120) * 100)}%`, background: col, opacity: hc && !on ? 0.35 : 1, transition: 'opacity .2s', animationDelay: `${520 + i * 90}ms` }} />}
                  </span>
                  <span className="mono" style={{ width: 56, textAlign: 'right', fontSize: 13, fontWeight: 600, color: red.rows ? col : C.ghost }}>{red.rows ? Math.round(p) + '%' : '—'}</span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card delay={500}>
          <h2 className="h2">Monthly budget by vendor</h2>
          <div className="caption" style={{ marginTop: 4 }}>Products (utilized) + raffles + fixed items</div>
          <div className="row" style={{ gap: 26, marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 210, height: 210, flexShrink: 0 }}>
              <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="105" cy="105" r="80" fill="none" stroke="#17191C" strokeWidth="26" />
                {vendors.map((v, i) => {
                  const len = (v.monthly / vTotal) * circ * t
                  const el = <circle key={v.vendor} cx="105" cy="105" r="80" fill="none" stroke={VENDOR_COLORS[i % 6]} strokeWidth={hv === v.vendor ? 32 : 26} strokeDasharray={`${Math.max(0, len - 3)} ${circ}`} strokeDashoffset={-acc}
                    style={{ cursor: 'pointer', opacity: hv && hv !== v.vendor ? 0.3 : 1, transition: 'stroke-width .25s, opacity .25s' }} onMouseEnter={() => setHv(v.vendor)} onMouseLeave={() => setHv(null)} />
                  acc += len
                  return el
                })}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 12, color: C.muted }}>{hvItem ? hvItem.vendor : 'Per month'}</span>
                <span className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{money((hvItem ? hvItem.monthly : vTotal) * (hvItem ? 1 : t))}</span>
                <span style={{ fontSize: 12, color: C.faint }}>{hvItem ? `${((hvItem.monthly / vTotal) * 100).toFixed(1)}% of month` : 'all vendors'}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vendors.map((v, i) => (
                <div key={v.vendor} onMouseEnter={() => setHv(v.vendor)} onMouseLeave={() => setHv(null)} className="row" style={{ padding: '9px 12px', borderRadius: 10, background: hv === v.vendor ? '#1A1C20' : 'transparent', transition: 'background .2s' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: VENDOR_COLORS[i % 6] }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{v.vendor}</span>
                  <span className="mono" style={{ fontSize: 13 }}>{money(v.monthly)}</span>
                  <span className="mono" style={{ fontSize: 12, color: C.faint, width: 48, textAlign: 'right' }}>{((v.monthly / vTotal) * 100).toFixed(1)}%</span>
                </div>
              ))}
              <div className="caption">{money(vTotal / DAYS_PER_MONTH * 15)} per 15 days</div>
            </div>
          </div>
        </Card>

        <Card delay={640}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div><h2 className="h2">Where the money went</h2><div className="caption" style={{ marginTop: 4 }}>Real spend by product · area = share of {red.rows ? money(totalActual) : '…'}</div></div>
            <div style={{ textAlign: 'right', minHeight: 38 }}>
              <div className="mono" style={{ fontSize: 13 }}>{htItem ? `${htItem.name} · ${money(htItem.v)}` : 'Hover a tile'}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{htItem ? `${((htItem.v / totalActual) * 100).toFixed(1)}% of spend${htItem.units ? ` · ${htItem.units} units` : ''}` : ''}</div>
            </div>
          </div>
          <div style={{ position: 'relative', height: 270, marginTop: 14 }}>
            {!red.rows && <div className="caption" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${C.line2}`, borderRadius: 12 }}>{red.loading ? 'Loading real spend…' : 'No data yet'}</div>}
            {tiles.map((r, i) => {
              const on = ht === r.name
              return (
                <div key={r.name} className="a-pop" onMouseEnter={() => setHt(r.name)} onMouseLeave={() => setHt(null)}
                  style={{ position: 'absolute', left: `${(r.x / 640) * 100}%`, top: r.y, width: `calc(${(r.w / 640) * 100}% - 3px)`, height: r.h - 3, borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', color: i < 4 ? '#0B0C0E' : C.text, background: SH[i] || '#2A2D33', opacity: ht && !on ? 0.45 : 1, transition: 'opacity .25s', animationDelay: `${760 + i * 70}ms` }}>
                  <span style={{ fontSize: r.w > 140 && r.h > 70 ? 15 : 11, fontWeight: 600, lineHeight: 1.2 }}>{r.name.replace(' Gift Card', '').replace(' Access Code US', '').replace(' Wallet Code', '')}</span>
                  <span className="mono" style={{ fontSize: 12, opacity: 0.8 }}>{money(r.v)}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card delay={760}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div><h2 className="h2">Finance transfers</h2><div className="caption" style={{ marginTop: 4 }}>Last 12 months by department</div></div>
            <div style={{ textAlign: 'right', minHeight: 38 }}>
              <div className="mono" style={{ fontSize: 13 }}>{hmItem ? `${hmItem.label}${hmItem.partial ? ' (so far)' : ''} · ${money(hmItem.total)}` : `${money(sum12)} in 12 months`}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{hmItem ? Object.entries(hmItem.split).filter(([, v]) => v).map(([k, v]) => `${DEPT_META[k][0].replace('Product ', '')} ${money(v)}`).join(' · ') : 'Hover a month for the split'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, borderBottom: '1px solid #23262B', marginTop: 14 }}>
            {months.map((m, i) => (
              <div key={m.key} onMouseEnter={() => setHm(m.key)} onMouseLeave={() => setHm(null)} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', borderRadius: 6, background: hm === m.key ? '#17191C' : 'transparent' }}>
                <div className="a-gy" style={{ width: '100%', height: `${(m.total / maxM) * 100}%`, display: 'flex', flexDirection: 'column-reverse', borderRadius: 5, overflow: 'hidden', opacity: hm && hm !== m.key ? 0.4 : 1, transition: 'opacity .2s', animationDelay: `${880 + i * 60}ms` }}>
                  {DEPTS.filter((k) => m.split[k]).map((k) => <div key={k} style={{ height: `${(m.split[k] / m.total) * 100}%`, background: DEPT_META[k][1], borderTop: '1px solid #111215' }} />)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>{months.map((m) => <span key={m.key} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: hm === m.key ? C.text : C.faint }}>{m.label}</span>)}</div>
        </Card>
      </div>
    </div>
  )
}
