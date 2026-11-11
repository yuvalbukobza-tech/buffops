import { describe, expect, it } from 'vitest'
import type { AllocRow, BudgetPeriod, MpDailyRow, MpStockRow, Product } from './types'
import {
  FLAT_UNPRICED_USD, budgetInfo, budgetOf, buckets, dailyBudget, dayList, faceValueUSD, kindOf, kindTotals, makePricer, monthlyFor,
  periodLabel, periodOf, periodRange, prizeLines, productLines, shiftPeriod, spendByDay, spendBySource, summarizePeriod, upsertBudget,
} from './utilization'

const prod = (over: Partial<Product>): Product => ({
  id: 1, brand: 'Riot', category: 'Gaming', priceToBuffLocal: 5, currency: 'USD', vendor: 'Riot Internal', type: 'Regular',
  bpRegular: null, bpPremium: null, discountPct: 0, demandLevel: 'High', purpose: 'MP', ...over,
})
const row = (day: string, name: string, n: number, tier = 'REGULAR'): MpDailyRow => ({ day, product_name: name, tier, purchases: n })

describe('periods', () => {
  it('halves of the month', () => {
    expect(periodOf('2026-11-01')).toBe('2026-11-A')
    expect(periodOf('2026-11-15')).toBe('2026-11-A')
    expect(periodOf('2026-11-16')).toBe('2026-11-B')
    expect(periodRange('2026-11-A')).toEqual({ start: '2026-11-01', end: '2026-11-15', days: 15 })
    expect(periodRange('2026-11-B')).toEqual({ start: '2026-11-16', end: '2026-11-30', days: 15 })
    expect(periodRange('2026-12-B')).toEqual({ start: '2026-12-16', end: '2026-12-31', days: 16 })
    expect(periodRange('2028-02-B')).toEqual({ start: '2028-02-16', end: '2028-02-29', days: 14 }) // leap year
    expect(periodRange('2026-02-B').days).toBe(13)
  })
  it('steps across months and years', () => {
    expect(shiftPeriod('2026-11-A', 1)).toBe('2026-11-B')
    expect(shiftPeriod('2026-11-B', 1)).toBe('2026-12-A')
    expect(shiftPeriod('2026-12-B', 1)).toBe('2027-01-A')
    expect(shiftPeriod('2027-01-A', -1)).toBe('2026-12-B')
    expect(shiftPeriod('2026-11-A', -4)).toBe('2026-09-A')
  })
  it('labels', () => {
    expect(periodLabel('2026-11-A')).toBe('Nov 1–15, 2026')
    expect(periodLabel('2026-11-B')).toBe('Nov 16–30, 2026')
  })
})

describe('budgets', () => {
  it('upsert, replace, remove with 0, sorted', () => {
    let p: BudgetPeriod[] = []
    p = upsertBudget(p, '2026-11-B', 9000, 'yuval', 'T1')
    p = upsertBudget(p, '2026-11-A', 12000.555, 'yuval', 'T2')
    expect(p.map((x) => x.id)).toEqual(['2026-11-A', '2026-11-B'])
    expect(p[0].amountUSD).toBe(12000.56)
    p = upsertBudget(p, '2026-11-A', 15000, 'dana', 'T3')
    expect(p.find((x) => x.id === '2026-11-A')).toMatchObject({ amountUSD: 15000, updatedBy: 'dana', updatedAt: 'T3' })
    p = upsertBudget(p, '2026-11-B', 0)
    expect(p.map((x) => x.id)).toEqual(['2026-11-A'])
  })
  it('spreads a period budget over its days', () => {
    const p = [{ id: '2026-11-A', amountUSD: 1500 }]
    expect(dailyBudget('2026-11-03', p)).toBe(100)
    expect(dailyBudget('2026-11-20', p)).toBeNull()
  })
})

