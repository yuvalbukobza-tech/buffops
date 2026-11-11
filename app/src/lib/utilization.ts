// Marketplace budget utilization: budget periods (entered by hand), real spend per day
// (gift cards bought × unit price), pace, forecast, and how each product sells against the plan.
// Pure functions — covered by utilization.test.ts.
import { FX, calcDailyQty, calcPriceUSD, isAllocActive, matchProduct } from './calc'
import type { AllocRow, Allocs, BudgetPeriod, MpDailyRow, MpStockRow, Product } from './types'

/** Items with no price in their name (charity, physical items, …) — same flat rule as the monthly marketplace report. */
export const FLAT_UNPRICED_USD = 0.66

// ── Days and periods ───────────────────────────────────────────────────────────
// Days are ISO strings (YYYY-MM-DD); all date math is done in UTC so time zones can't shift a day.
const toUTC = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (d: string, n: number) => fromUTC(toUTC(d) + n * 86400000)
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000)
/** Every day from a to b, both included. */
export function dayList(a: string, b: string): string[] {
  const out: string[] = []
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
  return out
}

/** "YYYY-MM-A" = 1st–15th, "YYYY-MM-B" = 16th–end of month (same halves as vendor orders). */
export const periodOf = (day: string) => `${day.slice(0, 7)}-${+day.slice(8, 10) <= 15 ? 'A' : 'B'}`

export function periodRange(id: string): { start: string; end: string; days: number } {
  const y = +id.slice(0, 4), m = +id.slice(5, 7), half = id.slice(8)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const s = half === 'A' ? 1 : 16, e = half === 'A' ? 15 : last
  const ym = id.slice(0, 7)
  return { start: `${ym}-${String(s).padStart(2, '0')}`, end: `${ym}-${String(e).padStart(2, '0')}`, days: e - s + 1 }
}

