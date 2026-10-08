import { useMemo, useState, type ReactNode } from 'react'
import { COUNTRIES, CURRENCIES, DAYS_PER_MONTH, DEMAND_BASE, DEMAND_LEVELS, PURPOSES, VENDORS, calcPriceUSD, calcUtilization, pulseFactor, vendorBudgets } from '../lib/calc'
import { useData, useStore } from '../lib/store'
import type { AllocRow, Product, Raffle } from '../lib/types'
import { C, Card, DEMAND_COLOR, Seg, money } from '../ui/kit'

const CATEGORIES = ['Gaming', 'Shopping', 'Entertainment', 'Charity', 'Other']

function Field({ name, children, span = 1, hint }: { name: string; children: ReactNode; span?: number; hint?: string }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: `span ${span}` }}><span className="caption" style={{ color: C.muted }}>{name}{hint && <span style={{ color: C.ghost }}> · {hint}</span>}</span>{children}</label>
}

function Step({ n, ok, title, sub }: { n: number; ok: boolean; title: string; sub?: string }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, transition: 'all .3s', background: ok ? C.lime : '#1F2226', color: ok ? '#0B0C0E' : C.muted }}>{ok ? '✓' : n}</span>
      <h2 className="h2">{title}</h2>{sub && <span className="caption">· {sub}</span>}
    </div>
  )
}

function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 40, borderRadius: 10, border: `1px solid ${C.line2}`, background: '#0B0C0E' }}>
      <button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 38, height: 38, border: 'none', background: 'transparent', color: C.text, fontSize: 17, cursor: 'pointer' }}>−</button>
      <span className="mono" style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, minWidth: 28 }}>{value}</span>
      <button aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 38, height: 38, border: 'none', background: 'transparent', color: C.text, fontSize: 17, cursor: 'pointer' }}>+</button>
    </div>
  )
}

