import { useMemo, useState, type ReactNode } from 'react'
import { CURRENCIES, DAYS_PER_MONTH, DEMAND_BASE, DEMAND_LEVELS, PURPOSES, VENDORS, calcPriceUSD, calcRealDaily, orphanRows, productStats, vendorOf, type ProductStat } from '../lib/calc'
import { useData, useStore } from '../lib/store'
import type { Product, Raffle } from '../lib/types'
import { C, Card, DemandChip, Drawer, Icon, Seg, money, useEntrance } from '../ui/kit'

const CATEGORIES = ['Gaming', 'Shopping', 'Entertainment', 'Charity', 'Other']
const TYPES = ['Regular', 'Premium']
const VC: Record<string, string> = { 'GCOW': C.lime, 'Loot Keys': C.sky, 'Internal': C.violet, 'Kinguin': C.orange, 'Riot Internal': C.pink }
const vcol = (v: string) => VC[v] || C.muted
const SYM: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const label = (p: Product) => `${SYM[p.currency] || ''}${p.priceToBuffLocal}${SYM[p.currency] ? '' : ' ' + p.currency}`

function Field({ name, children, span = 1 }: { name: string; children: ReactNode; span?: number }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: `span ${span}` }}><span className="caption" style={{ color: C.muted }}>{name}</span>{children}</label>
}