export function shiftPeriod(id: string, n: number): string {
  let y = +id.slice(0, 4), m = +id.slice(5, 7), idx = id.slice(8) === 'A' ? 0 : 1
  idx += n
  while (idx > 1) { idx -= 2; m++ }
  while (idx < 0) { idx += 2; m-- }
  while (m > 12) { m -= 12; y++ }
  while (m < 1) { m += 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}-${idx === 0 ? 'A' : 'B'}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function periodLabel(id: string): string {
  const r = periodRange(id)
  return `${MONTHS[+id.slice(5, 7) - 1]} ${+r.start.slice(8)}–${+r.end.slice(8)}, ${id.slice(0, 4)}`
}
export const monthLabel = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`
export const dayLabel = (d: string) => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8)}`

// ── Budgets ─────────────────────────────────────────────────────────────────────
// A half-month entry ("2026-11-A") wins; otherwise the latest standing monthly budget ("M:2026-11")
// from that month or before, split by days so every day of the month gets the same amount.
export const monthlyId = (ym: string) => `M:${ym}`
const valid = (p?: BudgetPeriod) => (p && Number.isFinite(p.amountUSD) && p.amountUSD > 0 ? p : undefined)
const daysInMonth = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()

/** The standing monthly budget that applies in month ym (YYYY-MM), if any. */
export function monthlyFor(periods: BudgetPeriod[], ym: string): BudgetPeriod | undefined {
  return periods.filter((p) => p.id.startsWith('M:') && p.id.slice(2) <= ym && valid(p)).sort((a, b) => b.id.localeCompare(a.id))[0]
}

export interface BudgetInfo { amount: number | null; from: 'period' | 'monthly' | null; monthly?: BudgetPeriod; entry?: BudgetPeriod }
export function budgetInfo(periods: BudgetPeriod[], id: string): BudgetInfo {
  const entry = valid(periods.find((x) => x.id === id))
  const monthly = monthlyFor(periods, id.slice(0, 7))
  if (entry) return { amount: entry.amountUSD, from: 'period', monthly, entry }
  if (monthly) return { amount: Math.round((monthly.amountUSD * periodRange(id).days * 100) / daysInMonth(id.slice(0, 7))) / 100, from: 'monthly', monthly }
  return { amount: null, from: null }
}
export const budgetOf = (periods: BudgetPeriod[], id: string): number | null => budgetInfo(periods, id).amount

/** Budget for one day = its period's budget spread evenly over the period's days; null if the period has none. */
export function dailyBudget(day: string, periods: BudgetPeriod[]): number | null {
  const id = periodOf(day)
  const b = budgetOf(periods, id)
  return b === null ? null : b / periodRange(id).days
}

/** Insert or replace a budget entry (half-month or "M:" monthly); 0 / empty removes it. */
export function upsertBudget(periods: BudgetPeriod[], id: string, amountUSD: number, by?: string, now = new Date().toISOString()): BudgetPeriod[] {
  const rest = periods.filter((p) => p.id !== id)
  if (!(amountUSD > 0)) return rest
  const prev = periods.find((p) => p.id === id)
  return [...rest, { ...prev, id, amountUSD: Math.round(amountUSD * 100) / 100, updatedAt: now, updatedBy: by }].sort((a, b) => a.id.localeCompare(b.id))
}

// ── Unit price of a bought item ─────────────────────────────────────────────────
/** plan = BuffOps product price · face = value in the name · flat = $0.66 rule (marketplace only) · none = no price known (counted as $0). */
export type PriceSource = 'plan' | 'face' | 'flat' | 'none'
export interface Pricing { usd: number; source: PriceSource; productId?: number; purpose?: string }

/** Face value from the name: "$5 …", "£10 …", "€5 …" (also CA$ / A$), converted to USD. 0 if none. */
export function faceValueUSD(name: string | null | undefined): number {
  const m = /(CA\$|A\$|US\$|\$|£|€)\s*(\d+(?:\.\d+)?)/.exec(name || '')
  if (!m) return 0
  const cur = m[1] === '£' ? 'GBP' : m[1] === '€' ? 'EUR' : m[1] === 'CA$' ? 'CAD' : m[1] === 'A$' ? 'AUD' : 'USD'
  return parseFloat(m[2]) * (FX[cur] || 1)
}

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Price per unit for a name: a BuffOps product whose Redash name is exactly this name, or the product
 * an allocation matches; else the face value in the name; else the flat rate for marketplace items
 * (charity and the like) and NO price for internal-stock prizes (a headset is not worth $0.66).
 * Memoized per name.
 */
export function makePricer(allocs: Allocs, products: Product[]): (name: string, internal?: boolean) => Pricing {
  const all: AllocRow[] = Object.values(allocs).flat().filter(Boolean)
  const byName = new Map<string, Product>()
  for (const p of products) if (p.redashName) byName.set(norm(p.redashName), p)
  const cache = new Map<string, Pricing>()
  return (name: string, internal = false) => {
    const key = (internal ? 'i|' : 'm|') + name
    let p = cache.get(key)
    if (p) return p
    let prod = byName.get(norm(name))
    if (!prod) {
      const m = matchProduct(name, all, products)
      prod = m && !m.weak ? products.find((x) => x.id === m.alloc.productId) : undefined
    }
    const planUsd = prod ? calcPriceUSD(prod) : 0
    const face = faceValueUSD(name)
    const base = { productId: prod?.id, purpose: prod?.purpose }
    p = planUsd > 0 ? { ...base, usd: planUsd, source: 'plan' }
      : face > 0 ? { ...base, usd: face, source: 'face' }
      : internal ? { ...base, usd: 0, source: 'none' }
      : { ...base, usd: FLAT_UNPRICED_USD, source: 'flat' }
    cache.set(key, p)
    return p
  }
}

// ── What kind of reward a row is ───────────────────────────────────────────────
export type Kind = 'mp' | 'buffpass' | 'raffle' | 'other'
export const KINDS: Kind[] = ['mp', 'buffpass', 'raffle', 'other']
export const KIND_LABEL: Record<Kind, string> = { mp: 'Marketplace', buffpass: 'Buff Pass', raffle: 'Raffles', other: 'Other prizes' }
export const isInternal = (r: Pick<MpDailyRow, 'source'>) => r.source === 'INTERNAL_STORAGE'

/**
 * Until April 2026 Buff Pass prizes had no "- buffpass" in the name: plain "$50 Steam" / "$50 Amazon Gift Card"
 * from internal stock (they stop exactly when the suffixed names start). Confirmed by Yuval 2026-11-11.
 * Limited to days before May 2026 so a future card with that name isn't counted as Buff Pass by accident.
 */
export const LEGACY_BUFFPASS_UNTIL = '2026-05-01'
export const isLegacyBuffPass = (name: string, day?: string) =>
  !!day && String(day).slice(0, 10) < LEGACY_BUFFPASS_UNTIL && /^\$50 (steam|amazon gift card)$/i.test(name.trim().replace(/\s+/g, ' '))

/**
 * Marketplace purchases are 'mp'; internal-stock prizes by their BuffOps product purpose, else by name,
 * else 'raffle' when the name is a prize of a raffle (rafflePrizes = normalized prize names from the Raffles Service).
 */
export function kindOf(r: Pick<MpDailyRow, 'source' | 'product_name'> & { day?: string }, purpose?: string, rafflePrizes?: Set<string>): Kind {
  if (!isInternal(r)) return 'mp'
  const n = r.product_name || ''
  if (purpose === 'Buff Pass' || /buff\s*pass/i.test(n) || isLegacyBuffPass(n, r.day)) return 'buffpass'
  if (purpose === 'Raffles' || /raffle/i.test(n) || rafflePrizes?.has(norm(n))) return 'raffle'
  return 'other'
}

// ── Spend per day ───────────────────────────────────────────────────────────────
export interface DaySpend { usd: number; units: number; kinds: Record<Kind, number> }
type Pricer = (name: string, internal?: boolean) => Pricing

/** Spend per day over every reward kind (marketplace + internal-stock prizes), with the split by kind. */
export function spendByDay(rows: MpDailyRow[], price: Pricer, rafflePrizes?: Set<string>): Map<string, DaySpend> {
  const out = new Map<string, DaySpend>()
  for (const r of rows) {
    const day = String(r.day).slice(0, 10)
    const name = (r.product_name || '').trim()
    const n = Number(r.purchases) || 0
    if (!name || !n) continue
    const pr = price(name, isInternal(r))
    const e = out.get(day) || { usd: 0, units: 0, kinds: { mp: 0, buffpass: 0, raffle: 0, other: 0 } }
    e.usd += n * pr.usd
    e.units += n
    e.kinds[kindOf(r, pr.purpose, rafflePrizes)] += n * pr.usd
    out.set(day, e)
  }
  return out
}

/** Sum of the kind split over [from, to]. */
export function kindTotals(byDay: Map<string, DaySpend>, from: string, to: string): Record<Kind, number> {
  const t: Record<Kind, number> = { mp: 0, buffpass: 0, raffle: 0, other: 0 }
  for (const [d, s] of byDay) if (d >= from && d <= to) for (const k of KINDS) t[k] += s.kinds[k]
  return t
}

/** Internal-stock prizes (Buff Pass, raffles, other) given in [from, to], one line per name. */
export interface PrizeLine { name: string; kind: Kind; units: number; unitUSD: number; source: PriceSource; spent: number }
export function prizeLines(rows: MpDailyRow[], from: string, to: string, price: Pricer, rafflePrizes?: Set<string>): PrizeLine[] {
  const agg = new Map<string, PrizeLine>()
  for (const r of rows) {
    const d = String(r.day).slice(0, 10)
    const name = (r.product_name || '').trim()
    if (!isInternal(r) || !name || d < from || d > to) continue
    const pr = price(name, true)
    const e = agg.get(name) || { name, kind: kindOf(r, pr.purpose, rafflePrizes), units: 0, unitUSD: pr.usd, source: pr.source, spent: 0 }
    e.units += Number(r.purchases) || 0
    e.spent = e.units * e.unitUSD
    agg.set(name, e)
  }
  return [...agg.values()].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || b.spent - a.spent || b.units - a.units)
}

