import { describe, expect, it } from 'vitest'
import { makeRequest, monthlyTotals, newRequestEmail, splitText, statusEmail } from './finance'
import type { Transaction } from './types'

const tx = (id: number, date: string, over: Partial<Transaction> = {}): Transaction => ({ id, vendor: 'GCOW', totalAmount: 1000, dateRequested: date, status: 'delivered', productDesktop: 1000, ...over })

describe('finance records (v1 shape)', () => {
  it('split text matches v1', () => {
    expect(splitText({ productDesktop: 6800, productMobile: 700, dataProject: 500 })).toBe('Product Desktop: $6,800.00 / Product Mobile: $700.00 / Data project: $500.00')
  })
  it('new request gets the next id, pending status and every department field', () => {
    const t = makeRequest([tx(51, '2026-10-07'), tx(52, '2026-10-07')], { vendor: 'GCOW', amounts: { productDesktop: 6000 }, note: 'n', enteredBy: 'Yuval', date: '2026-10-15' })
    expect(t.id).toBe(53)
    expect(t.status).toBe('pending')
    expect(t.totalAmount).toBe(6000)
    expect(t.productMobile).toBe(0)
    expect(t.dataProject).toBe(0)
    expect(t.departmentsSplit).toBe('Product Desktop: $6,000.00')
  })
  it('emails use the v1 wording', () => {
    const t = makeRequest([], { vendor: 'Loot Keys', amounts: { productDesktop: 8400 }, note: '', enteredBy: 'Yuval', date: '2026-10-07' })
    const e = newRequestEmail(t, 'Yuval')
    expect(e.subject).toBe('Finance Request #1 - Loot Keys - $8,400.00')
    expect(e.body.split('\n')[0]).toBe('A new transaction has been created.')
    expect(e.body).toContain('  Data project: $0.00')
    expect(statusEmail(t, 'delivered', 'Yuval', 'y@buff.game', '2026-10-08').subject).toBe('Status Update: Finance Request #1 - Loot Keys - Delivered')
  })
})

describe('monthly totals', () => {
  it('fills empty months and sums departments', () => {
    const m = monthlyTotals([tx(1, '2026-07-01'), tx(2, '2026-09-05', { productDesktop: 500, productMobile: 200, totalAmount: 700 })], '2026-10')
    expect(m.map((x) => x.key)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(m[1].total).toBe(0)
    expect(m[2].total).toBe(700)
    expect(m[2].split.productMobile).toBe(200)
  })
})