describe('pricing', () => {
  it('face value with currencies', () => {
    expect(faceValueUSD('$5 Riot Access Code US')).toBe(5)
    expect(faceValueUSD('£10 Roblox Gift Card')).toBeCloseTo(13.4)
    expect(faceValueUSD('€5 Amazon Gift Card')).toBeCloseTo(5.85)
    expect(faceValueUSD('CA$20 Steam')).toBeCloseTo(14.6)
    expect(faceValueUSD('1lb Ocean Cleanup!')).toBe(0)
  })
  it('plan price first, then face value, then flat', () => {
    const products = [prod({ id: 1, brand: 'Riot', priceToBuffLocal: 4.5, redashName: '$5 Riot Access Code US' })]
    const allocs = { US: [{ productId: 1, pulsesPerDay: 3, qtyPerPulse: 2 }] }
    const price = makePricer(allocs, products)
    expect(price('$5 Riot Access Code US')).toMatchObject({ usd: 4.5, source: 'plan', productId: 1 })
    expect(price('$10 Roblox Gift Card')).toMatchObject({ usd: 10, source: 'face' })
    expect(price('Protect Marine Area!')).toMatchObject({ usd: FLAT_UNPRICED_USD, source: 'flat' })
  })
})

describe('standing monthly budget', () => {
  const periods: BudgetPeriod[] = [{ id: 'M:2026-11', amountUSD: 30000 }, { id: 'M:2027-02', amountUSD: 28000 }]
  it('splits a month by days and keeps going until the next monthly entry', () => {
    expect(budgetInfo(periods, '2026-11-A')).toMatchObject({ amount: 15000, from: 'monthly' })
    expect(budgetOf(periods, '2026-12-B')).toBeCloseTo((30000 * 16) / 31, 2)
    expect(budgetOf(periods, '2027-01-A')).toBeCloseTo((30000 * 15) / 31, 2)
    expect(budgetOf(periods, '2027-02-B')).toBe(13000) // Feb 2027: days 16–28 = 13 of 28 days of 28000
    expect(budgetOf(periods, '2026-10-B')).toBeNull() // before the first monthly entry
    expect(dailyBudget('2026-12-03', periods)).toBeCloseTo(30000 / 31, 2) // same every day of the month
    expect(dailyBudget('2026-12-20', periods)).toBeCloseTo(30000 / 31, 2)
  })
  it('a half-month entry overrides the monthly one', () => {
    const p = [...periods, { id: '2026-11-B', amountUSD: 20000 }]
    expect(budgetInfo(p, '2026-11-B')).toMatchObject({ amount: 20000, from: 'period' })
    expect(budgetInfo(p, '2026-11-A').from).toBe('monthly')
    expect(monthlyFor(p, '2026-12')?.amountUSD).toBe(30000)
  })
})

