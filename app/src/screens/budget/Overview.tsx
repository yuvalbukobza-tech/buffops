import { useMemo, useState } from 'react'
import { DAYS_PER_MONTH, VENDORS, calcRealDaily, vendorBudgets } from '../../lib/calc'
import { useData, useStore } from '../../lib/store'
import type { BudgetExtra } from '../../lib/types'
import { C, Card, Drawer, Icon, money, useEntrance } from '../../ui/kit'
import type { FinancePrefill } from './Finance'

const VC = [C.lime, C.sky, C.violet, C.orange, C.pink, C.good]
const PC: Record<string, string> = { MP: '#EDEEF0', 'Buff Pass': C.orange, Raffles: C.pink }
const PNAME: Record<string, string> = { MP: 'Marketplace', 'Buff Pass': 'Buff Pass', Raffles: 'Raffles' }

function ExtraDrawer({ extra, onClose }: { extra: BudgetExtra | null; onClose: () => void }) {
  const { update } = useStore()
  const [f, setF] = useState<BudgetExtra>(extra || { id: Date.now(), name: '', vendor: 'GCOW', purpose: 'MP', monthly: 0 })
  const save = () => {
    update((s) => ({ ...s, budgetExtras: extra ? s.budgetExtras.map((e) => (e.id === extra.id ? f : e)) : [...s.budgetExtras, f] }))
    onClose()
  }
  const remove = () => {
    if (!extra || !window.confirm(`Delete fixed item "${extra.name}"?`)) return
    update((s) => ({ ...s, budgetExtras: s.budgetExtras.filter((e) => e.id !== extra.id) }))
    onClose()
  }
  return (
    <Drawer open onClose={onClose} title="Fixed monthly item">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">{extra ? 'Edit' : 'Add'} fixed monthly item</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{f.name || 'New item'}</div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Name</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Amazon" /></label>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Vendor</span><select className="input" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>{VENDORS.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Purpose</span><select className="input" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })}>{['MP', 'Buff Pass', 'Raffles'].map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Per month (USD)</span><input className="input mono" type="number" min={0} value={f.monthly || ''} onChange={(e) => setF({ ...f, monthly: Math.max(0, Number(e.target.value) || 0) })} /></label>
      <div className="row" style={{ marginTop: 'auto' }}>
        {extra && <button className="btn" onClick={remove} style={{ color: C.bad, borderColor: '#4A1D1D' }}>Delete</button>}
        <button className="btn primary" onClick={save} disabled={!f.name.trim() || !(f.monthly > 0)} style={{ flex: 1, justifyContent: 'center', height: 44 }}>{extra ? 'Save' : 'Add item'}</button>
      </div>
    </Drawer>
  )
}

