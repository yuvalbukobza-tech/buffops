import { useMemo, useState } from 'react'
import { COUNTRIES, CURRENCIES, DAYS_PER_MONTH, DEMAND_LEVELS, calcDailyBudget, calcPriceUSD, calcRealDaily, calcUtilization, isAllocActive, summarizeCountry } from '../lib/calc'
import { useData, useStore } from '../lib/store'
import type { AllocRow, AppState, Product } from '../lib/types'
import { C, Card, DemandChip, Drawer, Icon, Kpi, Toggle, UtilBar, money, useEntrance } from '../ui/kit'

const GRID = '56px 1.5fr 0.7fr 0.9fr 0.8fr 1.3fr 0.8fr 0.8fr 0.9fr 44px'
const PURPOSES: [string, string][] = [['MP', C.lime], ['Raffles', C.violet], ['Buff Pass', C.sky]]
const SHADES = [C.lime, '#A8D600', '#89B000', '#6C8B00', '#526A00', '#3F5200', '#2A2D33']

function setRow(s: AppState, country: string, productId: number, patch: Partial<AllocRow>): AppState {
  return { ...s, allocs: { ...s.allocs, [country]: (s.allocs[country] || []).map((r) => (r.productId === productId ? { ...r, ...patch } : r)) } }
}

function Stepper({ label, value, onChange, min = 1, max = 99, hint }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="caption" style={{ color: C.muted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', height: 44, borderRadius: 10, border: `1px solid ${C.line2}`, background: '#0B0C0E' }}>
        <button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 44, height: 42, border: 'none', background: 'transparent', color: C.text, fontSize: 18, cursor: 'pointer' }}>−</button>
        <span className="mono" style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 600 }}>{value}</span>
        <button aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 44, height: 42, border: 'none', background: 'transparent', color: C.text, fontSize: 18, cursor: 'pointer' }}>+</button>
      </div>
      {hint && <span style={{ fontSize: 11, color: C.faint }}>{hint}</span>}
    </div>
  )
}