describe('reward kinds', () => {
  const products = [
    prod({ id: 7, brand: 'Steam', priceToBuffLocal: 48, purpose: 'Buff Pass', redashName: '$50 Steam - buffpass' }),
    prod({ id: 8, brand: 'JBL', priceToBuffLocal: 199, purpose: 'Raffles', redashName: 'JBL Quantum 950X' }),
  ]
  const price = makePricer({}, products) // not in any allocation: matched by exact Redash name
  const internal = (day: string, name: string, n: number): MpDailyRow => ({ day, product_name: name, tier: 'REGULAR', source: 'INTERNAL_STORAGE', purchases: n })
  const rows = [
    row('2026-11-02', '$10 Steam', 3),
    internal('2026-11-02', '$50 Steam - buffpass', 2),
    internal('2026-11-02', 'JBL Quantum 950X', 1),
    internal('2026-11-03', '$10 Riot - Raffle Halloween', 1),
    internal('2026-11-03', '€25 Game Boost Gift Card', 1),
    internal('2026-11-03', 'Mystery headset', 1),
  ]
  it('classifies by product purpose, then by name; marketplace when the source is missing (backend v8)', () => {
    expect(kindOf({ source: undefined, product_name: '$50 Steam - buffpass' })).toBe('mp')
    expect(kindOf({ source: 'INTERNAL_STORAGE', product_name: 'JBL Quantum 950X' }, 'Raffles')).toBe('raffle')
    expect(kindOf({ source: 'INTERNAL_STORAGE', product_name: '$10 Riot - Raffle Halloween' })).toBe('raffle')
    expect(kindOf({ source: 'INTERNAL_STORAGE', product_name: '$50 Amazon Gift Card - BuffPass' })).toBe('buffpass')
    expect(kindOf({ source: 'INTERNAL_STORAGE', product_name: '€25 Game Boost Gift Card' })).toBe('other')
  })
  it('prices prizes from the product, else the name; unknown prizes are $0, not the flat rate', () => {
    expect(price('JBL Quantum 950X', true)).toMatchObject({ usd: 199, source: 'plan', purpose: 'Raffles' })
    expect(price('Mystery headset', true)).toMatchObject({ usd: 0, source: 'none' })
    expect(price('Mystery headset')).toMatchObject({ usd: FLAT_UNPRICED_USD, source: 'flat' })
  })
  it('spend counts every kind; the product table counts the marketplace only', () => {
    const byDay = spendByDay(rows, price)
    expect(byDay.get('2026-11-02')).toMatchObject({ usd: 30 + 96 + 199, units: 6 })
    const k = kindTotals(byDay, '2026-11-01', '2026-11-15')
    expect(k.mp).toBe(30)
    expect(k.buffpass).toBe(96)
    expect(k.raffle).toBe(199 + 10)
    expect(k.other).toBeCloseTo(25 * 1.17)
    expect(productLines(rows, '2026-11-01', '2026-11-15', 15, { allocs: {}, products }, price, null).map((l) => l.name)).toEqual(['$10 Steam'])
    const prizes = prizeLines(rows, '2026-11-01', '2026-11-15', price)
    expect(prizes.map((p) => [p.kind, p.name])).toEqual([
      ['buffpass', '$50 Steam - buffpass'], ['raffle', 'JBL Quantum 950X'], ['raffle', '$10 Riot - Raffle Halloween'],
      ['other', '€25 Game Boost Gift Card'], ['other', 'Mystery headset'],
    ])
    expect(prizes.at(-1)).toMatchObject({ source: 'none', spent: 0 })
  })
})

describe('one period', () => {
  const periods = [{ id: '2026-11-A', amountUSD: 1500 }] // $100/day
  const flat = () => ({ usd: 1, source: 'face' as const })
  it('mid-period: pace over complete days, run rate of the last 7, forecast', () => {
    // Nov 1–10 complete at $80/day, today (11th) $30 so far.
    const rows = [...dayList('2026-11-01', '2026-11-10').map((d) => row(d, 'x', 80)), row('2026-11-11', 'x', 30)]
    const s = summarizePeriod('2026-11-A', spendByDay(rows, flat), periods, '2026-11-11')
    expect(s.current).toBe(true)
    expect(s.completeDays).toBe(10)
    expect(s.spentComplete).toBe(800)
    expect(s.today).toBe(30)
    expect(s.spent).toBe(830)
    expect(s.expectedByNow).toBe(1000)
    expect(s.pace).toBeCloseTo(0.8)
    expect(s.runRate).toBe(80)
    expect(s.forecast).toBe(800 + 80 * 5)
    expect(s.projectedUnused).toBe(300)
    expect(s.utilization).toBeCloseTo(830 / 1500)
  })
  it('run rate uses only the last 7 complete days', () => {
    const rows = [...dayList('2026-11-01', '2026-11-03').map((d) => row(d, 'x', 1000)), ...dayList('2026-11-04', '2026-11-10').map((d) => row(d, 'x', 10))]
    const s = summarizePeriod('2026-11-A', spendByDay(rows, flat), periods, '2026-11-11')
    expect(s.runRate).toBe(10)
  })
  it('a finished period forecasts what was spent; a future one has nothing', () => {
    const rows = dayList('2026-11-01', '2026-11-15').map((d) => row(d, 'x', 110))
    const past = summarizePeriod('2026-11-A', spendByDay(rows, flat), periods, '2026-11-20')
    expect(past.current).toBe(false)
    expect(past.completeDays).toBe(15)
    expect(past.forecast).toBe(1650)
    expect(past.projectedUnused).toBe(-150)
    const fut = summarizePeriod('2026-12-A', new Map(), periods, '2026-11-20')
    expect(fut.future).toBe(true)
    expect(fut.forecast).toBeNull()
    expect(fut.budget).toBeNull()
  })
  it('first day of a period: no complete days yet', () => {
    const s = summarizePeriod('2026-11-B', spendByDay([row('2026-11-16', 'x', 5)], flat), periods, '2026-11-16')
    expect(s.completeDays).toBe(0)
    expect(s.runRate).toBeNull()
    expect(s.forecast).toBeNull()
    expect(s.spent).toBe(5)
  })
})

