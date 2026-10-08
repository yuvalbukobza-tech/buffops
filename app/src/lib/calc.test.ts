import { describe, expect, it } from 'vitest'
import { calcDailyBudget, calcRealDaily, calcUtilization, matchProduct, priceFromName, pulseFactor, summarizeCountry, vendorBudgets } from './calc'
import type { Product } from './types'

const prod = (over: Partial<Product>): Product => ({
  id: 1, brand: 'Riot', category: 'Gaming', priceToBuffLocal: 5, currency: 'USD', vendor: 'Loot Keys', type: 'Regular',
  bpRegular: 1200, bpPremium: 950, discountPct: 0, demandLevel: 'Very High', ...over,
})

describe('utilization (same table as v1)', () => {
  it('pulse factor steps', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(pulseFactor)).toEqual([1, 0.88, 0.8, 0.72, 0.64, 0.64, 0.56, 0.56, 0.5])
  })
  it('demand × pulses', () => {
    expect(calcUtilization('High', 2)).toBeCloseTo(0.7216)
    expect(calcUtilization('unknown', 1)).toBeCloseTo(0.65)
  })
})

describe('budget math matches the live US numbers', () => {
  it('Riot $5, 4 pulses × 12 → $240 planned, $164.16 real per day', () => {
    const p = prod({})
    const r = { productId: 1, pulsesPerDay: 4, qtyPerPulse: 12 }
    expect(calcDailyBudget(p, r)).toBe(240)
    expect(calcRealDaily(p, r)).toBeCloseTo(164.16, 2)
  })
  it('inactive rows count as zero', () => {
    expect(calcRealDaily(prod({}), { productId: 1, pulsesPerDay: 4, qtyPerPulse: 12, active: false })).toBe(0)
  })
  it('GBP price converts with FX 1.34', () => {
    expect(calcDailyBudget(prod({ priceToBuffLocal: 10, currency: 'GBP' }), { productId: 1, pulsesPerDay: 1, qtyPerPulse: 1 })).toBeCloseTo(13.4)
  })
  it('country summary skips orphan rows', () => {
    const s = summarizeCountry('US', { US: [{ productId: 1, pulsesPerDay: 4, qtyPerPulse: 12 }, { productId: 999, pulsesPerDay: 1, qtyPerPulse: 1 }] }, [prod({})])
    expect(s.planned).toBe(240)
    expect(s.rows.length).toBe(2)
  })
})

describe('vendor budgets', () => {
  it('adds products, raffles and fixed items per vendor', () => {
    const v = vendorBudgets({ US: [{ productId: 1, pulsesPerDay: 1, qtyPerPulse: 1 }] }, [prod({ priceToBuffLocal: 10, demandLevel: 'Low' })],
      [{ id: 1, name: 'r', vendor: 'GCOW', marketPrice: 10, timesPerMonth: 5 }], [{ id: 1, name: 'e', vendor: 'GCOW', purpose: 'Buff Pass', monthly: 625 }])
    expect(v.find((x) => x.vendor === 'Loot Keys')!.monthly).toBeCloseTo(10 * 0.4 * 30.5)
    expect(v.find((x) => x.vendor === 'GCOW')!.monthly).toBe(675)
  })
})

describe('Redash matching (v1 scoring)', () => {
  const allocs = [{ productId: 1, pulsesPerDay: 1, qtyPerPulse: 1 }, { productId: 2, pulsesPerDay: 1, qtyPerPulse: 1 }]
  const products = [prod({ id: 1, priceToBuffLocal: 5 }), prod({ id: 2, priceToBuffLocal: 10 })]
  it('picks the right denomination', () => {
    expect(matchProduct('$10 Riot Access Code US', allocs, products)?.alloc.productId).toBe(2)
    expect(matchProduct('$5 Riot Access Code US', allocs, products)?.score).toBe(4)
  })
  it('flags a price mismatch as weak', () => {
    expect(matchProduct('$25 Riot Access Code', allocs, products)?.weak).toBe(true)
  })
  it('configured Redash name wins', () => {
    const p = [prod({ id: 1, redashName: 'Special Riot Bundle' })]
    expect(matchProduct('Special Riot Bundle $5', [allocs[0]], p)?.via).toBe('exact')
  })
  it('reads price from name', () => {
    expect(priceFromName('$15 Twitch Gift Card')).toBe(15)
    expect(priceFromName('1lb Ocean Cleanup!')).toBe(0)
  })
})
