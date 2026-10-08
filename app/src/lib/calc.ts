// Business math, ported 1:1 from BuffOps v1 (index.html helpers). Covered by calc.test.ts.
import type { AllocRow, Allocs, BudgetExtra, Product, Raffle } from './types'

export const COUNTRIES = ['US', 'GB', 'DE', 'ES', 'NZ', 'JP', 'IT', 'AE', 'CA', 'SE', 'BE', 'MX', 'CH', 'FR', 'AU', 'PK', 'ID', 'IN', 'TR']
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'BRL', 'AUD', 'AED', 'NZD', 'JPY', 'SEK', 'MXN', 'CHF', 'INR', 'PKR', 'IDR', 'TRY']
export const DEMAND_LEVELS = ['Low', 'Medium', 'High', 'Very High'] as const
export const VENDORS = ['GCOW', 'Loot Keys', 'Kinguin', 'Riot Internal', 'Internal', 'Other']
export const PURPOSES = ['MP', 'Raffles', 'Buff Pass']
export const DAYS_PER_MONTH = 30.5

// USD per 1 unit of currency (hardcoded in v1)
export const FX: Record<string, number> = {
  USD: 1, EUR: 1.17, GBP: 1.34, CAD: 0.73, BRL: 0.18, AUD: 0.66, AED: 0.27, NZD: 0.60,
  JPY: 0.0067, SEK: 0.093, MXN: 0.051, CHF: 1.08, INR: 0.012, PKR: 0.0036, IDR: 0.000063, TRY: 0.028,
}

export const DEMAND_BASE: Record<string, number> = { 'Low': 0.40, 'Medium': 0.65, 'High': 0.82, 'Very High': 0.95 }

export function pulseFactor(pulsesPerDay: number): number {
  if (pulsesPerDay <= 1) return 1.00
  if (pulsesPerDay <= 2) return 0.88
  if (pulsesPerDay <= 3) return 0.80
  if (pulsesPerDay <= 4) return 0.72
  if (pulsesPerDay <= 6) return 0.64
  if (pulsesPerDay <= 8) return 0.56
  return 0.50
}

export function calcUtilization(demandLevel: string, pulsesPerDay: number): number {
  return (DEMAND_BASE[demandLevel] ?? 0.65) * pulseFactor(pulsesPerDay)
}

export function calcPriceUSD(p: Pick<Product, 'priceToBuffLocal' | 'currency'>): number {
  return p.priceToBuffLocal * (FX[p.currency] || 1)
}

export function isAllocActive(r?: AllocRow | null): boolean {
  return !r || r.active !== false
}

export function calcDailyQty(r: AllocRow): number {
  if (!isAllocActive(r)) return 0
  return (r.pulsesPerDay || 0) * (r.qtyPerPulse || 0)
}

/** Planned spend per day (before utilization). */
export function calcDailyBudget(p: Product, r: AllocRow): number {
  return calcPriceUSD(p) * calcDailyQty(r)
}

/** Expected real spend per day = planned × utilization. */
export function calcRealDaily(p: Product, r: AllocRow): number {
  return calcDailyBudget(p, r) * calcUtilization(String(p.demandLevel), r.pulsesPerDay)
}

export function vendorOf(p: Product): string {
  return p.vendor || p.provider || 'Unknown'
}

export function priceFromName(name: string | null | undefined): number {
  const m = /\$(\d+(?:\.\d+)?)/.exec(name || '')
  return m ? parseFloat(m[1]) : 0
}

export interface Match { alloc: AllocRow; score: number; via: 'exact' | 'auto'; weak?: boolean }

/** Match a Redash product name to one of a country's allocations (v1 scoring, score ≥3 = match, 2 = weak). */
export function matchProduct(redashName: string, countryAllocs: AllocRow[], products: Product[]): Match | null {
  const redashPrice = priceFromName(redashName)
  const nameLower = redashName.toLowerCase()
  let best: Match | null = null
  for (const alloc of countryAllocs) {
    const prod = products.find((p) => p.id === alloc.productId)
    if (!prod) continue
    const configured = (prod.redashName || '').trim()
    const usd = calcPriceUSD(prod)
    let score = 0
    let via: Match['via'] = 'auto'
    if (configured) {
      if (nameLower.includes(configured.toLowerCase())) { score = 5; via = 'exact' }
    } else {
      const hasBrand = nameLower.includes(prod.brand.toLowerCase())
      const hasPrice = redashPrice > 0 && usd > 0
      const close = hasPrice && Math.abs(redashPrice - usd) / Math.max(redashPrice, usd) < 0.02
      if (hasBrand && close) score = 4
      else if (hasBrand && !hasPrice) score = 3
      else if (hasBrand) score = 2
    }
    if (score > (best?.score ?? 0)) best = { alloc, score, via }
  }
  if (!best) return null
  if (best.score >= 3) return best
  if (best.score === 2) return { ...best, weak: true }
  return null
}

export interface CountrySummary { country: string; rows: AllocRow[]; activeCount: number; planned: number; real: number }

export function summarizeCountry(country: string, allocs: Allocs, products: Product[]): CountrySummary {
  const rows = allocs[country] || []
  let planned = 0
  let real = 0
  for (const r of rows) {
    const p = products.find((x) => x.id === r.productId)
    if (!p) continue
    planned += calcDailyBudget(p, r)
    real += calcRealDaily(p, r)
  }
  return { country, rows, activeCount: rows.filter(isAllocActive).length, planned, real }
}

export interface VendorBudget { vendor: string; monthly: number; byPurpose: Record<string, number> }

/** Monthly budget per vendor: products (real, all countries incl. GLOBAL) + raffles + fixed items. Same as v1 Budget Overview. */
export function vendorBudgets(allocs: Allocs, products: Product[], raffles: Raffle[], extras: BudgetExtra[]): VendorBudget[] {
  const map = new Map<string, VendorBudget>()
  const add = (vendor: string, purpose: string, v: number) => {
    const e = map.get(vendor) || { vendor, monthly: 0, byPurpose: {} }
    e.monthly += v
    e.byPurpose[purpose] = (e.byPurpose[purpose] || 0) + v
    map.set(vendor, e)
  }
  for (const rows of Object.values(allocs)) {
    for (const r of rows || []) {
      const p = products.find((x) => x.id === r.productId)
      if (!p) continue
      add(vendorOf(p), String(p.purpose || 'MP'), calcRealDaily(p, r) * DAYS_PER_MONTH)
    }
  }
  for (const r of raffles) add(r.vendor, 'Raffles', (r.marketPrice || 0) * (r.timesPerMonth || 0))
  for (const e of extras) add(e.vendor, e.purpose || 'MP', e.monthly || 0)
  return [...map.values()].sort((a, b) => b.monthly - a.monthly)
}