describe('buckets', () => {
  const flat = () => ({ usd: 2, source: 'face' as const })
  const periods = [{ id: '2026-11-A', amountUSD: 1500 }, { id: '2026-11-B', amountUSD: 3000 }, { id: '2026-10-B', amountUSD: 1600 }]
  it('weeks start on Monday and stop at today', () => {
    const rows = dayList('2026-11-01', '2026-11-11').map((d) => row(d, 'x', 1))
    const w = buckets('week', '2026-11-01', '2026-11-15', '2026-11-11', spendByDay(rows, flat), periods)
    expect(w.map((b) => b.start)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09'])
    expect(w[1]).toMatchObject({ days: 7, spent: 14, units: 7, budget: 700, partial: false })
    expect(w[2]).toMatchObject({ days: 3, partial: true })
    expect(w[0]).toMatchObject({ days: 1, partial: true, cutStart: true }) // window starts on Sunday
    expect(w[1].kinds).toEqual({ mp: 14, buffpass: 0, raffle: 0, other: 0 })
  })
  it('splits each bucket by reward kind', () => {
    const rows = [row('2026-11-02', 'x', 3), { ...row('2026-11-02', '$50 Steam - buffpass', 1), source: 'INTERNAL_STORAGE' }, { ...row('2026-11-03', '$10 Riot - Raffle', 2), source: 'INTERNAL_STORAGE' }]
    const [m] = buckets('month', '2026-11-01', '2026-11-30', '2026-11-11', spendByDay(rows, flat), periods)
    expect(m.kinds).toEqual({ mp: 6, buffpass: 2, raffle: 4, other: 0 })
    expect(m.spent).toBe(12)
    expect(m.cutStart).toBe(false)
  })
  it('budget is unknown when any counted day has none', () => {
    const w = buckets('week', '2026-10-12', '2026-10-25', '2026-11-11', new Map(), periods)
    // Week of Oct 12–18 is all in 2026-10-A (no budget) → null; Oct 19–25 is in 2026-10-B → known.
    expect(w[0].budget).toBeNull()
    expect(w[1].budget).toBeCloseTo(700)
  })
  it('months add both halves and end on the right day', () => {
    const m = buckets('month', '2026-11-01', '2026-11-30', '2026-12-05', new Map(), periods)
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ key: '2026-11', end: '2026-11-30', days: 30, budget: 4500, partial: false })
    const feb = buckets('month', '2028-02-01', '2028-02-29', '2028-03-01', new Map(), [])
    expect(feb[0].end).toBe('2028-02-29')
  })
  it('days carry the daily budget', () => {
    const d = buckets('day', '2026-11-01', '2026-11-02', '2026-11-11', spendByDay([row('2026-11-02', 'x', 50)], flat), periods)
    expect(d.map((b) => [b.key, b.spent, b.budget, b.utilization])).toEqual([['2026-11-01', 0, 100, 0], ['2026-11-02', 100, 100, 1]])
    const t = buckets('day', '2026-11-10', '2026-11-11', '2026-11-11', new Map(), periods)
    expect(t.map((b) => b.partial)).toEqual([false, true]) // today is not over yet
  })
})

