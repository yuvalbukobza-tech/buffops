import { describe, expect, it } from 'vitest'
import { RAFFLE_SHARE, planLeftover, rafflePrizeNames, raffleStats, raffleValue } from './recommend'
import type { RaffleRow } from './types'
import { kindOf, type ProductLine } from './utilization'

const raffle = (title: string, start: string, end: string, entries: number, prizes = '1x Raffle prize', countries = '{US}', status = 'FINISHED'): RaffleRow =>
  ({ id: title + start, title, platforms: '{DESKTOP}', countries, start_day: start, end_day: end, entries, status, prizes })
const line = (name: string, flag: ProductLine['flag'], perDay: number, unitUSD: number, sellThrough: number | null, source: ProductLine['source'] = 'plan'): ProductLine =>
  ({ name, units: Math.round(perDay * 10), spent: perDay * 10 * unitUSD, share: 0, unitUSD, source, perDay, plannedPerDay: sellThrough ? perDay / sellThrough : 0, sellThrough, flag })

describe('raffle value', () => {
  it('reads the title, then the prize names; Buffs are not money', () => {
    expect(raffleValue({ title: '$100 Steam Gift Card', prizes: '1x $100 Steam - raffles' }).usd).toBe(100)
    expect(raffleValue({ title: '$10 Riot Access Code', prizes: '3x Raffle prize' }).usd).toBe(30)
    expect(raffleValue({ title: 'GameBoost', prizes: '1x €25 Game Boost Gift Card Part 2' }).usd).toBeCloseTo(29.25)
    expect(raffleValue({ title: 'GameBoost', prizes: '1x Raffle prize' }).usd).toBeNull()
    expect(raffleValue({ title: '1250 Buffs', prizes: '1250x Raffle prize' })).toEqual({ usd: 1250 / 220, buffs: true })
  })
})

describe('raffle prize names', () => {
  it('collects real prize names, case/space-insensitive, and tags those gift cards as raffle spend', () => {
    const set = rafflePrizeNames([
      raffle('$100 Roblox Gift Card', '2026-10-28', '2026-11-04', 16545, '1x $100 Roblox Gift Card'),
      raffle('GameBoost', '2026-10-26', '2026-10-27', 904, '1x €25 Game Boost Gift Card Part 2 + 2x Raffle prize'),
    ])
    expect([...set].sort()).toEqual(['$100 roblox gift card', '€25 game boost gift card part 2'])
    expect(kindOf({ source: 'INTERNAL_STORAGE', product_name: '€25 Game Boost  Gift Card Part 2' }, undefined, set)).toBe('raffle')
    expect(kindOf({ source: 'INTERNAL_STORAGE', product_name: '$10 Riot Access Code' }, undefined, set)).toBe('other')
    expect(kindOf({ source: 'EXTERNAL_MARKETPLACE', product_name: '$100 Roblox Gift Card' }, undefined, set)).toBe('mp')
  })
})

describe('raffle stats', () => {
  const rows = [
    raffle('$10 Riot Access Code', '2026-10-29', '2026-10-30', 1148),
    raffle('$10 Riot Access Code', '2026-10-30', '2026-10-31', 978),
    raffle('$100 Steam Gift Card', '2026-10-15', '2026-10-29', 19382, '1x $100 Steam - raffles', '{US,GB}'),
    raffle('$100 Steam Gift Card', '2026-10-28', '2026-11-11', 24055, '1x $100 Steam - raffles', '{US,GB}', 'LIVE'),
    raffle('GameBoost', '2026-10-26', '2026-10-27', 904, '1x €25 Game Boost Gift Card Part 2', '{GLOBAL}'),
    raffle('GameBoost', '2026-10-30', '2026-10-31', 1397, '1x Raffle prize', '{GLOBAL}'),
    raffle('1250 Buffs', '2026-10-27', '2026-10-28', 1490, '1250x Raffle prize', '{GLOBAL}'),
    raffle('$10 Riot Access Code', '2026-07-01', '2026-07-02', 50000), // outside the 60-day look-back
  ]
  const s = raffleStats(rows, '2026-11-11')
  const by = (t: string) => s.find((x) => x.title === t)!
  it('entries per day and per prize dollar, from finished runs in the look-back', () => {
    expect(by('$10 Riot Access Code')).toMatchObject({ runs: 2, entriesPerDay: (1148 + 978) / 2, valueUSD: 10, liveNow: false, countries: 'US' })
    expect(by('$100 Steam Gift Card')).toMatchObject({ runs: 1, avgDays: 14, valueUSD: 100, liveNow: true })
    expect(by('GameBoost').valueUSD).toBeCloseTo(29.25) // value known from one run applies to the title
    expect(by('1250 Buffs').buffs).toBe(true)
  })
  it('best value per dollar first', () => {
    expect(s[0].title).toBe('1250 Buffs')
    expect(s[1].title).toBe('$10 Riot Access Code')
  })

  it('plan: repeat the best code raffle, open more of what sold out, nothing over the leftover', () => {
    const lines = [
      line('$10 Riot Access Code US', 'over', 25, 10, 2.1),
      line('$10 Roblox Gift Card', 'soldout', 12, 10, 6),
      line('$5 Steam Wallet Code', 'capped', 27, 5, 1),
      line('$5 Riot Access Code US', 'slow', 22, 5, 0.37), // not in demand → not opened more
      line('1lb Ocean Cleanup!', 'over', 10, 0.66, 2, 'flat'), // flat-priced → skipped
    ]
    const p = planLeftover(1000, 3, lines, s)
    // Buffs raffle is skipped (not paid from the budget); Steam is live already; Riot $10 fits.
    expect(p.raffles.map((r) => r.stat.title)).toEqual(['$10 Riot Access Code', 'GameBoost'])
    expect(p.raffles.reduce((a, r) => a + r.cost, 0)).toBeLessThanOrEqual(1000 * RAFFLE_SHARE)
    expect(p.raffles[0].days).toBe(1)
    const names = p.products.map((x) => x.line.name)
    expect(names).toContain('$10 Riot Access Code US')
    expect(names).not.toContain('$5 Riot Access Code US')
    expect(names).not.toContain('1lb Ocean Cleanup!')
    const total = p.raffles.reduce((a, r) => a + r.cost, 0) + p.products.reduce((a, x) => a + x.cost, 0)
    expect(total + p.unallocated).toBeCloseTo(1000, 2)
    expect(total).toBeLessThanOrEqual(1000)
    for (const x of p.products) expect(x.units).toBeLessThanOrEqual(Math.ceil(x.line.perDay * 3)) // users can absorb it
  })
  it('caps hit → the rest is left unallocated (and may get one more raffle)', () => {
    const p = planLeftover(5000, 1, [line('$10 Riot Access Code US', 'over', 25, 10, 2.1)], [])
    expect(p.products[0].units).toBe(25)
    expect(p.unallocated).toBe(4750)
  })
  it('nothing to do without leftover', () => {
    expect(planLeftover(-200, 3, [line('x', 'over', 5, 5, 2)], s)).toMatchObject({ raffles: [], products: [], unallocated: 0 })
  })
})