// ── One period: spend so far, pace, forecast ──────────────────────────────────
export interface PeriodSummary {
  id: string; start: string; end: string; days: number
  budget: number | null
  /** Days of the period before today (all of them once the period is over). */
  completeDays: number
  /** Today is inside the period. */
  current: boolean
  future: boolean
  spent: number          // everything bought in the period so far, today included
  spentComplete: number  // complete days only (pace and forecast use these)
  today: number          // bought today so far
  expectedByNow: number | null  // budget × completeDays / days
  pace: number | null            // spentComplete / expectedByNow (1 = on track)
  runRate: number | null         // average per day over the last ≤7 complete days
  forecast: number | null        // spend at period end if the run rate holds
  projectedUnused: number | null // budget − forecast (negative = over budget)
  utilization: number | null     // spent / budget
}

export function summarizePeriod(id: string, byDay: Map<string, DaySpend>, periods: BudgetPeriod[], today: string): PeriodSummary {
  const { start, end, days } = periodRange(id)
  const budget = budgetOf(periods, id)
  const future = today < start
  const current = today >= start && today <= end
  const completeDays = future ? 0 : current ? daysBetween(start, today) : days
  const spendOn = (d: string) => byDay.get(d)?.usd || 0
  let spentComplete = 0
  for (let i = 0; i < completeDays; i++) spentComplete += spendOn(addDays(start, i))
  const todaySpend = current ? spendOn(today) : 0
  const spent = spentComplete + todaySpend
  const window = Math.min(7, completeDays)
  let recent = 0
  for (let i = completeDays - window; i < completeDays; i++) recent += spendOn(addDays(start, i))
  const runRate = window > 0 ? recent / window : null
  const forecast = future ? null : !current ? spent : runRate === null ? null : spentComplete + runRate * (days - completeDays)
  const expectedByNow = budget === null ? null : (budget * completeDays) / days
  return {
    id, start, end, days, budget, completeDays, current, future, spent, spentComplete, today: todaySpend,
    expectedByNow,
    pace: expectedByNow ? spentComplete / expectedByNow : null,
    runRate, forecast,
    projectedUnused: budget === null || forecast === null ? null : budget - forecast,
    utilization: budget ? spent / budget : null,
  }
}

