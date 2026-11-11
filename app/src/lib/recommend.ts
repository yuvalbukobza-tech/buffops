// End-of-period recommendations: what to do with the budget that will be left over.
// 1) repeat the raffles users join most per prize dollar; 2) open more of the marketplace products
// whose demand beats supply all period, in proportion to demand, capped at what users can absorb.
// Pure functions — covered by recommend.test.ts.
import type { RaffleRow } from './types'
import { addDays, daysBetween, faceValueUSD, norm, type ProductLine } from './utilization'

/** Recommendations switch from "preview" to "act now" this many days before the period ends (today included). */
export const LAST_DAYS = 3
/** At most this share of the leftover goes to raffles (the rest opens more products). */
export const RAFFLE_SHARE = 0.3
/** Extra units per product: at most this many times its current daily sales over the days left. */
export const ABSORB = 1
export const BUFFS_PER_USD = 220

// ── Raffles ─────────────────────────────────────────────────────────────────────
export interface RaffleStat {
  key: string; title: string; countries: string
  runs: number            // finished runs in the look-back window
  avgDays: number         // typical length
  entriesPerDay: number   // average over finished runs
  valueUSD: number | null // prize value (all prizes of one run); null if unknown
  buffs: boolean          // prize is Buffs (no code to buy — not paid from this budget)
  perDollar: number | null
  liveNow: boolean        // a run with this title + countries is live today
  lastEnd: string
}

const clean = (s: string | null) => (s || '').replace(/[{}]/g, '').replace(/,/g, ', ')

/** Value of one run: face value in the title, else in the prize names (× count); Buffs at 220 per $1. */
export function raffleValue(r: Pick<RaffleRow, 'title' | 'prizes'>): { usd: number | null; buffs: boolean } {
  const t = r.title || ''
  const b = /([\d,]+)\s*buffs/i.exec(t)
  if (b) return { usd: Number(b[1].replace(/,/g, '')) / BUFFS_PER_USD, buffs: true }
  const face = faceValueUSD(t)
  const count = Math.max(1, ...(r.prizes || '').split(' + ').map((p) => Number(/^(\d+)x /.exec(p)?.[1] || 1)))
  if (face > 0) return { usd: face * count, buffs: false }
  let fromPrizes = 0
  for (const p of (r.prizes || '').split(' + ')) {
    const m = /^(\d+)x (.*)$/.exec(p)
    if (m) fromPrizes += Number(m[1]) * faceValueUSD(m[2])
  }
  return { usd: fromPrizes > 0 ? fromPrizes : null, buffs: false }
}

/** Normalized names of every raffle prize ("1x €25 Game Boost Gift Card" → "€25 game boost gift card"), to tag those gift cards as raffle spend. */
export function rafflePrizeNames(rows: RaffleRow[]): Set<string> {
  const out = new Set<string>()
  for (const r of rows) for (const p of (r.prizes || '').split(' + ')) {
    const name = p.replace(/^\d+x /, '')
    if (name && name !== 'Raffle prize') out.add(norm(name))
  }
  return out
}

/** Per title + countries: how many people join per day, and per prize dollar, over the last `lookback` days. */
export function raffleStats(rows: RaffleRow[], today: string, lookback = 60): RaffleStat[] {
  const since = addDays(today, -lookback)
  const groups = new Map<string, RaffleRow[]>()
  for (const r of rows) {
    const key = `${(r.title || '').trim()}|${clean(r.countries)}`
    groups.set(key, [...(groups.get(key) || []), r])
  }
  const out: RaffleStat[] = []
  for (const [key, rs] of groups) {
    const finished = rs.filter((r) => String(r.end_day).slice(0, 10) < today && String(r.end_day).slice(0, 10) >= since && (r.entries || 0) > 0)
    const live = rs.some((r) => String(r.start_day).slice(0, 10) <= today && String(r.end_day).slice(0, 10) >= today && r.status !== 'FINISHED')
    if (!finished.length) continue
    const len = (r: RaffleRow) => Math.max(1, daysBetween(String(r.start_day).slice(0, 10), String(r.end_day).slice(0, 10)))
    const entriesPerDay = finished.reduce((a, r) => a + (r.entries || 0) / len(r), 0) / finished.length
    const avgDays = finished.reduce((a, r) => a + len(r), 0) / finished.length
    // One title can have runs whose prize name says the value and runs that just say "Raffle prize": take the known one.
    const vals = rs.map(raffleValue)
    const known = vals.filter((v) => v.usd !== null).map((v) => v.usd as number)
    const valueUSD = known.length ? Math.max(...known) : null
    out.push({
      key, title: (rs[0].title || '').trim(), countries: clean(rs[0].countries), runs: finished.length,
      avgDays, entriesPerDay, valueUSD, buffs: vals.some((v) => v.buffs),
      perDollar: valueUSD ? entriesPerDay / valueUSD : null, liveNow: live,
      lastEnd: finished.map((r) => String(r.end_day).slice(0, 10)).sort().at(-1)!,
    })
  }
  return out.sort((a, b) => (b.perDollar ?? -1) - (a.perDollar ?? -1) || b.entriesPerDay - a.entriesPerDay)
}