function EditDrawer({ country, productId, onClose }: { country: string; productId: number; onClose: () => void }) {
  const data = useData()
  const { update } = useStore()
  const row = (data.allocs[country] || []).find((r) => r.productId === productId)
  const prod = data.products.find((p) => p.id === productId)
  if (!row || !prod) return null
  const on = isAllocActive(row)
  const setR = (patch: Partial<AllocRow>) => update((s) => setRow(s, country, productId, patch))
  const setP = (patch: Partial<Product>) => update((s) => ({ ...s, products: s.products.map((p) => (p.id === productId ? { ...p, ...patch } : p)) }))
  const u = calcUtilization(String(prod.demandLevel), row.pulsesPerDay)
  const plan = calcDailyBudget(prod, { ...row, active: true })
  const remove = () => {
    if (!window.confirm(`Remove ${prod.brand} from ${country}? To keep it but pause it, turn it off instead.`)) return
    update((s) => ({ ...s, allocs: { ...s.allocs, [country]: (s.allocs[country] || []).filter((r) => r.productId !== productId) } }))
    onClose()
  }
  return (
    <Drawer open onClose={onClose} title={`Edit ${prod.brand}`}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">Edit · {country}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{prod.brand} <span style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>{prod.type}</span></div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: on ? 'rgba(200,255,0,0.05)' : '#17191C', border: `1px solid ${on ? 'rgba(200,255,0,0.2)' : C.line2}`, transition: 'all .3s' }}>
        <div><div style={{ fontWeight: 600, color: on ? C.lime : C.bad }}>{on ? 'Active' : 'Paused'}</div><div className="caption" style={{ marginTop: 2 }}>{on ? `Counted in the ${country} budget` : `Stays in ${country}, counts as $0`}</div></div>
        <Toggle on={on} onChange={(v) => setR({ active: v })} label="Active" />
      </div>
      <div className="label">This country</div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Stepper label="Drops / day" value={row.pulsesPerDay} max={24} onChange={(v) => setR({ pulsesPerDay: v })} hint={`every ${(24 / row.pulsesPerDay).toFixed(1)}h`} />
        <Stepper label="Items / drop" value={row.qtyPerPulse} onChange={(v) => setR({ qtyPerPulse: v })} hint={`${row.pulsesPerDay * row.qtyPerPulse} per day`} />
      </div>
      <div className="label">Product · all countries</div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption" style={{ color: C.muted }}>Cost</span><input className="input mono" type="number" min={0} step="0.01" value={prod.priceToBuffLocal} onChange={(e) => setP({ priceToBuffLocal: Math.max(0, Number(e.target.value) || 0) })} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption" style={{ color: C.muted }}>Currency</span><select className="input" value={prod.currency} onChange={(e) => setP({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {DEMAND_LEVELS.map((d) => <button key={d} className="btn small" aria-pressed={prod.demandLevel === d} onClick={() => setP({ demandLevel: d })} style={prod.demandLevel === d ? { borderColor: C.lime, color: C.lime } : undefined}>{d}</button>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', padding: 16, borderRadius: 12, border: '1px solid #23262B', opacity: on ? 1 : 0.4 }}>
        <div><div style={{ fontSize: 11, color: C.faint }}>Plan / day</div><div className="mono" style={{ fontSize: 15, marginTop: 4 }}>{money(plan, 2)}</div></div>
        <div><div style={{ fontSize: 11, color: C.faint }}>Real / day</div><div className="mono" style={{ fontSize: 15, marginTop: 4, color: C.lime }}>{money(plan * u, 2)}</div></div>
        <div><div style={{ fontSize: 11, color: C.faint }}>Utilization</div><div className="mono" style={{ fontSize: 15, marginTop: 4 }}>{Math.round(u * 100)}%</div></div>
      </div>
      <div className="row" style={{ marginTop: 'auto' }}>
        <button className="btn" onClick={remove} style={{ color: C.bad, borderColor: '#4A1D1D' }}>Remove</button>
        <button className="btn primary" onClick={onClose} style={{ flex: 1, justifyContent: 'center', height: 44 }}>Done</button>
      </div>
    </Drawer>
  )
}

function AddDrawer({ country, onClose }: { country: string; onClose: () => void }) {
  const data = useData()
  const { update } = useStore()
  const existing = new Set((data.allocs[country] || []).map((r) => r.productId))
  const options = data.products.filter((p) => !existing.has(p.id)).sort((a, b) => a.brand.localeCompare(b.brand) || calcPriceUSD(a) - calcPriceUSD(b))
  const [pid, setPid] = useState<number>(options[0]?.id ?? 0)
  const [pulses, setPulses] = useState(2)
  const [qty, setQty] = useState(1)
  const prod = options.find((p) => p.id === pid)
  const real = prod ? calcRealDaily(prod, { productId: pid, pulsesPerDay: pulses, qtyPerPulse: qty }) : 0
  const add = () => {
    if (!prod) return
    update((s) => ({ ...s, allocs: { ...s.allocs, [country]: [...(s.allocs[country] || []), { productId: pid, pulsesPerDay: pulses, qtyPerPulse: qty, active: true }] } }))
    onClose()
  }
  return (
    <Drawer open onClose={onClose} title={`Add product to ${country}`}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">Add product</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{country}</div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      {options.length === 0 ? <div className="caption">Every product is already in {country}.</div> : (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption" style={{ color: C.muted }}>Product</span>
            <select className="input" value={pid} onChange={(e) => setPid(Number(e.target.value))}>
              {options.map((p) => <option key={p.id} value={p.id}>{p.brand} · {p.priceToBuffLocal} {p.currency} · {p.type}</option>)}
            </select>
          </label>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Stepper label="Drops / day" value={pulses} max={24} onChange={setPulses} hint={`every ${(24 / pulses).toFixed(1)}h`} />
            <Stepper label="Items / drop" value={qty} onChange={setQty} hint={`${pulses * qty} per day`} />
          </div>
          <div style={{ padding: 16, borderRadius: 12, border: '1px solid #23262B' }}>
            <div style={{ fontSize: 11, color: C.faint }}>Real budget / month</div>
            <div className="mono" style={{ fontSize: 24, marginTop: 4, color: C.lime }}>{money(real * DAYS_PER_MONTH, 2)}</div>
          </div>
          <button className="btn primary" onClick={add} style={{ justifyContent: 'center', height: 44, marginTop: 'auto' }}>Add to {country}</button>
        </>
      )}
    </Drawer>
  )
}

export default function Countries() {
  const data = useData()
  const { update } = useStore()
  const t = useEntrance()
  const [sel, setSel] = useState('US')
  const [edit, setEdit] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [hb, setHb] = useState<string | null>(null)

  const summaries = useMemo(() => COUNTRIES.map((c) => summarizeCountry(c, data.allocs, data.products)), [data])
  const cur = summaries.find((s) => s.country === sel)!
  const rows = cur.rows.map((r) => ({ r, p: data.products.find((x) => x.id === r.productId) })).filter((x): x is { r: AllocRow; p: Product } => !!x.p)
  const util = cur.planned ? (cur.real / cur.planned) * 100 : 0

  const byBrand = new Map<string, number>()
  rows.forEach(({ r, p }) => byBrand.set(p.brand, (byBrand.get(p.brand) || 0) + calcRealDaily(p, r)))
  const brandList = [...byBrand.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const segs = brandList.slice(0, 6).concat(brandList.length > 6 ? [['Other', brandList.slice(6).reduce((a, b) => a + b[1], 0)]] : [])
  const hbSeg = segs.find((s) => s[0] === hb)

  const raffleIds = data.raffleCountries[sel] || []
  const raffles = raffleIds.map((id) => data.raffles.find((r) => r.id === id)).filter(Boolean) as AppState['raffles']

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
      <aside className="hide-sm" style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${C.line}`, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="label" style={{ padding: '0 12px 10px' }}>Countries</div>
        {summaries.map((s, i) => {
          const has = s.rows.length > 0
          const active = s.country === sel
          return (
            <button key={s.country} onClick={() => setSel(s.country)} className="a-up" style={{ animationDelay: `${i * 25}ms`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', textAlign: 'left', color: has ? C.text : C.ghost, background: active ? '#17191C' : 'transparent', boxShadow: active ? `inset 0 0 0 1px ${C.line2}` : 'none', transition: 'background .2s' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontWeight: 600, fontSize: 14 }}>{s.country}</span><span style={{ fontSize: 11, color: C.faint }}>{has ? (s.activeCount === s.rows.length ? `${s.rows.length} product${s.rows.length === 1 ? '' : 's'}` : `${s.activeCount}/${s.rows.length} active`) : '—'}</span></span>
              {has && <span className="mono" style={{ fontSize: 12, color: C.lime }}>{money(s.real, 2)}/d</span>}
            </button>
          )
        })}
      </aside>

      <div className="page" style={{ flex: 1, minWidth: 0, margin: 0, maxWidth: 'none' }}>
        <div className="between a-up">
          <div>
            <div className="caption">Countries / {sel}</div>
            <h1 className="h1" style={{ marginTop: 6 }}>{sel} <span style={{ fontSize: 14, fontWeight: 500, color: C.muted, letterSpacing: 0 }}>{cur.rows.length} products · {cur.rows.length - cur.activeCount} paused</span></h1>
          </div>
          <div className="row">
            <select className="input show-sm" aria-label="Country" value={sel} onChange={(e) => setSel(e.target.value)} style={{ width: 90 }}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
            <button className="btn primary" onClick={() => setAdding(true)}>{Icon.plus}Add product</button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Kpi label="Real / day" value={money(cur.real * t, 2)} sub={`of ${money(cur.planned, 2)} planned`} color={C.lime} accent delay={120} />
          <Kpi label="Real / month" value={money(cur.real * DAYS_PER_MONTH * t, 2)} sub={`of ${money(cur.planned * DAYS_PER_MONTH, 2)} planned`} delay={200} />
          <Kpi label="Utilization" value={Math.round(util * t) + '%'} sub={util >= 70 ? 'On target (70%+)' : 'Below 70% target'} subColor={util >= 70 ? C.good : C.warn} delay={280} />
          <Kpi label="Raffles here" value={String(Math.round(raffles.length * t))} sub={money(raffles.reduce((a, r) => a + r.marketPrice * r.timesPerMonth, 0)) + ' / month'} delay={360} />
        </div>

        {segs.length > 0 && (
          <div className="a-up" style={{ animationDelay: '420ms', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="between" style={{ fontSize: 12, color: C.muted }}><span>Where the {sel} budget goes · real / day</span><span className="mono" style={{ color: C.text }}>{hbSeg ? `${hbSeg[0]} · ${money(hbSeg[1] as number, 2)} (${Math.round((hbSeg[1] as number) / cur.real * 100)}%)` : `${segs[0][0]} ${Math.round((segs[0][1] as number) / cur.real * 100)}% of the day`}</span></div>
            <div style={{ display: 'flex', height: 34, borderRadius: 10, overflow: 'hidden', gap: 2 }}>
              {segs.map(([name, v], i) => (
                <div key={name as string} className="a-gx" onMouseEnter={() => setHb(name as string)} onMouseLeave={() => setHb(null)}
                  style={{ flex: `${v} 1 0`, minWidth: 6, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', color: i < 3 ? '#0B0C0E' : C.text, background: SHADES[i], opacity: hb && hb !== name ? 0.4 : 1, transition: 'flex .4s, opacity .2s', animationDelay: `${560 + i * 80}ms` }}>
                  {(v as number) / cur.real > 0.06 ? name : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        <Card pad={false} delay={620} style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 980 }}>
            <div className="thead" style={{ gridTemplateColumns: GRID }}><span>On</span><span>Product</span><span>Cost</span><span>Demand</span><span>Delivery</span><span>Utilization</span><span>Plan /d</span><span>Real /d</span><span>Real /mo</span><span /></div>
            {rows.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.faint }}>No products in {sel} yet. <button className="btn small" onClick={() => setAdding(true)} style={{ marginLeft: 8 }}>Add product</button></div>}
            {PURPOSES.map(([purpose, color]) => {
              const group = rows.filter(({ p }) => String(p.purpose || 'MP') === purpose)
              if (!group.length) return null
              return (
                <div key={purpose}>
                  <div style={{ padding: '10px 18px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color }}>{purpose === 'MP' ? 'MARKETPLACE' : purpose.toUpperCase()}</div>
                  {group.map(({ r, p }, i) => {
                    const on = isAllocActive(r)
                    const plan = calcDailyBudget(p, r)
                    const real = calcRealDaily(p, r)
                    const u = calcUtilization(String(p.demandLevel), r.pulsesPerDay) * 100
                    const op = on ? 1 : 0.35
                    return (
                      <div key={r.productId} className="trow a-up" style={{ gridTemplateColumns: GRID, height: 46, animationDelay: `${760 + i * 35}ms`, background: edit === r.productId ? '#17191C' : 'transparent' }}>
                        <Toggle on={on} onChange={(v) => update((s) => setRow(s, sel, r.productId, { active: v }))} label={`${on ? 'Pause' : 'Activate'} ${p.brand}`} />
                        <span style={{ opacity: op, transition: 'opacity .3s' }}><b style={{ fontWeight: 600 }}>{p.brand}</b> <span style={{ color: on ? C.faint : C.bad, fontSize: 12 }}>{on ? p.type : 'Paused'}</span></span>
                        <span className="mono" style={{ opacity: op }}>{money(calcPriceUSD(p), 2)}{p.currency !== 'USD' && <span style={{ display: 'block', fontSize: 10, color: C.faint }}>{p.priceToBuffLocal} {p.currency}</span>}</span>
                        <span style={{ opacity: op }}><DemandChip level={String(p.demandLevel)} /></span>
                        <span className="mono" style={{ opacity: op, color: C.text, fontSize: 12 }}>{r.pulsesPerDay} × {r.qtyPerPulse}</span>
                        <span style={{ opacity: op }}><UtilBar value={u} delay={900 + i * 35} /></span>
                        <span className="mono" style={{ opacity: op, color: C.muted }}>{money(plan, 2)}</span>
                        <span className="mono" style={{ fontWeight: 600, color: on ? C.lime : C.ghost, transition: 'color .3s' }}>{money(real, 2)}</span>
                        <span className="mono" style={{ fontWeight: 600, opacity: op }}>{money(real * DAYS_PER_MONTH, 2)}</span>
                        <button className="icon-btn" aria-label={`Edit ${p.brand}`} onClick={() => setEdit(r.productId)}>{Icon.edit}</button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {rows.length > 0 && (
              <div className="trow" style={{ gridTemplateColumns: GRID, height: 46, background: '#141518', fontWeight: 600 }}>
                <span /><span>Total · {sel}</span><span /><span /><span /><span className="mono" style={{ color: C.muted }}>{Math.round(util)}%</span>
                <span className="mono" style={{ color: C.muted }}>{money(cur.planned, 2)}</span><span className="mono" style={{ color: C.lime }}>{money(cur.real, 2)}</span><span className="mono">{money(cur.real * DAYS_PER_MONTH, 2)}</span><span />
              </div>
            )}
          </div>
        </Card>

        {data.raffles.length > 0 && (
          <Card delay={700}>
            <div className="between" style={{ alignItems: 'center', marginBottom: 10 }}><h2 className="h2" style={{ color: C.violet }}>Raffles in {sel}</h2><span className="caption">{raffles.length} assigned</span></div>
            {raffles.length === 0 && <div className="caption">No raffles assigned to {sel}.</div>}
            {raffles.map((r) => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
                <span style={{ fontWeight: 600, flex: 1 }}>{r.name}</span><span className="caption" style={{ width: 100 }}>{r.vendor}</span>
                <span className="mono" style={{ width: 90 }}>{r.timesPerMonth}× / mo</span><span className="mono" style={{ width: 90, textAlign: 'right' }}>{money(r.marketPrice * r.timesPerMonth)}</span>
                <button className="icon-btn" aria-label={`Remove ${r.name} from ${sel}`} onClick={() => { if (window.confirm(`Remove ${r.name} from ${sel}?`)) update((s) => ({ ...s, raffleCountries: { ...s.raffleCountries, [sel]: (s.raffleCountries[sel] || []).filter((x) => x !== r.id) } })) }}>{Icon.close}</button>
              </div>
            ))}
          </Card>
        )}
      </div>

      {edit !== null && <EditDrawer country={sel} productId={edit} onClose={() => setEdit(null)} />}
      {adding && <AddDrawer country={sel} onClose={() => setAdding(false)} />}
    </div>
  )
}