// ── Day / week / month buckets ──────────────────────────────────────────────────
export type Grain = 'day' | 'week' | 'month'
export interface Bucket {
  key: string; label: string; start: string; end: string
  /** Days counted (up to today). */
  days: number
  spent: number; units: number
  /** Spend split by reward kind (sums to `spent`). */
  kinds: Record<Kind, number>
  /** Budget for the counted days; null when a counted day has no budget. */
  budget: number | null
  utilization: number | null
  /** The bucket includes today or is cut by the window (numbers are to date). */
  partial: boolean
  /** The window starts after the bucket does (its first days are not counted). */
  cutStart: boolean
}

const mondayOf = (d: string) => addDays(d, -((new Date(toUTC(d)).getUTCDay() + 6) % 7))
const monthEnd = (ym: string) => `${ym}-${String(new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()).padStart(2, '0')}`

export function buckets(grain: Grain, from: string, to: string, today: string, byDay: Map<string, DaySpend>, periods: BudgetPeriod[]): Bucket[] {
  const last = to < today ? to : today
  const map = new Map<string, Bucket>()
  for (const d of dayList(from, last)) {
    const key = grain === 'day' ? d : grain === 'week' ? mondayOf(d) : d.slice(0, 7)
    let b = map.get(key)
    if (!b) {
      const start = grain === 'month' ? `${key}-01` : key
      const end = grain === 'day' ? key : grain === 'week' ? addDays(key, 6) : monthEnd(key)
      const label = grain === 'day' ? dayLabel(d) : grain === 'week' ? `${dayLabel(key)} – ${dayLabel(end)}` : monthLabel(key)
      b = {
        key, label, start, end, days: 0, spent: 0, units: 0, kinds: { mp: 0, buffpass: 0, raffle: 0, other: 0 },
        budget: 0, utilization: null, partial: end > last || end >= today || start < from, cutStart: start < from,
      }
      map.set(key, b)
    }
    b.days++
    const s = byDay.get(d)
    if (s) { b.spent += s.usd; b.units += s.units; for (const k of KINDS) b.kinds[k] += s.kinds[k] }
    const db = dailyBudget(d, periods)
    b.budget = b.budget === null || db === null ? null : b.budget + db
  }
  return [...map.values()].map((b) => ({ ...b, utilization: b.budget ? b.spent / b.budget : null }))
}

// ── Per product, for one window ─────────────────────────────────────────────────
export type Flag = 'soldout' | 'over' | 'capped' | 'slow' | 'unbought' | 'unplanned' | 'ok'
/** Bought this much more than the plan opens → the live marketplace setup is not what BuffOps plans. */
export const OVER_PLAN = 1.2
export interface ProductLine {
  name: string
  units: number
  spent: number
  share: number          // of the window's spend
  unitUSD: number
  source: PriceSource
  perDay: number         // bought per day over the window
  plannedPerDay: number  // units opened per day in BuffOps allocations (all countries)
  sellThrough: number | null
  live?: { outOfStock: boolean; restocksPerDay: number | null; p30: number | null }
  flag: Flag
}