function CountryTiles({ selected, toggle, live, setAll }: { selected: Set<string>; toggle: (c: string) => void; live: Record<string, string>; setAll: (on: boolean) => void }) {
  const all = selected.size === COUNTRIES.length
  return (
    <>
      <div className="between" style={{ alignItems: 'center' }}><span className="caption">{selected.size} selected · small text = what runs there today</span><button className="btn small" onClick={() => setAll(!all)}>{all ? 'Clear all' : 'Select all'}</button></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(66px, 1fr))', gap: 6 }}>
        {COUNTRIES.map((c) => {
          const on = selected.has(c)
          return (
            <button key={c} aria-pressed={on} onClick={() => toggle(c)} style={{ height: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 10, cursor: 'pointer', transition: 'all .2s var(--ease)', border: `1px solid ${on ? C.lime : '#23262B'}`, background: on ? 'rgba(200,255,0,0.1)' : '#0B0C0E', color: on ? C.lime : C.muted, transform: on ? 'translateY(-2px)' : 'none' }}>
              <b style={{ fontSize: 13 }}>{c}</b><span style={{ fontSize: 10, opacity: 0.7 }}>{live[c] || 'new'}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

interface PForm { brand: string; redashName: string; category: string; vendor: string; purpose: string; lootkeyscode: string; price: string; currency: string; type: string; demand: string; bpRegular: string; bpPremium: string; discount: string }
const BLANK: PForm = { brand: '', redashName: '', category: 'Gaming', vendor: 'GCOW', purpose: 'MP', lootkeyscode: '', price: '', currency: 'USD', type: 'Regular', demand: 'Medium', bpRegular: '', bpPremium: '', discount: '0' }

function ProductMode({ budget }: { budget: number }) {
  const data = useData()
  const { update } = useStore()
  const [f, setF] = useState<PForm>(BLANK)
  const [pulses, setPulses] = useState(2)
  const [qty, setQty] = useState(5)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState<Record<string, { p: number; q: number }>>({})
  const [done, setDone] = useState<{ brand: string; countries: number } | null>(null)
  const set = (patch: Partial<PForm>) => setF((x) => ({ ...x, ...patch }))
  const live = useMemo(() => Object.fromEntries(COUNTRIES.map((c) => [c, (data.allocs[c] || []).length ? `${(data.allocs[c] || []).length} live` : ''])), [data.allocs])

  const price = Number(f.price) || 0
  const usd = calcPriceUSD({ priceToBuffLocal: price, currency: f.currency })
  const countryRows = [...sel].map((c) => ({ c, p: custom[c]?.p ?? pulses, q: custom[c]?.q ?? qty }))
  const perCountry = countryRows.map(({ c, p, q }) => { const u = calcUtilization(f.demand, p); return { c, p, q, u, plan: usd * p * q, real: usd * p * q * u } })
  const realDay = perCountry.reduce((a, x) => a + x.real, 0)
  const planDay = perCountry.reduce((a, x) => a + x.plan, 0)
  const u = calcUtilization(f.demand, pulses)
  const ok1 = !!f.brand.trim() && price > 0 && Number(f.bpRegular) > 0
  const ok3 = sel.size > 0
  const disc = (Number(f.discount) || 0) / 100
  const L = Math.PI * 64

  const toggle = (c: string) => setSel((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n })
  const create = () => {
    const id = Date.now()
    const product: Product = {
      id, brand: f.brand.trim(), priceToBuffLocal: price, currency: f.currency, category: f.category, provider: f.vendor, vendor: f.vendor, type: f.type,
      bpRegular: Number(f.bpRegular) || null, bpPremium: Number(f.bpPremium) || null, discountPct: Number(f.discount) || 0, demandLevel: f.demand,
      redashName: f.redashName.trim(), purpose: f.purpose, lootkeyscode: f.lootkeyscode.trim(),
    }
    update((s) => {
      const allocs = { ...s.allocs }
      for (const { c, p, q } of countryRows) allocs[c] = [...(allocs[c] || []), { productId: id, pulsesPerDay: p, qtyPerPulse: q, active: true } as AllocRow]
      return { ...s, products: [...s.products, product], allocs }
    })
    setDone({ brand: product.brand, countries: sel.size })
  }
  const reset = () => { setF(BLANK); setSel(new Set()); setCustom({}); setPulses(2); setQty(5); setDone(null) }

  if (done) return (
    <Card delay={0} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 48, textAlign: 'center' }}>
      <span className="a-pop" style={{ width: 56, height: 56, borderRadius: '50%', background: C.lime, color: '#0B0C0E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700 }}>✓</span>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{done.brand} created</div>
      <div className="caption">{done.countries ? `Allocated to ${done.countries} countr${done.countries > 1 ? 'ies' : 'y'}` : 'Not allocated yet'} · {money(realDay * DAYS_PER_MONTH)} real budget / month</div>
      <div className="row"><a className="btn" href="#/countries">Open Countries</a><a className="btn" href="#/products">Open Products</a><button className="btn primary" onClick={reset}>Create another</button></div>
    </Card>
  )

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 18, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <Card delay={120} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Step n={1} ok={ok1} title="Product" />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <Field name="Brand" span={2}><input className="input" value={f.brand} placeholder="e.g. Roblox" onChange={(e) => set({ brand: e.target.value })} /></Field>
            <Field name="Name in Redash" span={2} hint="for real-spend matching"><input className="input" value={f.redashName} placeholder="e.g. $25 Roblox Gift Card" onChange={(e) => set({ redashName: e.target.value })} /></Field>
            <Field name="Price to Buff"><input className="input mono" type="number" min={0} step="0.01" value={f.price} onChange={(e) => set({ price: e.target.value })} /></Field>
            <Field name="Currency"><select className="input" value={f.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field name="BP Regular"><input className="input mono" type="number" min={0} value={f.bpRegular} placeholder="points" onChange={(e) => set({ bpRegular: e.target.value })} /></Field>
            <Field name="BP Premium"><input className="input mono" type="number" min={0} value={f.bpPremium} placeholder="optional" onChange={(e) => set({ bpPremium: e.target.value })} /></Field>
            <Field name="Category"><select className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field name="Vendor"><select className="input" value={f.vendor} onChange={(e) => set({ vendor: e.target.value })}>{VENDORS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field name="Purpose"><select className="input" value={f.purpose} onChange={(e) => set({ purpose: e.target.value })}>{PURPOSES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field name="Type"><select className="input" value={f.type} onChange={(e) => set({ type: e.target.value })}>{['Regular', 'Premium'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field name="Discount %"><input className="input mono" type="number" min={0} max={100} value={f.discount} onChange={(e) => set({ discount: e.target.value })} /></Field>
            {f.vendor === 'Loot Keys' && <Field name="Loot Keys code" span={3}><input className="input mono" value={f.lootkeyscode} onChange={(e) => set({ lootkeyscode: e.target.value })} /></Field>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="caption" style={{ color: C.muted }}>Demand</span>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {DEMAND_LEVELS.map((lv) => {
                const on = f.demand === lv, c = DEMAND_COLOR[lv]
                return <button key={lv} aria-pressed={on} onClick={() => set({ demand: lv })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'all .2s', border: `1px solid ${on ? c : '#23262B'}`, background: on ? c + '14' : '#0B0C0E', color: on ? c : C.muted }}><b style={{ fontWeight: 600 }}>{lv}</b><span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{Math.round(DEMAND_BASE[lv] * 100)}% base</span></button>
              })}
            </div>
          </div>
          {price > 0 && Number(f.bpRegular) > 0 && <div className="caption">≈ {money(usd, 2)} · BP after discount {Math.round(Number(f.bpRegular) * (1 - disc)).toLocaleString()}{Number(f.bpPremium) ? ` / premium ${Math.round(Number(f.bpPremium) * (1 - disc)).toLocaleString()}` : ''}</div>}
        </Card>

        <Card delay={220} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Step n={2} ok title="Delivery" sub="default for every country" />
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1.4fr', gap: 14, alignItems: 'end' }}>
            <Field name="Drops per day"><Stepper label="drops per day" value={pulses} max={24} onChange={setPulses} /></Field>
            <Field name="Items per drop"><Stepper label="items per drop" value={qty} onChange={setQty} /></Field>
            <Field name={`Drops across the day · every ${(24 / pulses).toFixed(1)}h`}>
              <div style={{ position: 'relative', height: 40, borderRadius: 10, background: '#0B0C0E', border: `1px solid ${C.line}` }}>
                {Array.from({ length: pulses }, (_, i) => <span key={i} style={{ position: 'absolute', top: 13, width: Math.min(14, 6 + qty), height: Math.min(14, 6 + qty), marginTop: -(Math.min(14, 6 + qty) - 14) / 2, borderRadius: '50%', background: C.lime, transform: 'translateX(-50%)', transition: 'left .4s var(--ease)', left: `calc(14px + (100% - 28px) * ${(i + 0.5) / pulses})` }} />)}
              </div>
            </Field>
          </div>
        </Card>

        <Card delay={320} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Step n={3} ok={ok3} title="Countries" />
          <CountryTiles selected={sel} toggle={toggle} live={live} setAll={(on) => setSel(new Set(on ? COUNTRIES : []))} />
          {countryRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <span className="caption">Per-country delivery · change a country only if it differs</span>
              {countryRows.map(({ c, p, q }) => (
                <div key={c} className="row a-up" style={{ gap: 12, padding: '6px 10px', borderRadius: 10, background: '#17191C', animationDuration: '.35s' }}>
                  <b style={{ width: 34 }}>{c}</b>
                  <div style={{ width: 150 }}><Stepper label={`${c} drops`} value={p} max={24} onChange={(v) => setCustom({ ...custom, [c]: { p: v, q } })} /></div>
                  <span className="caption">×</span>
                  <div style={{ width: 150 }}><Stepper label={`${c} items`} value={q} onChange={(v) => setCustom({ ...custom, [c]: { p, q: v } })} /></div>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 13 }}>{money(usd * p * q * calcUtilization(f.demand, p) * DAYS_PER_MONTH)}<span className="caption"> / mo</span></span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <aside className="card a-up" style={{ animationDelay: '420ms', position: 'sticky', top: 80, padding: 22, display: 'flex', flexDirection: 'column', gap: 18, borderColor: 'rgba(200,255,0,0.22)', background: 'linear-gradient(180deg, #13150F 0%, #111215 55%)' }}>
        <div className="between" style={{ alignItems: 'center' }}><span className="label">Live impact</span><span className="caption">{f.brand || 'New product'}{price ? ` · ${money(usd, 2)}` : ''}</span></div>
        <div>
          <div className="caption" style={{ color: C.muted }}>Real budget / month</div>
          <div className="mono" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', color: C.lime }}>{money(realDay * DAYS_PER_MONTH)}</div>
          <div className="caption">{sel.size ? `+${((realDay * DAYS_PER_MONTH) / budget * 100).toFixed(1)}% on today's ${money(budget)} monthly budget` : 'Pick at least one country'}</div>
        </div>
        <div className="row" style={{ gap: 18 }}>
          <div style={{ position: 'relative', width: 150, height: 86, flexShrink: 0 }}>
            <svg width="150" height="86" viewBox="0 0 150 86"><path d="M 11 80 A 64 64 0 0 1 139 80" fill="none" stroke="#1F2226" strokeWidth="12" strokeLinecap="round" /><path d="M 11 80 A 64 64 0 0 1 139 80" fill="none" stroke={u >= 0.7 ? C.good : u >= 0.5 ? C.warn : C.bad} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${u * L} ${L}`} style={{ transition: 'stroke-dasharray .6s var(--ease), stroke .3s' }} /></svg>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center' }}><div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{Math.round(u * 100)}%</div><div style={{ fontSize: 10, color: C.faint }}>utilization</div></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.muted }}>
            <span>Demand base <b className="mono" style={{ color: C.text, fontWeight: 500 }}>{Math.round((DEMAND_BASE[f.demand] ?? 0.65) * 100)}%</b></span>
            <span>× pulse factor <b className="mono" style={{ color: C.text, fontWeight: 500 }}>{Math.round(pulseFactor(pulses) * 100)}%</b></span>
            <span style={{ color: C.faint }}>More drops a day = lower utilization</span>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['Items / day / country', String(pulses * qty)], ['Plan / day · all', money(planDay, 2)], ['Real / day · all', money(realDay, 2)], ['Countries', String(sel.size)]].map(([l, v]) => (
            <div key={l} style={{ padding: 12, borderRadius: 12, background: '#0B0C0E', border: `1px solid ${C.line}` }}><div style={{ fontSize: 11, color: C.faint }}>{l}</div><div className="mono" style={{ fontSize: 16, marginTop: 4 }}>{v}</div></div>
          ))}
        </div>
        <button className="btn primary" disabled={!ok1} onClick={create} style={{ height: 48, justifyContent: 'center', fontSize: 14 }}>{!ok1 ? 'Fill brand, price and BP Regular' : sel.size ? `Create & allocate to ${sel.size} countr${sel.size > 1 ? 'ies' : 'y'}` : 'Create product (no countries yet)'}</button>
      </aside>
    </div>
  )
}

function RaffleMode() {
  const data = useData()
  const { update } = useStore()
  const [f, setF] = useState({ name: '', vendor: 'GCOW', price: '', times: '' })
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<string | null>(null)
  const live = useMemo(() => Object.fromEntries(COUNTRIES.map((c) => [c, (data.raffleCountries[c] || []).length ? `${(data.raffleCountries[c] || []).length} raffles` : ''])), [data.raffleCountries])
  const price = Number(f.price) || 0, times = Math.round(Number(f.times) || 0)
  const ok = !!f.name.trim() && price > 0 && times > 0
  const toggle = (c: string) => setSel((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n })
  const create = () => {
    const r: Raffle = { id: Date.now(), name: f.name.trim(), vendor: f.vendor, marketPrice: price, timesPerMonth: times }
    update((s) => {
      const rc = { ...s.raffleCountries }
      for (const c of sel) rc[c] = [...new Set([...(rc[c] || []), r.id])]
      return { ...s, raffles: [...s.raffles, r], raffleCountries: rc }
    })
    setDone(r.name)
  }
  if (done) return (
    <Card delay={0} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 48, textAlign: 'center' }}>
      <span className="a-pop" style={{ width: 56, height: 56, borderRadius: '50%', background: C.violet, color: '#0B0C0E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700 }}>✓</span>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{done} created</div>
      <div className="caption">{sel.size ? `Assigned to ${[...sel].join(', ')}` : 'Not assigned to a country yet'} · {money(price * times)} / month</div>
      <div className="row"><a className="btn" href="#/products">Open raffles</a><button className="btn primary" onClick={() => { setF({ name: '', vendor: 'GCOW', price: '', times: '' }); setSel(new Set()); setDone(null) }}>Create another</button></div>
    </Card>
  )
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <Card delay={120} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Step n={1} ok={ok} title="Raffle" />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <Field name="Name" span={2}><input className="input" value={f.name} placeholder="e.g. $50 Riot" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field name="Vendor" span={2}><select className="input" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>{VENDORS.map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field name="Market price (USD)" span={2}><input className="input mono" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
            <Field name="Draws per month" span={2}><input className="input mono" type="number" min={0} value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} /></Field>
          </div>
        </Card>
        <Card delay={220} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Step n={2} ok={sel.size > 0} title="Countries" sub="optional" />
          <CountryTiles selected={sel} toggle={toggle} live={live} setAll={(on) => setSel(new Set(on ? COUNTRIES : []))} />
        </Card>
      </div>
      <aside className="card a-up" style={{ animationDelay: '320ms', position: 'sticky', top: 80, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, borderColor: 'rgba(167,139,250,0.3)' }}>
        <span className="label">Monthly cost</span>
        <div className="mono" style={{ fontSize: 40, fontWeight: 600, color: C.violet }}>{money(price * times)}</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', minHeight: 10 }}>{Array.from({ length: Math.min(times, 31) }, (_, j) => <span key={j} className="a-pop" style={{ width: 9, height: 9, borderRadius: '50%', background: C.violet, animationDelay: `${j * 25}ms` }} />)}</div>
        <div className="caption">{times ? `${times} draw${times > 1 ? 's' : ''} a month × ${money(price)}` : 'One dot per draw'}</div>
        <button className="btn primary" disabled={!ok} onClick={create} style={{ height: 48, justifyContent: 'center', background: ok ? C.violet : undefined, borderColor: ok ? C.violet : undefined }}>{!ok ? 'Fill name, price and draws' : sel.size ? `Create & assign to ${sel.size}` : 'Create raffle'}</button>
      </aside>
    </div>
  )
}

export default function Allocate() {
  const data = useData()
  const [mode, setMode] = useState<'product' | 'raffle'>(() => (location.hash.includes('raffle') ? 'raffle' : 'product'))
  const budget = useMemo(() => vendorBudgets(data.allocs, data.products, data.raffles, data.budgetExtras).reduce((a, v) => a + v.monthly, 0), [data])
  return (
    <div className="page">
      <div className="between a-up">
        <div><h1 className="h1">{mode === 'product' ? 'New product' : 'New raffle'}</h1><div className="sub">{mode === 'product' ? 'One page instead of three steps · the impact updates as you type' : 'Create a raffle and pick where it runs'}</div></div>
        <Seg value={mode} onChange={setMode} options={[{ value: 'product', label: 'Product' }, { value: 'raffle', label: 'Raffle' }]} />
      </div>
      {mode === 'product' ? <ProductMode budget={budget} /> : <RaffleMode />}
    </div>
  )
}
