import { useEffect, useMemo, useState } from 'react'
import { VENDORS, calcDailyQty, calcPriceUSD, calcRealDaily, vendorOf } from '../../lib/calc'
import { useSession } from '../../lib/session'
import { useData, useStore } from '../../lib/store'
import type { VendorOrder } from '../../lib/types'
import { C, Card, Drawer, Icon, money } from '../../ui/kit'
import type { FinancePrefill } from './Finance'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DRAFT_KEY = 'bo2_vendor_order_draft'
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const periodLabel = (o: Pick<VendorOrder, 'period' | 'month' | 'year'>) => `${o.period === 'first' ? 'First' : 'Second'} Half ${MONTHS[o.month - 1]} ${o.year}`

interface Inv { qtyWeHaveNow: number; daysBudgetFor: number; extraItems: number }
interface OrderItem { productId: number; brand: string; lootkeyscode: string; denom: number; region: string; currency: string; price: number; qtyWeHaveNow: number; daysBudgetFor: number; need: number; budget: number; extra: number; extraBudget: number; totalQty: number; totalBudget: number }
interface Draft { step: 1 | 2 | 3; setup: { vendor: string; period: 'first' | 'second'; month: number; year: number; date: string }; inventory: Record<number, Partial<Inv>>; amounts: Record<string, string>; lastOrderId?: number }

function newDraft(): Draft {
  const d = new Date()
  return { step: 1, setup: { vendor: 'Loot Keys', period: d.getDate() <= 15 ? 'first' : 'second', month: d.getMonth() + 1, year: d.getFullYear(), date: todayIso() }, inventory: {}, amounts: {} }
}
function loadDraft(): Draft {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d && d.setup) return d } catch { /* ignore */ }
  return newDraft()
}