const liveKey = (s: string) => s.trim().toLowerCase()

/** Marketplace purchases only (internal-stock prizes are in prizeLines). */
export function productLines(rows: MpDailyRow[], from: string, to: string, days: number, data: { allocs: Allocs; products: Product[] }, price: Pricer, stock?: MpStockRow[] | null): ProductLine[] {
  // Units opened per day per BuffOps product (active rows, every country, marketplace purpose only).
  const planned = new Map<number, number>()
  for (const rowsC of Object.values(data.allocs)) for (const r of rowsC || []) {
    if (!isAllocActive(r)) continue
    const p = data.products.find((x) => x.id === r.productId)
    if (!p || (p.purpose && p.purpose !== 'MP')) continue
    planned.set(p.id, (planned.get(p.id) || 0) + calcDailyQty(r))
  }
  const live = new Map<string, NonNullable<ProductLine['live']>>()
  for (const s of stock || []) {
    const k = liveKey(s.product_name || '')
    if (!k) continue
    // Several items can share a name (regular + premium): sold out if any is, restocks and demand add up.
    const prev = live.get(k)
    const add = (a: number | null | undefined, b: number | null | undefined) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0))
    live.set(k, {
      outOfStock: Boolean(prev?.outOfStock || s.out_of_stock),
      restocksPerDay: add(prev?.restocksPerDay, s.daily_restocks),
      p30: add(prev?.p30, s.p30),
    })
  }
  const agg = new Map<string, { units: number }>()
  for (const r of rows) {
    const d = String(r.day).slice(0, 10)
    if (d < from || d > to || isInternal(r)) continue
    const name = (r.product_name || '').trim()
    if (!name) continue
    const e = agg.get(name) || { units: 0 }
    e.units += Number(r.purchases) || 0
    agg.set(name, e)
  }
  const usedIds = new Set<number>()
  const lines: ProductLine[] = [...agg.entries()].map(([name, { units }]) => {
    const pr = price(name)
    if (pr.productId !== undefined) usedIds.add(pr.productId)
    return line(name, units, pr.usd, pr.source, pr.productId !== undefined ? planned.get(pr.productId) || 0 : 0, live.get(liveKey(name)))
  })
  // Opened in the plan but nobody bought it in this window — budget that never turned into rewards.
  for (const [id, perDay] of planned) {
    if (usedIds.has(id) || perDay <= 0) continue
    const p = data.products.find((x) => x.id === id)!
    lines.push(line(p.redashName || `${p.brand} ${calcPriceUSD(p) ? '$' + Math.round(calcPriceUSD(p) * 100) / 100 : ''}`.trim(), 0, calcPriceUSD(p), 'plan', perDay, undefined))
  }
  const total = lines.reduce((a, l) => a + l.spent, 0)
  return lines.map((l) => ({ ...l, share: total ? l.spent / total : 0 })).sort((a, b) => b.spent - a.spent || b.plannedPerDay - a.plannedPerDay)

  function line(name: string, units: number, unitUSD: number, source: PriceSource, plannedPerDay: number, lv: ProductLine['live']): ProductLine {
    const perDay = days > 0 ? units / days : 0
    const sellThrough = plannedPerDay > 0 ? perDay / plannedPerDay : null
    const flag: Flag = lv?.outOfStock ? 'soldout'
      : plannedPerDay > 0 && units === 0 ? 'unbought'
      : sellThrough !== null && sellThrough > OVER_PLAN ? 'over'
      : sellThrough !== null && sellThrough >= 0.95 ? 'capped'
      : sellThrough !== null && sellThrough < 0.5 ? 'slow'
      : plannedPerDay === 0 ? 'unplanned' : 'ok'
    return { name, units, spent: units * unitUSD, share: 0, unitUSD, source, perDay, plannedPerDay, sellThrough, live: lv, flag }
  }
}

/** Spend by price source, so the screen can say how much is exact vs estimated. */
export function spendBySource(lines: ProductLine[]): Record<PriceSource, number> {
  const out: Record<PriceSource, number> = { plan: 0, face: 0, flat: 0, none: 0 }
  for (const l of lines) out[l.source] += l.spent
  return out
}