// ── The plan ───────────────────────────────────────────────────────────────────
export interface RaffleRec { stat: RaffleStat; days: number; cost: number }
export interface ProductRec { line: ProductLine; units: number; perDay: number; cost: number }
export interface LeftoverPlan {
  leftover: number
  daysLeft: number
  raffles: RaffleRec[]
  products: ProductRec[]
  unallocated: number
}

const DEMAND_FLAGS = new Set(['soldout', 'over', 'capped'])

/**
 * Splits `leftover` dollars over the `daysLeft` remaining days (today included).
 * Raffles first (≤ RAFFLE_SHARE of the leftover, best entries-per-dollar, code prizes only, not already live),
 * then products whose users bought everything opened, weighted by their daily spend × how far demand beats the plan.
 */
export function planLeftover(leftover: number, daysLeft: number, lines: ProductLine[], raffles: RaffleStat[]): LeftoverPlan {
  const plan: LeftoverPlan = { leftover, daysLeft, raffles: [], products: [], unallocated: Math.max(0, leftover) }
  if (!(leftover > 0) || daysLeft < 1) return plan

  const pickRaffles = (budget: number, max: number) => {
    for (const s of raffles) {
      if (plan.raffles.length >= max || budget <= 0) break
      if (s.buffs || s.liveNow || !s.valueUSD || s.perDollar === null || s.valueUSD > budget) continue
      if (plan.raffles.some((r) => r.stat.key === s.key)) continue
      plan.raffles.push({ stat: s, days: Math.min(daysLeft, Math.max(1, Math.round(s.avgDays))), cost: s.valueUSD })
      budget -= s.valueUSD
      plan.unallocated -= s.valueUSD
    }
  }
  pickRaffles(leftover * RAFFLE_SHARE, 2)

  const cands = lines
    .filter((l) => DEMAND_FLAGS.has(l.flag) && l.units > 0 && l.unitUSD > 0 && l.source !== 'flat' && l.source !== 'none')
    .map((l) => ({
      line: l,
      weight: l.perDay * l.unitUSD * Math.min(2, Math.max(1, l.sellThrough ?? 1.5)),
      cap: Math.max(1, Math.ceil(l.perDay * daysLeft * ABSORB)),
      units: 0,
    }))
  // Proportional passes; whatever a capped product can't take flows to the others.
  for (let pass = 0; pass < 4; pass++) {
    const open = cands.filter((c) => c.units < c.cap)
    const w = open.reduce((a, c) => a + c.weight, 0)
    if (!open.length || !w || plan.unallocated <= 0) break
    const pot = plan.unallocated
    let spent = 0
    for (const c of open) {
      const add = Math.min(c.cap - c.units, Math.floor((pot * c.weight) / w / c.line.unitUSD))
      c.units += add
      spent += add * c.line.unitUSD
    }
    plan.unallocated -= spent
    if (!spent) break
  }
  // Leftover cents: one more unit at a time, biggest demand first.
  for (const c of [...cands].sort((a, b) => b.weight - a.weight)) {
    while (c.units < c.cap && c.line.unitUSD <= plan.unallocated) { c.units++; plan.unallocated -= c.line.unitUSD }
  }
  plan.products = cands.filter((c) => c.units > 0)
    .map((c) => ({ line: c.line, units: c.units, perDay: c.units / daysLeft, cost: c.units * c.line.unitUSD }))
    .sort((a, b) => b.cost - a.cost)
  // Products can't absorb it all → one more raffle if a good one fits.
  if (plan.unallocated > leftover * 0.15) pickRaffles(plan.unallocated, 3)
  plan.unallocated = Math.max(0, Math.round(plan.unallocated * 100) / 100)
  return plan
}