describe('products', () => {
  const products = [
    prod({ id: 1, brand: 'Riot', priceToBuffLocal: 5, redashName: '$5 Riot Access Code US' }),
    prod({ id: 2, brand: 'Steam', priceToBuffLocal: 5, redashName: '$5 Steam Wallet Code' }),
    prod({ id: 3, brand: 'Roblox', priceToBuffLocal: 10, redashName: '$10 Roblox Gift Card' }),
    prod({ id: 4, brand: 'Xbox', priceToBuffLocal: 15, redashName: '$15 Xbox Gift Card' }),
    prod({ id: 5, brand: 'Raffle', priceToBuffLocal: 50, purpose: 'Raffles', redashName: 'Big raffle' }),
  ]
  const a = (productId: number, pulsesPerDay: number, qtyPerPulse: number, active = true): AllocRow => ({ productId, pulsesPerDay, qtyPerPulse, active })
  const allocs = { US: [a(1, 2, 5), a(2, 2, 5), a(4, 1, 2), a(5, 1, 1)], GB: [a(1, 1, 5)], CA: [a(3, 1, 4, false)] }
  const data = { allocs, products }
  const price = makePricer(allocs, products)
  // 10 days: Riot 150/day planned 15 → capped; Steam 2/day of 10 → slow; Roblox (alloc inactive) → unplanned; Xbox nothing → unbought
  const rows = [
    ...dayList('2026-11-01', '2026-11-10').flatMap((d) => [row(d, '$5 Riot Access Code US', 15), row(d, '$5 Steam Wallet Code', 2), row(d, '$10 Roblox Gift Card', 3)]),
    row('2026-10-31', '$5 Riot Access Code US', 999), // outside the window
  ]
  const lines = productLines(rows, '2026-11-01', '2026-11-10', 10, data, price, null)
  const by = (n: string) => lines.find((l) => l.name === n)!
  it('sell-through against units opened per day (every country, active, marketplace only)', () => {
    expect(by('$5 Riot Access Code US')).toMatchObject({ units: 150, plannedPerDay: 15, perDay: 15, sellThrough: 1, flag: 'capped', spent: 750 })
    expect(by('$5 Steam Wallet Code')).toMatchObject({ plannedPerDay: 10, sellThrough: 0.2, flag: 'slow' })
    expect(by('$10 Roblox Gift Card')).toMatchObject({ plannedPerDay: 0, sellThrough: null, flag: 'unplanned' })
  })
  it('buying well above the plan is its own flag (plan out of sync with the live marketplace)', () => {
    const r = [...dayList('2026-11-01', '2026-11-10').map((d) => row(d, '$5 Riot Access Code US', 25))]
    expect(productLines(r, '2026-11-01', '2026-11-10', 10, data, price, null)[0]).toMatchObject({ sellThrough: 25 / 15, flag: 'over' })
  })
  it('lists opened-but-never-bought products and ignores raffles', () => {
    const x = lines.find((l) => l.name === '$15 Xbox Gift Card')!
    expect(x).toMatchObject({ units: 0, plannedPerDay: 2, flag: 'unbought', spent: 0 })
    expect(lines.find((l) => l.name === 'Big raffle')).toBeUndefined()
  })
  it('shares add up and biggest spend comes first', () => {
    expect(lines[0].name).toBe('$5 Riot Access Code US')
    expect(lines.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1)
    const src = spendBySource(lines)
    expect(src.plan).toBe(750 + 100 + 300)
  })
  it('live stock: sold out wins; regular + premium of one name are merged', () => {
    const stock: MpStockRow[] = [
      { product_name: '$10 Roblox Gift Card', tier: 'REGULAR', daily_restocks: 2, purchased_today: 5, out_of_stock: false, p14: 100, p30: 200, last_purchase: null },
      { product_name: ' $10 Roblox Gift Card', tier: 'PREMIUM', daily_restocks: 1, purchased_today: 1, out_of_stock: true, p14: 10, p30: 20, last_purchase: null },
    ]
    const l = productLines(rows, '2026-11-01', '2026-11-10', 10, data, price, stock).find((x) => x.name === '$10 Roblox Gift Card')!
    expect(l.live).toEqual({ outOfStock: true, restocksPerDay: 3, p30: 220 })
    expect(l.flag).toBe('soldout')
  })
})