export default function Overview({ requestTransfer }: { requestTransfer: (p: FinancePrefill) => void }) {
  const data = useData()
  const t = useEntrance(1300, 300)
  const [hv, setHv] = useState<string | null>(null)
  const [hp, setHp] = useState<string | null>(null)
  const [extra, setExtra] = useState<BudgetExtra | null | 'new'>(null)

  const vendors = useMemo(() => vendorBudgets(data.allocs, data.products, data.raffles, data.budgetExtras).filter((v) => v.monthly > 0), [data])
  const total = vendors.reduce((a, v) => a + v.monthly, 0)
  const purposes = ['MP', 'Buff Pass', 'Raffles'].filter((p) => vendors.some((v) => v.byPurpose[p]))
  const pt: Record<string, number> = Object.fromEntries(purposes.map((p) => [p, vendors.reduce((a, v) => a + (v.byPurpose[p] || 0), 0)]))

  // Sankey geometry (viewBox 1180 × 330)
  const H = 330, gap = 18, LX = 170, RX = 998, NW = 12
  const k = (H - gap * Math.max(vendors.length, purposes.length, 1)) / Math.max(total, 1)
  const ly: Record<string, number> = {}, ry: Record<string, number> = {}
  let y = 0
  vendors.forEach((v) => { ly[v.vendor] = y; y += v.monthly * k + gap })
  y = 0
  purposes.forEach((p) => { ry[p] = y; y += pt[p] * k + gap })
  const lo = { ...ly }, ro = { ...ry }
  const bands: { key: string; d: string; color: string; amt: number; v: string; p: string }[] = []
  vendors.forEach((v, i) => purposes.forEach((p) => {
    const amt = v.byPurpose[p] || 0
    if (!amt) return
    const h = amt * k, y0 = lo[v.vendor], y1 = ro[p]
    lo[v.vendor] += h; ro[p] += h
    const x0 = LX + NW, x1 = RX, xm = (x0 + x1) / 2
    bands.push({ key: `${v.vendor}|${p}`, v: v.vendor, p, amt, color: VC[i % VC.length], d: `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h} C${xm},${y1 + h} ${xm},${y0 + h} ${x0},${y0 + h} Z` })
  }))
  const hb = bands.find((b) => b.key === hv)
  const focus = hb ? { value: money(hb.amt), sub: `${hb.v} → ${PNAME[hb.p]} · ${((hb.amt / total) * 100).toFixed(1)}%` }
    : hv && vendors.find((v) => v.vendor === hv) ? { value: money(vendors.find((v) => v.vendor === hv)!.monthly), sub: `${hv} · ${((vendors.find((v) => v.vendor === hv)!.monthly / total) * 100).toFixed(1)}% of the month` }
    : hp ? { value: money(pt[hp]), sub: `${PNAME[hp]} · ${((pt[hp] / total) * 100).toFixed(1)}% of the month` }
    : { value: money(total * t), sub: 'Total per month · hover a band' }
  const lit = (b: { v: string; p: string; key: string }) => hv === b.key || hv === b.v || hp === b.p

  const global = data.allocs.GLOBAL || []
  const globalMonthly = global.reduce((a, r) => { const p = data.products.find((x) => x.id === r.productId); return a + (p ? calcRealDaily(p, r) * DAYS_PER_MONTH : 0) }, 0)
  const raffleTotal = data.raffles.reduce((a, r) => a + r.marketPrice * r.timesPerMonth, 0)

  return (
    <>
      <Card delay={140} style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div><h2 className="h2">Money flow · per month</h2><div className="caption" style={{ marginTop: 4 }}>Vendor on the left, purpose on the right. Band width = dollars.</div></div>
          <div style={{ textAlign: 'right', minHeight: 40 }}><div className="mono" style={{ fontSize: 22, fontWeight: 600, color: C.lime }}>{focus.value}</div><div style={{ fontSize: 12, color: C.muted }}>{focus.sub}</div></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <svg className="a-sweep" viewBox="0 0 1180 330" style={{ display: 'block', width: '100%', minWidth: 760, overflow: 'visible', animationDelay: '420ms' }}>
            {bands.map((b) => <path key={b.key} d={b.d} fill={b.color} style={{ cursor: 'default', transition: 'opacity .25s', opacity: hv || hp ? (lit(b) ? 0.75 : 0.08) : 0.32 }} onMouseEnter={() => { setHv(b.key); setHp(null) }} onMouseLeave={() => setHv(null)} />)}
            {vendors.map((v, i) => {
              const h = Math.max(3, v.monthly * k), cy = ly[v.vendor] + h / 2
              return <g key={v.vendor} onMouseEnter={() => { setHv(v.vendor); setHp(null) }} onMouseLeave={() => setHv(null)}><rect x={LX} y={ly[v.vendor]} width={NW} height={h} rx={3} fill={VC[i % VC.length]} /><text x={LX - 14} y={h < 30 ? cy - 2 : cy} textAnchor="end" fill={C.text} style={{ font: '600 14px Geist, sans-serif' }}>{v.vendor}</text><text x={LX - 14} y={(h < 30 ? cy - 2 : cy) + 17} textAnchor="end" fill={C.muted} style={{ font: '12px var(--mono)' }}>{money(v.monthly)}</text></g>
            })}
            {purposes.map((p) => {
              const h = Math.max(3, pt[p] * k), cy = ry[p] + h / 2
              return <g key={p} onMouseEnter={() => { setHp(p); setHv(null) }} onMouseLeave={() => setHp(null)}><rect x={RX} y={ry[p]} width={NW} height={h} rx={3} fill={PC[p]} /><text x={RX + NW + 14} y={h < 30 ? cy - 2 : cy} fill={C.text} style={{ font: '600 14px Geist, sans-serif' }}>{PNAME[p]}</text><text x={RX + NW + 14} y={(h < 30 ? cy - 2 : cy) + 17} fill={C.muted} style={{ font: '12px var(--mono)' }}>{money(pt[p])}</text></g>
            })}
          </svg>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {vendors.map((v, i) => {
          const halfMonth = Math.round((v.monthly / DAYS_PER_MONTH) * 15)
          return (
            <div key={v.vendor} className="card a-up" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, animationDelay: `${560 + i * 110}ms` }}>
              <div className="between" style={{ alignItems: 'center' }}><span className="row" style={{ gap: 10, fontWeight: 600, fontSize: 15 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: VC[i % VC.length] }} />{v.vendor}</span><span className="caption">{Math.round((v.monthly / total) * 100)}% of budget</span></div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div><div className="caption">Per day</div><div className="mono" style={{ fontSize: 15, marginTop: 4 }}>{money(v.monthly / DAYS_PER_MONTH, 2)}</div></div>
                <div><div className="caption">Per 15 days</div><div className="mono" style={{ fontSize: 15, marginTop: 4, color: C.lime, fontWeight: 600 }}>{money(halfMonth)}</div></div>
                <div><div className="caption">Per month</div><div className="mono" style={{ fontSize: 15, marginTop: 4 }}>{money(v.monthly)}</div></div>
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#17191C' }}>
                {purposes.filter((p) => v.byPurpose[p]).map((p) => <span key={p} className="a-gx" style={{ height: '100%', width: `${(v.byPurpose[p] / v.monthly) * 100}%`, background: PC[p], animationDelay: `${820 + i * 110}ms` }} />)}
              </div>
              <div className="row" style={{ gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>{purposes.filter((p) => v.byPurpose[p]).map((p) => <span key={p}>{PNAME[p]} {Math.round((v.byPurpose[p] / v.monthly) * 100)}%</span>)}</div>
              <button className="btn" onClick={() => requestTransfer({ vendor: v.vendor, amount: halfMonth })} style={{ justifyContent: 'center' }}>Request {money(halfMonth)} transfer <span style={{ color: C.faint }}>→</span></button>
            </div>
          )
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        <Card delay={900} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="between" style={{ alignItems: 'center' }}><h2 className="h2">Raffles plan</h2><span className="mono" style={{ fontSize: 13, color: C.violet }}>{money(raffleTotal)} / month</span></div>
          {data.raffles.map((r, ri) => (
            <div key={r.id} className="row" style={{ gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, fontWeight: 500 }}>{r.name}</span>
              <span style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>{Array.from({ length: Math.min(r.timesPerMonth, 31) }, (_, j) => <span key={j} className="a-pop" style={{ width: 8, height: 8, borderRadius: '50%', background: C.violet, animationDelay: `${1150 + ri * 60 + j * 35}ms` }} />)}</span>
              <span className="caption" style={{ width: 70 }}>{r.vendor}</span>
              <span className="mono" style={{ width: 64, textAlign: 'right' }}>{money(r.marketPrice * r.timesPerMonth)}</span>
            </div>
          ))}
          {data.raffles.length === 0 && <div className="caption">No raffles.</div>}
          <div className="caption">One dot = one draw per month · edit raffles in Products → Raffles</div>
        </Card>
        <Card delay={1000} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="between" style={{ alignItems: 'center' }}><h2 className="h2">Fixed monthly items</h2><button className="btn small primary" onClick={() => setExtra('new')}>{Icon.plus}Add item</button></div>
          {data.budgetExtras.map((e) => (
            <div key={e.id} className="row" style={{ gap: 12, padding: '12px 14px', borderRadius: 12, background: '#17191C', fontSize: 13 }}>
              <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{e.name}</b><span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 2 }}>{e.vendor} · {e.purpose}</span></span>
              <span className="mono" style={{ fontWeight: 600 }}>{money(e.monthly)}</span>
              <button className="icon-btn" aria-label={`Edit ${e.name}`} onClick={() => setExtra(e)}>{Icon.edit}</button>
            </div>
          ))}
          {data.budgetExtras.length === 0 && <div className="caption">No fixed items.</div>}
          {global.length > 0 && (
            <div className="row" style={{ marginTop: 'auto', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#17191C', fontSize: 12, color: C.muted }}>
              {Icon.warn}<span>{global.length} allocations under "GLOBAL" add {money(globalMonthly)} / month to this budget but have no country screen.</span>
            </div>
          )}
        </Card>
      </div>
      {extra && <ExtraDrawer extra={extra === 'new' ? null : extra} onClose={() => setExtra(null)} />}
    </>
  )
}