function Chips({ title, options, value, onChange }: { title: string; options: { v: string; n: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <span className="caption" style={{ marginRight: 4 }}>{title}</span>
      {[{ v: 'All', n: -1 }, ...options].map((o) => {
        const on = value === o.v
        return (
          <button key={o.v} aria-pressed={on} onClick={() => onChange(o.v)} style={{ height: 30, padding: '0 11px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .2s', border: `1px solid ${on ? 'rgba(200,255,0,0.45)' : '#23262B'}`, background: on ? 'rgba(200,255,0,0.08)' : 'transparent', color: on ? C.lime : C.muted }}>
            {o.v}{o.n >= 0 && <span className="mono" style={{ opacity: 0.55, fontSize: 11, marginLeft: 5 }}>{o.n}</span>}
          </button>
        )
      })}
    </div>
  )
}

function ProductDrawer({ product, stat, onClose }: { product: Product; stat?: ProductStat; onClose: () => void }) {
  const { update } = useStore()
  const [f, setF] = useState<Product>({ ...product, vendor: vendorOf(product) })
  const set = (patch: Partial<Product>) => setF((x) => ({ ...x, ...patch }))
  const usd = calcPriceUSD(f)
  const d = (f.discountPct || 0) / 100
  const save = () => {
    // v1 keeps vendor in both `vendor` and `provider`; keep them in sync.
    update((s) => ({ ...s, products: s.products.map((p) => (p.id === product.id ? { ...f, provider: f.vendor } : p)) }))
    onClose()
  }
  const remove = () => {
    const n = stat?.rows || 0
    const msg = n ? `Delete ${product.brand} ${label(product)}? It is allocated in ${stat!.countries.join(', ')} — those ${n} allocation rows will be removed too.` : `Delete ${product.brand} ${label(product)}?`
    if (!window.confirm(msg)) return
    update((s) => ({
      ...s,
      products: s.products.filter((p) => p.id !== product.id),
      allocs: Object.fromEntries(Object.entries(s.allocs).map(([c, rows]) => [c, (rows || []).filter((r) => r.productId !== product.id)])),
    }))
    onClose()
  }
  const num = (v: string) => (v === '' ? null : Math.max(0, Number(v) || 0))
  return (
    <Drawer open onClose={onClose} title={`Edit ${product.brand}`}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">Edit product · applies to every country</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{f.brand || 'Untitled'} <span style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>{label(f)}</span></div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      {stat && <div className="caption">{stat.countries.length ? `Live in ${stat.countries.join(', ')} · ${money(stat.monthly)} / month` : 'Not allocated to any country'}</div>}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field name="Brand" span={2}><input className="input" value={f.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
        <Field name="Price to Buff"><input className="input mono" type="number" min={0} step="0.01" value={f.priceToBuffLocal} onChange={(e) => set({ priceToBuffLocal: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field name="Currency"><select className="input" value={f.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field name="Category"><select className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field name="Vendor"><select className="input" value={f.vendor} onChange={(e) => set({ vendor: e.target.value })}>{[...new Set([...VENDORS, String(f.vendor)])].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field name="Type"><select className="input" value={f.type} onChange={(e) => set({ type: e.target.value })}>{TYPES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field name="Purpose"><select className="input" value={String(f.purpose || 'MP')} onChange={(e) => set({ purpose: e.target.value })}>{PURPOSES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field name="BP Regular"><input className="input mono" type="number" min={0} value={f.bpRegular ?? ''} onChange={(e) => set({ bpRegular: num(e.target.value) })} /></Field>
        <Field name="BP Premium"><input className="input mono" type="number" min={0} value={f.bpPremium ?? ''} placeholder="optional" onChange={(e) => set({ bpPremium: num(e.target.value) })} /></Field>
        <Field name="Discount %"><input className="input mono" type="number" min={0} max={100} value={f.discountPct || 0} onChange={(e) => set({ discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></Field>
        <Field name="Name in Redash"><input className="input" value={f.redashName || ''} placeholder="auto-match" onChange={(e) => set({ redashName: e.target.value })} /></Field>
        {f.vendor === 'Loot Keys' && <Field name="Loot Keys code" span={2}><input className="input mono" value={f.lootkeyscode || ''} onChange={(e) => set({ lootkeyscode: e.target.value })} /></Field>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="caption" style={{ color: C.muted }}>Demand</span>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {DEMAND_LEVELS.map((lv) => {
            const on = f.demandLevel === lv
            const c = lv === 'Very High' ? C.lime : lv === 'High' ? C.good : lv === 'Medium' ? C.warn : C.bad
            return <button key={lv} aria-pressed={on} onClick={() => set({ demandLevel: lv })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 10px', borderRadius: 10, fontSize: 12, cursor: 'pointer', textAlign: 'left', border: `1px solid ${on ? c : '#23262B'}`, background: on ? c + '14' : '#0B0C0E', color: on ? c : C.muted }}><b style={{ fontWeight: 600 }}>{lv}</b><span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>{Math.round(DEMAND_BASE[lv] * 100)}% base</span></button>
          })}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', padding: 16, borderRadius: 12, border: '1px solid #23262B' }}>
        <div><div style={{ fontSize: 11, color: C.faint }}>Price in USD</div><div className="mono" style={{ fontSize: 15, marginTop: 4 }}>{money(usd, 2)}</div></div>
        <div><div style={{ fontSize: 11, color: C.faint }}>BP after discount</div><div className="mono" style={{ fontSize: 15, marginTop: 4 }}>{f.bpRegular ? Math.round(f.bpRegular * (1 - d)).toLocaleString() : '—'}</div></div>
        <div><div style={{ fontSize: 11, color: C.faint }}>Premium after</div><div className="mono" style={{ fontSize: 15, marginTop: 4 }}>{f.bpPremium ? Math.round(f.bpPremium * (1 - d)).toLocaleString() : '—'}</div></div>
      </div>
      <div className="row" style={{ marginTop: 'auto' }}>
        <button className="btn" onClick={remove} style={{ color: C.bad, borderColor: '#4A1D1D' }}>Delete</button>
        <button className="btn" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!f.brand.trim() || !(f.priceToBuffLocal > 0)} style={{ flex: 1, justifyContent: 'center', height: 44 }}>Save</button>
      </div>
    </Drawer>
  )
}

function RaffleDrawer({ raffle, onClose }: { raffle: Raffle; onClose: () => void }) {
  const { update } = useStore()
  const data = useData()
  const [f, setF] = useState(raffle)
  const where = Object.entries(data.raffleCountries).filter(([, ids]) => (ids || []).includes(raffle.id)).map(([c]) => c)
  const save = () => { update((s) => ({ ...s, raffles: s.raffles.map((r) => (r.id === raffle.id ? f : r)) })); onClose() }
  const remove = () => {
    if (!window.confirm(`Delete raffle ${raffle.name}?${where.length ? ` It will also be removed from ${where.join(', ')}.` : ''}`)) return
    update((s) => ({ ...s, raffles: s.raffles.filter((r) => r.id !== raffle.id), raffleCountries: Object.fromEntries(Object.entries(s.raffleCountries).map(([c, ids]) => [c, (ids || []).filter((x) => x !== raffle.id)])) }))
    onClose()
  }
  return (
    <Drawer open onClose={onClose} title={`Edit ${raffle.name}`}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">Edit raffle</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{f.name}</div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      <div className="caption">{where.length ? `Runs in ${where.join(', ')}` : 'Not assigned to any country'}</div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field name="Name" span={2}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field name="Vendor"><select className="input" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>{[...new Set([...VENDORS, f.vendor])].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field name="Market price (USD)"><input className="input mono" type="number" min={0} value={f.marketPrice} onChange={(e) => setF({ ...f, marketPrice: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field name="Times per month"><input className="input mono" type="number" min={0} value={f.timesPerMonth} onChange={(e) => setF({ ...f, timesPerMonth: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></Field>
        <Field name="Monthly cost"><div className="input mono" style={{ display: 'flex', alignItems: 'center', color: C.violet }}>{money(f.marketPrice * f.timesPerMonth)}</div></Field>
      </div>
      <div className="row" style={{ marginTop: 'auto' }}>
        <button className="btn" onClick={remove} style={{ color: C.bad, borderColor: '#4A1D1D' }}>Delete</button>
        <button className="btn primary" onClick={save} disabled={!f.name.trim() || !(f.marketPrice > 0)} style={{ flex: 1, justifyContent: 'center', height: 44 }}>Save</button>
      </div>
    </Drawer>
  )
}

export default function Products() {
  const data = useData()
  const t = useEntrance()
  const [view, setView] = useState<'mp' | 'raffles'>('mp')
  const [cat, setCat] = useState('All')
  const [vend, setVend] = useState('All')
  const [q, setQ] = useState('')
  const [hp, setHp] = useState<number | null>(null)
  const [hb, setHb] = useState<string | null>(null)
  const [edit, setEdit] = useState<number | null>(null)
  const [editRaffle, setEditRaffle] = useState<number | null>(null)

  const stats = useMemo(() => productStats(data.allocs, data.products), [data])
  const orphans = useMemo(() => orphanRows(data.allocs, data.products), [data])
  const match = (s: ProductStat) => (cat === 'All' || s.product.category === cat) && (vend === 'All' || vendorOf(s.product) === vend) && (!q.trim() || s.product.brand.toLowerCase().includes(q.trim().toLowerCase()))
  const shown = stats.filter(match)
  const count = (f: (s: ProductStat) => boolean) => stats.filter(f).length
  const cats = [...new Set(stats.map((s) => s.product.category))].sort()
  const vendors = [...new Set(stats.map((s) => vendorOf(s.product)))].sort()

  // bubble chart: x = USD price, y = sqrt(monthly budget)
  const maxPrice = Math.max(20, ...stats.map((s) => calcPriceUSD(s.product))) * 1.05
  const maxMonthly = Math.max(1000, ...stats.map((s) => s.monthly)) * 1.05
  const X = (v: number) => 56 + (v / maxPrice) * 688
  const Y = (v: number) => 300 - Math.sqrt(Math.max(0, v) / maxMonthly) * 286
  const yTicks = [0, 250, 1000, 2500, 5000].filter((v) => v < maxMonthly)
  const xTicks = [1, 5, 10, 15, 20].filter((v) => v < maxPrice)
  const hpStat = stats.find((s) => s.product.id === hp)
  const top = [...stats].sort((a, b) => b.monthly - a.monthly)[0]

  const brands = useMemo(() => {
    const m = new Map<string, ProductStat[]>()
    stats.forEach((s) => m.set(s.product.brand, [...(m.get(s.product.brand) || []), s]))
    return [...m.entries()].map(([name, items]) => ({ name, items: items.sort((a, b) => calcPriceUSD(a.product) - calcPriceUSD(b.product)), total: items.reduce((a, s) => a + s.monthly, 0) })).sort((a, b) => b.total - a.total)
  }, [stats])

  const flags: { title: string; text: string }[] = []
  const unalloc = stats.filter((s) => s.rows === 0)
  if (unalloc.length) flags.push({ title: `${unalloc.length} product${unalloc.length > 1 ? 's' : ''} not used anywhere`, text: unalloc.map((s) => `${s.product.brand} ${label(s.product)}`).slice(0, 4).join(', ') + (unalloc.length > 4 ? '…' : '') })
  const paused = stats.filter((s) => s.rows > 0 && s.activeRows === 0)
  if (paused.length) flags.push({ title: `${paused.length} product${paused.length > 1 ? 's' : ''} paused everywhere`, text: paused.map((s) => `${s.product.brand} ${label(s.product)} (${s.countries.join(', ')})`).join(', ') + ' — adds $0 today.' })
  const orphanN = orphans.reduce((a, o) => a + o.count, 0)
  if (orphanN) flags.push({ title: `${orphanN} allocations point to deleted products`, text: orphans.map((o) => `${o.country}: ${o.count}`).join(' · ') + '. They count as $0 but clutter the data.' })
  const global = data.allocs.GLOBAL || []
  if (global.length) {
    const gm = global.reduce((a, r) => { const p = data.products.find((x) => x.id === r.productId); return a + (p ? calcRealDaily(p, r) * DAYS_PER_MONTH : 0) }, 0)
    flags.push({ title: `${global.length} GLOBAL allocations`, text: `About ${money(gm)} / month that no country screen shows.` })
  }
  const noRedash = stats.filter((s) => s.rows > 0 && !s.product.redashName && s.product.purpose !== 'Raffles').length
  if (noRedash) flags.push({ title: `${noRedash} products rely on auto-matching`, text: 'Set "Name in Redash" for exact real-spend matching.' })

  const raffleTotal = data.raffles.reduce((a, r) => a + r.marketPrice * r.timesPerMonth, 0)
  const editStat = stats.find((s) => s.product.id === edit)
  const editR = data.raffles.find((r) => r.id === editRaffle)

  return (
    <div className="page">
      <div className="between a-up">
        <div>
          <h1 className="h1">Products</h1>
          <div className="sub">{view === 'mp' ? `${shown.length} of ${stats.length} products · ${new Set(shown.map((s) => s.product.brand)).size} brands · ${money(shown.reduce((a, s) => a + s.monthly, 0) * t)} real budget / month` : `${data.raffles.length} raffles · ${money(raffleTotal)} / month`}</div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Seg value={view} onChange={setView} options={[{ value: 'mp', label: 'Products' }, { value: 'raffles', label: 'Raffles' }]} />
          {view === 'mp' && <input className="input" aria-label="Search brand" placeholder="Search brand…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />}
          <a className="btn primary" href={view === 'mp' ? '#/allocate' : '#/allocate/raffle'}>{Icon.plus}{view === 'mp' ? 'Add product' : 'Add raffle'}</a>
        </div>
      </div>

      {view === 'raffles' ? (
        <Card pad={false} delay={120}>
          <div className="thead" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1.6fr 1fr 44px' }}><span>Raffle</span><span>Vendor</span><span>Market price</span><span>Draws / month</span><span>Monthly cost</span><span /></div>
          {data.raffles.map((r, i) => (
            <div key={r.id} className="trow a-up" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1.6fr 1fr 44px', height: 52, animationDelay: `${200 + i * 50}ms` }}>
              <b style={{ fontWeight: 600 }}>{r.name}</b>
              <span className="row" style={{ gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: vcol(r.vendor) }} />{r.vendor}</span>
              <span className="mono">{money(r.marketPrice)}</span>
              <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{Array.from({ length: Math.min(r.timesPerMonth, 30) }, (_, j) => <span key={j} className="a-pop" style={{ width: 8, height: 8, borderRadius: '50%', background: C.violet, animationDelay: `${400 + i * 60 + j * 30}ms` }} />)}</span>
              <span className="mono" style={{ color: C.violet, fontWeight: 600 }}>{money(r.marketPrice * r.timesPerMonth)}</span>
              <button className="icon-btn" aria-label={`Edit ${r.name}`} onClick={() => setEditRaffle(r.id)}>{Icon.edit}</button>
            </div>
          ))}
          {data.raffles.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.faint }}>No raffles yet.</div>}
        </Card>
      ) : (
        <>
          <div className="a-up row" style={{ gap: 22, flexWrap: 'wrap', animationDelay: '100ms' }}>
            <Chips title="Category" value={cat} onChange={setCat} options={cats.map((v) => ({ v, n: count((s) => s.product.category === v) }))} />
            <Chips title="Vendor" value={vend} onChange={setVend} options={vendors.map((v) => ({ v, n: count((s) => vendorOf(s.product) === v) }))} />
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
            <Card delay={220} style={{ gridColumn: 'span 2', minWidth: 0 }}>
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div><h2 className="h2">Price vs. monthly budget</h2><div className="caption" style={{ marginTop: 4 }}>Each bubble is a product · size = number of countries · color = vendor</div></div>
                <div style={{ textAlign: 'right', minHeight: 40 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{hpStat ? `${hpStat.product.brand} ${label(hpStat.product)} ${hpStat.product.type}` : top ? `${top.product.brand} ${label(top.product)} = ${money(top.monthly)} / month` : ''}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{hpStat ? `${money(hpStat.monthly)} / month · ${hpStat.countries.join(', ') || 'no country'} · ${vendorOf(hpStat.product)}` : 'Biggest line · hover a bubble, click to edit'}</div>
                </div>
              </div>
              <svg viewBox="0 0 760 330" width="100%" style={{ display: 'block', overflow: 'visible', marginTop: 8 }}>
                {yTicks.map((v) => <g key={v}><line x1={56} x2={744} y1={Y(v)} y2={Y(v)} stroke={C.line} /><text x={46} y={Y(v) + 4} textAnchor="end" fill={C.faint} style={{ font: '11px var(--mono)' }}>{v >= 1000 ? `$${v / 1000}k` : `$${v}`}</text></g>)}
                {xTicks.map((v) => <text key={v} x={X(v)} y={326} textAnchor="middle" fill={C.faint} style={{ font: '11px var(--mono)' }}>${v}</text>)}
                <text x={744} y={306} textAnchor="end" fill={C.ghost} style={{ font: '11px Geist, sans-serif' }}>price in USD →</text>
                <text x={60} y={10} fill={C.ghost} style={{ font: '11px Geist, sans-serif' }}>↑ real budget / month</text>
                {stats.map((s, i) => {
                  const on = match(s)
                  const hov = hp === s.product.id || hb === s.product.brand
                  const r = 5 + Math.min(4, s.countries.length) * 3
                  return (
                    <circle key={s.product.id} className="a-pop" cx={X(calcPriceUSD(s.product)) + ((i * 37) % 7) - 3} cy={Y(s.monthly)} r={hov ? r + 3 : r}
                      fill={vcol(vendorOf(s.product)) + (hov ? 'EE' : '99')} stroke={hov ? '#fff' : '#111215'} strokeWidth={2}
                      style={{ cursor: 'pointer', transformBox: 'fill-box', transformOrigin: 'center', opacity: on ? ((hp !== null || hb) && !hov ? 0.25 : 1) : 0.08, transition: 'r .25s, opacity .25s', animationDelay: `${500 + i * 30}ms` }}
                      onMouseEnter={() => setHp(s.product.id)} onMouseLeave={() => setHp(null)} onClick={() => setEdit(s.product.id)} />
                  )
                })}
              </svg>
              <div className="row" style={{ gap: 16, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                {vendors.map((v) => <span key={v} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: vcol(v) }} />{v} <span className="mono" style={{ color: C.faint }}>{count((s) => vendorOf(s.product) === v)}</span></span>)}
              </div>
            </Card>

            <section className="card a-up" style={{ animationDelay: '340ms', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, borderColor: flags.length ? '#3D2A0A' : C.line, background: flags.length ? '#14100A' : undefined }}>
              <div className="row" style={{ gap: 8, color: flags.length ? C.warn : C.good }}>{Icon.warn}<h2 className="h2">{flags.length ? `Needs attention · ${flags.length}` : 'Catalog looks clean'}</h2></div>
              {flags.map((f, i) => (
                <div key={f.title} className="a-up" style={{ animationDelay: `${500 + i * 110}ms`, display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, background: '#1A1408' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</span><span style={{ fontSize: 12, color: '#B4A27A', lineHeight: 1.45 }}>{f.text}</span>
                </div>
              ))}
            </section>
          </div>

          <section className="a-up" style={{ animationDelay: '460ms', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="between" style={{ alignItems: 'center' }}><h2 className="h2">Brands <span style={{ fontWeight: 400, color: C.faint, fontSize: 13 }}>· by monthly budget · click a price to edit</span></h2></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {brands.map((b, i) => {
                const on = b.items.some(match)
                const v = vendorOf(b.items[0].product)
                const cs = [...new Set(b.items.flatMap((s) => s.countries))]
                return (
                  <div key={b.name} className="a-up" onMouseEnter={() => setHb(b.name)} onMouseLeave={() => setHb(null)}
                    style={{ animationDelay: `${600 + i * 40}ms`, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, transition: 'border-color .2s, background .2s, opacity .2s', background: hb === b.name ? '#15171A' : '#111215', border: `1px solid ${hb === b.name ? '#3A3D44' : C.line}`, opacity: on ? 1 : 0.3 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0, background: vcol(v) + '22', color: vcol(v) }}>{b.name[0]}</span>
                      <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span><span style={{ fontSize: 11, color: C.faint }}>{b.items.length} SKU{b.items.length > 1 ? 's' : ''} · {[...new Set(b.items.map((s) => vendorOf(s.product)))].join(' + ')}</span></span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: b.total > 1000 ? C.lime : C.text }}>{money(b.total * t)}</span>
                    </div>
                    <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {b.items.map((s) => (
                        <button key={s.product.id} onClick={() => setEdit(s.product.id)} title={`${s.product.type} · ${s.product.demandLevel} · ${money(s.monthly)}/mo`}
                          className="mono" style={{ fontSize: 11, padding: '3px 7px', borderRadius: 6, border: `1px solid ${C.line2}`, background: 'transparent', cursor: 'pointer', color: s.activeRows ? '#B4B8BF' : C.faint, textDecoration: s.rows && !s.activeRows ? 'line-through' : 'none' }}>
                          {label(s.product)}{s.product.type === 'Premium' ? ' P' : ''}
                        </button>
                      ))}
                    </div>
                    <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {cs.length ? cs.map((c) => <span key={c} style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#1A1C20', color: C.muted }}>{c}</span>) : <span className="caption">Not allocated</span>}
                      <span style={{ marginLeft: 'auto' }}><DemandChip level={String(b.items[0].product.demandLevel)} /></span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {editStat && <ProductDrawer product={editStat.product} stat={editStat} onClose={() => setEdit(null)} />}
      {editR && <RaffleDrawer raffle={editR} onClose={() => setEditRaffle(null)} />}
    </div>
  )
}