function downloadCSV(o: VendorOrder) {
  const items = o.items as OrderItem[]
  const hdr = ['Date', 'Vendor', 'Period', 'Brand', 'LK Code', 'Qty', 'Unit Price', 'Denom', 'Region', 'Total']
  const rows = items.map((it) => [o.date, o.vendor, periodLabel(o), it.brand, it.lootkeyscode, it.totalQty, it.price.toFixed(2), it.denom, it.region, it.totalBudget.toFixed(2)])
  const csv = [hdr, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `order_${o.vendor.replace(/\s+/g, '_')}_${o.date}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function OrderDrawer({ order, onClose, canDelete }: { order: VendorOrder; onClose: () => void; canDelete: boolean }) {
  const { update } = useStore()
  const items = (order.items as OrderItem[]).filter((it) => it.totalQty > 0)
  const brands = [...new Set(items.map((it) => it.brand))]
  return (
    <Drawer open onClose={onClose} title="Vendor order">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">{order.vendor} · {periodLabel(order)}</div><div className="mono" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{money(order.totalUSD, 2)}</div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      {brands.map((b) => (
        <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="label">{b}</div>
          {items.filter((it) => it.brand === b).map((it) => (
            <div key={it.productId} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
              <span className="mono" style={{ color: C.muted }}>{it.lootkeyscode || '—'}</span><span>{it.denom} {it.region}</span><span className="mono">{it.totalQty} × {money(it.price, 2)}</span><span className="mono" style={{ fontWeight: 600 }}>{money(it.totalBudget, 2)}</span>
            </div>
          ))}
        </div>
      ))}
      {items.length === 0 && <div className="caption">This order is a money transfer, not a code list.</div>}
      <div className="row" style={{ marginTop: 'auto' }}>
        {canDelete && <button className="btn" style={{ color: C.bad, borderColor: '#4A1D1D' }} onClick={() => { if (window.confirm('Delete this order?')) { update((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== order.id) })); onClose() } }}>Delete</button>}
        {order.vendor === 'Loot Keys' && items.length > 0 && <button className="btn primary" style={{ flex: 1, justifyContent: 'center', height: 44 }} onClick={() => downloadCSV(order)}>Download CSV</button>}
      </div>
    </Drawer>
  )
}

export default function VendorOrders({ requestTransfer }: { requestTransfer: (p: FinancePrefill) => void }) {
  const data = useData()
  const { update } = useStore()
  const session = useSession()
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [view, setView] = useState<number | null>(null)
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ } }, [draft])
  const { setup, step } = draft
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const isLK = setup.vendor === 'Loot Keys'

  const vendorProds = useMemo(() => data.products.filter((p) => vendorOf(p) === setup.vendor), [data.products, setup.vendor])
  const rows = useMemo(() => vendorProds.map((prod) => {
    let dq = 0
    Object.values(data.allocs).forEach((cr) => { const a = (cr || []).find((r) => r.productId === prod.id); if (a) dq += calcDailyQty(a) })
    const inv: Inv = { qtyWeHaveNow: 0, daysBudgetFor: 15, extraItems: 0, ...(draft.inventory[prod.id] || {}) }
    const need = Math.max(0, Math.ceil(dq * inv.daysBudgetFor) - inv.qtyWeHaveNow)
    const price = calcPriceUSD(prod)
    return { prod, dq, need, price, inv, budget: need * price, totalQty: need + inv.extraItems, totalBudget: (need + inv.extraItems) * price }
  }), [vendorProds, data.allocs, draft.inventory])
  const purposeRows = useMemo(() => {
    const m: Record<string, number> = {}
    vendorProds.forEach((prod) => {
      let d = 0
      Object.values(data.allocs).forEach((cr) => { const a = (cr || []).find((r) => r.productId === prod.id); if (a) d += calcRealDaily(prod, a) })
      const pu = String(prod.purpose || 'MP')
      m[pu] = (m[pu] || 0) + d
    })
    return Object.entries(m).map(([purpose, daily]) => ({ purpose, daily, calc: daily * 15 }))
  }, [vendorProds, data.allocs])
  const lkTotal = rows.reduce((a, r) => a + r.totalBudget, 0)
  const trTotal = purposeRows.reduce((a, r) => a + (draft.amounts[r.purpose] !== undefined ? Number(draft.amounts[r.purpose]) || 0 : r.calc), 0)
  const updInv = (pid: number, k: keyof Inv, v: string) => set({ inventory: { ...draft.inventory, [pid]: { qtyWeHaveNow: 0, daysBudgetFor: 15, extraItems: 0, ...(draft.inventory[pid] || {}), [k]: Math.max(0, Number(v) || 0) } } })

  const generate = () => {
    const order: VendorOrder & { items: OrderItem[] } = {
      id: Date.now(), vendor: setup.vendor, period: setup.period, month: setup.month, year: setup.year, date: setup.date,
      items: rows.map((r) => ({ productId: r.prod.id, brand: r.prod.brand, lootkeyscode: r.prod.lootkeyscode || '', denom: r.prod.priceToBuffLocal, region: r.prod.currency, currency: r.prod.currency, price: r.price,
        qtyWeHaveNow: r.inv.qtyWeHaveNow, daysBudgetFor: r.inv.daysBudgetFor, need: r.need, budget: r.budget, extra: r.inv.extraItems, extraBudget: r.inv.extraItems * r.price, totalQty: r.totalQty, totalBudget: r.totalBudget })),
      totalUSD: isLK ? lkTotal : trTotal, status: 'draft', createdAt: new Date().toISOString(),
    }
    update((s) => ({ ...s, orders: [order, ...s.orders] }))
    set({ step: 3, lastOrderId: order.id })
  }
  const last = data.orders.find((o) => o.id === draft.lastOrderId)
  const viewing = data.orders.find((o) => o.id === view)
  const STEPS = ['Order setup', isLK ? 'Inventory & quantities' : 'Transfer amounts', 'Done']

  return (
    <>
      <Card delay={120} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => {
            const n = (i + 1) as 1 | 2 | 3
            const done = step > n, on = step === n
            return (
              <button key={s} disabled={n > step || step === 3} onClick={() => set({ step: n })} className="row" style={{ gap: 8, border: 'none', background: 'transparent', cursor: n < step && step !== 3 ? 'pointer' : 'default', color: on ? C.text : done ? C.lime : C.faint, fontSize: 13, fontWeight: on ? 600 : 500, padding: 0 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: done ? C.lime : on ? '#1F2226' : 'transparent', color: done ? '#0B0C0E' : 'inherit', border: done ? 'none' : `1px solid ${on ? C.line2 : '#23262B'}` }}>{done ? '✓' : n}</span>{s}
                {i < 2 && <span style={{ width: 28, height: 1, background: '#23262B', marginLeft: 4 }} />}
              </button>
            )
          })}
        </div>

        {step === 1 && (
          <div className="a-up" style={{ display: 'flex', flexDirection: 'column', gap: 16, animationDuration: '.5s' }}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Vendor</span><select className="input" value={setup.vendor} onChange={(e) => set({ setup: { ...setup, vendor: e.target.value }, amounts: {} })}>{VENDORS.map((v) => <option key={v}>{v}</option>)}</select></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Period</span><select className="input" value={setup.period} onChange={(e) => set({ setup: { ...setup, period: e.target.value as 'first' | 'second' } })}><option value="first">First half (1–15)</option><option value="second">Second half (16–end)</option></select></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Month</span><select className="input" value={setup.month} onChange={(e) => set({ setup: { ...setup, month: Number(e.target.value) } })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Year</span><input className="input mono" type="number" value={setup.year} onChange={(e) => set({ setup: { ...setup, year: Number(e.target.value) || setup.year } })} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Order date</span><input className="input" type="date" value={setup.date} onChange={(e) => set({ setup: { ...setup, date: e.target.value } })} /></label>
            </div>
            {vendorProds.length === 0 ? <div className="caption" style={{ color: C.warn }}>No products use {setup.vendor} as their vendor.</div> : <div className="caption">{vendorProds.length} products use {setup.vendor}.</div>}
            <div className="row"><button className="btn primary" disabled={!vendorProds.length} onClick={() => set({ step: 2 })}>Continue →</button></div>
          </div>
        )}

        {step === 2 && isLK && (
          <div className="a-up" style={{ display: 'flex', flexDirection: 'column', gap: 12, animationDuration: '.5s', overflowX: 'auto' }}>
            <div style={{ minWidth: 980 }}>
              <div className="thead" style={{ gridTemplateColumns: '1.3fr 0.9fr 0.6fr 0.6fr 0.7fr 0.7fr 0.6fr 0.8fr 0.6fr 0.6fr 0.9fr' }}><span>Brand</span><span>LK code</span><span>Unit</span><span>/ day</span><span>Days</span><span>Have now</span><span>Need</span><span>Budget</span><span>Extra</span><span>Qty</span><span>Total</span></div>
              {rows.map((r) => (
                <div key={r.prod.id} className="trow" style={{ gridTemplateColumns: '1.3fr 0.9fr 0.6fr 0.6fr 0.7fr 0.7fr 0.6fr 0.8fr 0.6fr 0.6fr 0.9fr', height: 48 }}>
                  <span><b style={{ fontWeight: 600 }}>{r.prod.brand}</b> <span style={{ fontSize: 11, color: C.faint }}>{r.prod.priceToBuffLocal} {r.prod.currency}</span></span>
                  <span className="mono" style={{ fontSize: 12, color: C.muted }}>{r.prod.lootkeyscode || '—'}</span>
                  <span className="mono">{money(r.price, 2)}</span><span className="mono" style={{ color: C.muted }}>{r.dq}</span>
                  <input className="input mono" aria-label="Days" type="number" min={0} value={r.inv.daysBudgetFor} onChange={(e) => updInv(r.prod.id, 'daysBudgetFor', e.target.value)} style={{ height: 32, width: 70 }} />
                  <input className="input mono" aria-label="Have now" type="number" min={0} value={r.inv.qtyWeHaveNow} onChange={(e) => updInv(r.prod.id, 'qtyWeHaveNow', e.target.value)} style={{ height: 32, width: 70 }} />
                  <span className="mono">{r.need}</span><span className="mono" style={{ color: C.muted }}>{money(r.budget, 2)}</span>
                  <input className="input mono" aria-label="Extra" type="number" min={0} value={r.inv.extraItems} onChange={(e) => updInv(r.prod.id, 'extraItems', e.target.value)} style={{ height: 32, width: 60 }} />
                  <span className="mono" style={{ fontWeight: 600 }}>{r.totalQty}</span><span className="mono" style={{ fontWeight: 600, color: C.lime }}>{money(r.totalBudget, 2)}</span>
                </div>
              ))}
            </div>
            <div className="between" style={{ alignItems: 'center' }}><span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{money(lkTotal, 2)}</span><div className="row"><button className="btn" onClick={() => set({ step: 1 })}>← Back</button><button className="btn primary" disabled={!lkTotal} onClick={generate}>Generate order</button></div></div>
          </div>
        )}

        {step === 2 && !isLK && (
          <div className="a-up" style={{ display: 'flex', flexDirection: 'column', gap: 10, animationDuration: '.5s' }}>
            <div className="caption">Money transfer to {setup.vendor} for 15 days, by purpose. Change any amount if needed.</div>
            {purposeRows.map((r) => {
              const v = draft.amounts[r.purpose]
              return (
                <div key={r.purpose} className="row" style={{ gap: 14, padding: '12px 14px', borderRadius: 12, background: '#17191C' }}>
                  <b style={{ flex: 1, fontWeight: 600 }}>{r.purpose === 'MP' ? 'Marketplace' : r.purpose}</b>
                  <span className="caption">{money(r.daily, 2)} / day × 15 = <span className="mono">{money(r.calc, 2)}</span></span>
                  <input className="input mono" aria-label={`${r.purpose} amount`} type="number" min={0} value={v ?? Math.round(r.calc * 100) / 100} onChange={(e) => set({ amounts: { ...draft.amounts, [r.purpose]: e.target.value } })} style={{ width: 130, height: 36, textAlign: 'right', borderColor: v !== undefined && Number(v) !== Math.round(r.calc * 100) / 100 ? C.warn : undefined }} />
                </div>
              )
            })}
            <div className="between" style={{ alignItems: 'center' }}><span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{money(trTotal, 2)}</span><div className="row"><button className="btn" onClick={() => set({ step: 1 })}>← Back</button><button className="btn primary" disabled={!trTotal} onClick={generate}>Generate order</button></div></div>
          </div>
        )}

        {step === 3 && (
          <div className="a-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start', animationDuration: '.5s' }}>
            <div className="row" style={{ gap: 12 }}><span style={{ width: 36, height: 36, borderRadius: '50%', background: C.lime, color: '#0B0C0E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</span><div><div style={{ fontWeight: 600, fontSize: 16 }}>Order created · {last ? money(last.totalUSD, 2) : ''}</div><div className="caption">{setup.vendor} · {periodLabel(setup)} · saved as draft</div></div></div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {last && <button className="btn primary" onClick={() => requestTransfer({ vendor: setup.vendor, amount: Math.round(last.totalUSD), note: periodLabel(setup) })}>Create finance request →</button>}
              {last && <button className="btn" onClick={() => setView(last.id)}>View order</button>}
              <button className="btn" onClick={() => setDraft(newDraft())}>New order</button>
            </div>
          </div>
        )}
      </Card>

      <Card pad={false} delay={220}>
        <div className="between" style={{ alignItems: 'center', padding: '14px 20px' }}><h2 className="h2">Order history</h2><span className="caption">{data.orders.length} orders</span></div>
        <div className="thead" style={{ gridTemplateColumns: '0.9fr 1fr 1.6fr 1fr 1fr 44px' }}><span>Date</span><span>Vendor</span><span>Period</span><span>Total</span><span>Status</span><span /></div>
        {data.orders.map((o) => (
          <div key={o.id} className="trow" style={{ gridTemplateColumns: '0.9fr 1fr 1.6fr 1fr 1fr 44px', height: 50 }}>
            <span className="mono" style={{ fontSize: 12 }}>{o.date}</span><b style={{ fontWeight: 600 }}>{o.vendor}</b><span>{periodLabel(o)}</span><span className="mono">{money(o.totalUSD, 2)}</span>
            <select className="input" aria-label="Order status" value={o.status} onChange={(e) => update((s) => ({ ...s, orders: s.orders.map((x) => (x.id === o.id ? { ...x, status: e.target.value } : x)) }))} style={{ height: 32, width: 120, fontSize: 12 }}><option value="draft">Draft</option><option value="sent">Sent</option><option value="delivered">Delivered</option></select>
            <button className="icon-btn" aria-label="View order" onClick={() => setView(o.id)}>{Icon.edit}</button>
          </div>
        ))}
        {data.orders.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: C.faint }}>No orders yet — create the first one above.</div>}
      </Card>
      {viewing && <OrderDrawer order={viewing} canDelete={session.isAdmin} onClose={() => setView(null)} />}
    </>
  )
}
