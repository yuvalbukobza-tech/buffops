import { useMemo, useState } from 'react'
import { DAYS_PER_MONTH, calcRealDaily, matchProduct, priceFromName, vendorOf } from '../../lib/calc'
import { useRedash, type Range } from '../../lib/redash'
import { useData } from '../../lib/store'
import type { AllocRow } from '../../lib/types'
import { C, Card, Icon, Seg, money, useEntrance } from '../../ui/kit'

export default function PlanVsActual() {
  const data = useData()
  const [range, setRange] = useState<Range>('17')
  const red = useRedash(range)
  const t = useEntrance(1300, 400)
  const [hv, setHv] = useState<string | null>(null)

  const result = useMemo(() => {
    const planned = new Map<string, number>()
    for (const rows of Object.values(data.allocs)) for (const r of rows || []) {
      const p = data.products.find((x) => x.id === r.productId)
      if (p) planned.set(vendorOf(p), (planned.get(vendorOf(p)) || 0) + calcRealDaily(p, r))
    }
    const actual = new Map<string, number>()
    let unmatched = 0
    const all: AllocRow[] = Object.values(data.allocs).flat().filter(Boolean)
    for (const row of red.rows || []) {
      const name = row.product_name || ''
      const v = (row.purchases || 0) * priceFromName(name)
      if (!v) continue
      // Match within the buyer's country first (more precise), then across all allocations (v1 behaviour).
      const m = matchProduct(name, data.allocs[(row.country || '').toUpperCase()] || [], data.products) || matchProduct(name, all, data.products)
      const p = m && !m.weak ? data.products.find((x) => x.id === m.alloc.productId) : null
      if (p) actual.set(vendorOf(p), (actual.get(vendorOf(p)) || 0) + v)
      else unmatched += v
    }
    const vendors = [...new Set([...planned.keys(), ...actual.keys()])].map((vendor) => {
      const plan = (planned.get(vendor) || 0) * red.days
      const act = actual.get(vendor) || 0
      return { vendor, perDay: planned.get(vendor) || 0, plan, act, gap: act - plan, util: plan ? (act / plan) * 100 : 0 }
    }).sort((a, b) => b.plan - a.plan)
    return { vendors, unmatched }
  }, [data, red.rows, red.days])

  const raffles = data.raffles.map((r) => ({ ...r, cost: ((r.marketPrice * r.timesPerMonth) / DAYS_PER_MONTH) * red.days }))
  const totPlan = result.vendors.reduce((a, v) => a + v.plan, 0)
  const totAct = result.vendors.reduce((a, v) => a + v.act, 0)
  const scale = Math.max(1, ...result.vendors.map((v) => Math.max(v.plan, v.act))) * 1.08
  const GRID = '1.3fr 0.9fr 1fr 1fr 1fr 0.8fr'

  return (
    <>
      <div className="between a-up" style={{ animationDelay: '80ms', alignItems: 'center' }}>
        <div className="caption">{red.from} → {red.to} · planned uses each product's expected utilization · real spend from Redash</div>
        <div className="row">
          {red.loading && <span className="caption row" style={{ gap: 8 }}><span style={{ width: 14, height: 14, border: `2px solid ${C.line2}`, borderTopColor: C.lime, borderRadius: '50%', animation: 'bo-spin .8s linear infinite' }} />Fetching Redash…</span>}
          <button className="icon-btn" aria-label="Refresh real data" onClick={red.refresh}>{Icon.refresh}</button>
          <Seg value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '17', label: '17 days' }, { value: '30', label: '30 days' }]} />
        </div>
      </div>
      {red.error && <div className="card" style={{ padding: '12px 16px', borderColor: '#4A1D1D', color: C.bad, fontSize: 13 }}>Redash didn't answer: {red.error}</div>}

      <Card delay={160}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div><h2 className="h2">Planned vs. real, by vendor</h2><div className="caption" style={{ marginTop: 4 }}>Light track = planned for {red.days} days · solid bar = real spend</div></div>
          <div style={{ textAlign: 'right' }}><div className="mono" style={{ fontSize: 22, fontWeight: 600, color: C.lime }}>{red.rows ? `${Math.round((totAct / Math.max(totPlan, 1)) * 100 * t)}%` : '—'}</div><div className="caption">{money(totAct)} real of {money(totPlan)} planned</div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
          {result.vendors.map((v, i) => {
            const col = v.util >= 90 ? C.lime : v.util >= 50 ? C.warn : C.bad
            return (
              <div key={v.vendor} onMouseEnter={() => setHv(v.vendor)} onMouseLeave={() => setHv(null)} style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: hv && hv !== v.vendor ? 0.4 : 1, transition: 'opacity .2s' }}>
                <div className="between" style={{ alignItems: 'baseline' }}><span style={{ fontWeight: 600 }}>{v.vendor}</span><span className="mono" style={{ fontSize: 13 }}><span style={{ color: col }}>{red.rows ? money(v.act) : '…'}</span> <span style={{ color: C.faint }}>/ {money(v.plan)} · {red.rows ? Math.round(v.util) + '%' : ''}</span></span></div>
                <div style={{ position: 'relative', height: 26, borderRadius: 8, background: '#141518', overflow: 'hidden' }}>
                  <span className="a-gx" style={{ position: 'absolute', inset: '0 auto 0 0', width: `${(v.plan / scale) * 100}%`, background: '#23262B', borderRadius: 8, animationDelay: `${300 + i * 120}ms` }} />
                  {red.rows && <span className="a-gx" style={{ position: 'absolute', top: 5, bottom: 5, left: 0, width: `${(v.act / scale) * 100}%`, background: col, borderRadius: 5, animationDelay: `${600 + i * 120}ms` }} />}
                  <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${(v.plan / scale) * 100}%`, borderLeft: '2px solid #EDEEF0', opacity: 0.6 }} />
                </div>
              </div>
            )
          })}
        </div>
        {red.rows && result.unmatched > 0 && <div className="caption" style={{ marginTop: 14 }}>{money(result.unmatched)} of real spend could not be matched to a planned product (other countries or products without a plan).</div>}
      </Card>

      <Card pad={false} delay={260} style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 720 }}>
          <div className="thead" style={{ gridTemplateColumns: GRID }}><span>Vendor</span><span>Plan / day</span><span>Plan · {red.days}d</span><span>Real</span><span>Gap</span><span>Util</span></div>
          {result.vendors.map((v) => (
            <div key={v.vendor} className="trow" style={{ gridTemplateColumns: GRID, height: 46 }}>
              <b style={{ fontWeight: 600 }}>{v.vendor}</b><span className="mono" style={{ color: C.muted }}>{money(v.perDay, 2)}</span><span className="mono">{money(v.plan)}</span>
              <span className="mono" style={{ color: C.lime }}>{red.rows ? money(v.act) : '—'}</span>
              <span className="mono" style={{ color: !red.rows ? C.faint : v.gap >= 0 ? C.good : -v.gap < 0.2 * totPlan ? C.warn : C.bad }}>{red.rows ? (v.gap >= 0 ? '+' : '−') + money(Math.abs(v.gap)) : '—'}</span>
              <span className="mono">{red.rows ? Math.round(v.util) + '%' : '—'}</span>
            </div>
          ))}
          <div style={{ padding: '10px 18px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: C.violet }}>RAFFLES · PLAN = ACTUAL</div>
          {raffles.map((r) => (
            <div key={r.id} className="trow" style={{ gridTemplateColumns: GRID, height: 40, color: C.muted }}>
              <span>{r.name} <span style={{ fontSize: 11, color: C.faint }}>{r.vendor}</span></span><span className="mono">{money(r.cost / red.days, 2)}</span><span className="mono">{money(r.cost)}</span><span className="mono">{money(r.cost)}</span><span className="mono">+$0</span><span className="mono">100%</span>
            </div>
          ))}
          <div className="trow" style={{ gridTemplateColumns: GRID, height: 46, background: '#141518', fontWeight: 600 }}>
            <span>Total</span><span /><span className="mono">{money(totPlan + raffles.reduce((a, r) => a + r.cost, 0))}</span><span className="mono" style={{ color: C.lime }}>{red.rows ? money(totAct + raffles.reduce((a, r) => a + r.cost, 0)) : '—'}</span><span /><span />
          </div>
        </div>
      </Card>
    </>
  )
}
