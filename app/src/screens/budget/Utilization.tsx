// Rewards budget utilization: the budget (standing monthly, or per half-month) against every reward given —
// marketplace purchases plus Buff Pass / raffle prizes from internal stock.
// Data comes from the Inventory DB through the backend (?action=mpq); the math lives in lib/utilization.ts.
import { useMemo, useState } from 'react'
import { calcDailyQty, calcPriceUSD, calcRealDaily } from '../../lib/calc'
import { MP_CANCELLED, MP_OUTDATED, useBackendVersion, useMpDaily, useMpStock, useRaffles } from '../../lib/mpdata'
import { iso } from '../../lib/redash'
import { useSession } from '../../lib/session'
import { useData, useStore } from '../../lib/store'
import type { BudgetPeriod } from '../../lib/types'
import {
  KINDS, KIND_LABEL, addDays, budgetInfo, buckets, dayLabel, dayList, dailyBudget, kindTotals, makePricer, monthLabel, monthlyFor, monthlyId, periodLabel, periodOf,
  periodRange, prizeLines, productLines, shiftPeriod, spendByDay, spendBySource, summarizePeriod, upsertBudget,
  type Bucket, type BudgetInfo, type Flag, type Grain, type Kind, type PrizeLine,
} from '../../lib/utilization'
import { rafflePrizeNames, raffleStats } from '../../lib/recommend'
import { C, Card, Icon, Kpi, Seg, Toast, UtilBar, money } from '../../ui/kit'
import Leftover from './Leftover'
import SpendLines, { KIND_COLOR } from './SpendLines'

const NEED_VERSION = 8
/** v9 adds Buff Pass / raffle prizes (internal stock) to the daily query. */
const PRIZES_VERSION = 9
/** First day of the month `n` months before `day`'s month. */
const monthsBack = (day: string, n: number) => {
  let y = +day.slice(0, 4), m = +day.slice(5, 7) - n
  while (m < 1) { m += 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}-01`
}
const firstOfPrevMonth = (day: string) => monthsBack(day, 1)

/** History window: the last N months (this one included) or from a chosen day. */
type Span = '3' | '6' | '12' | 'custom'
const SPANS: { value: Span; label: string }[] = [{ value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '12', label: '12 months' }, { value: 'custom', label: 'From…' }]
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const remember = (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } }
const recall = (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }

const FLAG: Record<Flag, { label: string; color: string; tip: string }> = {
  soldout: { label: 'Sold out', color: C.orange, tip: 'Out of stock right now — users want more than we open' },
  over: { label: 'Above plan', color: C.sky, tip: 'Bought more than 120% of what the BuffOps plan opens — the live marketplace setup differs from the plan' },
  capped: { label: 'Selling out', color: C.lime, tip: 'Users buy everything the plan opens (95–120%) — room to open more' },
  ok: { label: 'On plan', color: C.good, tip: 'Sells 50–95% of what we open' },
  slow: { label: 'Slow', color: C.warn, tip: 'Sells under half of what we open' },
  unbought: { label: 'Not bought', color: C.bad, tip: 'Opened in the plan, nobody bought it in this window' },
  unplanned: { label: 'Not in plan', color: C.violet, tip: 'Bought, but no active allocation opens it (old stock, other tier, or not matched)' },
}

export default function Utilization() {
  const data = useData()
  const store = useStore()
  const session = useSession()
  const version = useBackendVersion()
  const today = iso(new Date())
  const [pid, setPid] = useState(() => periodOf(today))
  const [grain, setGrain] = useState<Grain>(() => (recall('bo2_util_grain') as Grain) || 'week')
  const [span, setSpan] = useState<Span>(() => (recall('bo2_util_span') as Span) || '3')
  const [customFrom, setCustomFrom] = useState(() => recall('bo2_util_from') || monthsBack(today, 5))
  const [toast, setToast] = useState('')
  const pickGrain = (g: Grain) => { setGrain(g); remember('bo2_util_grain', g) }
  const pickSpan = (s: Span) => {
    setSpan(s); remember('bo2_util_span', s)
    if ((s === '6' || s === '12') && grain === 'day') pickGrain('week') // 180+ daily points are noise
  }
  const histFrom = span === 'custom' ? (ISO_DAY.test(customFrom) && customFrom <= today ? customFrom : monthsBack(today, 2)) : monthsBack(today, Number(span) - 1)

  const range = periodRange(pid)
  // One query covers last month → today (exclusive end = tomorrow); going further back widens it.
  const from = [firstOfPrevMonth(today), `${range.start.slice(0, 7)}-01`].sort()[0]
  const to = addDays(today, 1)
  const backendOk = version === null ? null : version >= NEED_VERSION
  const hasPrizes = (version || 0) >= PRIZES_VERSION
  const daily = useMpDaily(from, to, backendOk === true)
  // History has its own query (a longer range can take a minute); the previous chart stays up, dimmed, while it loads.
  const hist = useMpDaily(histFrom, to, backendOk === true, true)
  const stock = useMpStock(backendOk === true)
  const raffleQ = useRaffles(hasPrizes)
  const raffles = useMemo(() => (raffleQ.rows ? raffleStats(raffleQ.rows, today) : null), [raffleQ.rows, today])

  const price = useMemo(() => makePricer(data.allocs, data.products), [data.allocs, data.products])
  // Gift cards named like a raffle's prize count as raffle spend.
  const prizeSet = useMemo(() => rafflePrizeNames(raffleQ.rows || []), [raffleQ.rows])
  const byDay = useMemo(() => spendByDay(daily.rows || [], price, prizeSet), [daily.rows, price, prizeSet])
  const periods = data.budgetPeriods
  const info = budgetInfo(periods, pid)
  const sum = summarizePeriod(pid, byDay, periods, today)
  const shownTo = range.end < today ? range.end : today
  const totals = useMemo(() => kindTotals(byDay, range.start, shownTo), [byDay, range.start, shownTo])
  const prizes = useMemo(() => prizeLines(daily.rows || [], range.start, shownTo, price, prizeSet), [daily.rows, range.start, shownTo, price, prizeSet])

  // What the current allocations open per day, in money (before and after expected utilization).
  const plan = useMemo(() => {
    let opened = 0, expected = 0
    for (const rows of Object.values(data.allocs)) for (const r of rows || []) {
      const p = data.products.find((x) => x.id === r.productId)
      if (!p || (p.purpose && p.purpose !== 'MP')) continue
      opened += calcDailyQty(r) * calcPriceUSD(p)
      expected += calcDailyQty(r) ? calcRealDaily(p, r) : 0
    }
    return { opened, expected }
  }, [data.allocs, data.products])

  // Products: complete days of the period (a live day would make today's products look slow).
  const { current: isCurrent, future: isFuture } = sum
  const prodTo = isCurrent ? (sum.completeDays ? addDays(today, -1) : today) : range.end
  const prodDays = isCurrent ? Math.max(1, sum.completeDays) : range.days
  const lines = useMemo(
    () => (isFuture ? [] : productLines(daily.rows || [], range.start, prodTo, prodDays, data, price, isCurrent ? stock.rows : null)),
    [daily.rows, range.start, prodTo, prodDays, data, price, stock.rows, isCurrent, isFuture],
  )
  const src = spendBySource(lines)
  const srcTotal = src.plan + src.face + src.flat

  const histByDay = useMemo(() => spendByDay(hist.rows || [], price, prizeSet), [hist.rows, price, prizeSet])
  const series = useMemo(() => buckets(grain, histFrom, today, today, histByDay, periods), [grain, histFrom, today, histByDay, periods])
  const table = useMemo(() => [...series].reverse(), [series]) // newest first
  const histTotal = useMemo(() => {
    const t = { spent: 0, budget: 0, budgetDays: 0, days: 0, kinds: { mp: 0, buffpass: 0, raffle: 0, other: 0 } as Record<Kind, number> }
    for (const b of series) {
      t.spent += b.spent; t.days += b.days
      for (const k of KINDS) t.kinds[k] += b.kinds[k]
      if (b.budget !== null) { t.budget += b.budget; t.budgetDays += b.days }
    }
    return t
  }, [series])

  const canEdit = !store.viewOnly && backendOk === true
  const saveEntry = (id: string, amount: number, what: string) => {
    store.update((s) => ({ ...s, budgetPeriods: upsertBudget(s.budgetPeriods, id, amount, session.username) }))
    setToast(amount > 0 ? `${what} set to ${money(amount)}` : `${what} removed`)
  }
  const ym = pid.slice(0, 7)
  const saveMonthly = (n: number) => saveEntry(monthlyId(ym), n, `Monthly budget from ${monthLabel(ym)}`)
  const savePeriod = (n: number) => saveEntry(pid, n, `Budget for ${periodLabel(pid)}`)
  const saveMonth = (month: string, n: number) => saveEntry(monthlyId(month), n, `Monthly budget from ${monthLabel(month)}`)

  const loading = daily.loading || stock.loading
  const err = daily.error || stock.error
  const paceCol = (p: number | null) => (p === null ? C.text : Math.abs(1 - p) <= 0.1 ? C.good : Math.abs(1 - p) <= 0.25 ? C.warn : C.bad)

  return (
    <>
      <div className="between a-up" style={{ animationDelay: '80ms', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" aria-label="Previous period" onClick={() => setPid(shiftPeriod(pid, -1))}>‹</button>
          <div style={{ minWidth: 170, textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>{periodLabel(pid)}</div>
            <div className="caption">{sum.current ? `Day ${sum.completeDays + 1} of ${range.days}` : sum.future ? 'Upcoming' : 'Finished'}</div>
          </div>
          <button className="icon-btn" aria-label="Next period" disabled={pid >= shiftPeriod(periodOf(today), 2)} onClick={() => setPid(shiftPeriod(pid, 1))}>›</button>
          {pid !== periodOf(today) && <button className="btn small" onClick={() => setPid(periodOf(today))}>Today</button>}
        </div>
        <div className="row">
          {loading && <span className="caption row" style={{ gap: 8 }}><span style={{ width: 14, height: 14, border: `2px solid ${C.line2}`, borderTopColor: C.lime, borderRadius: '50%', animation: 'bo-spin .8s linear infinite' }} />{daily.progress || stock.progress || 'Fetching purchases…'}<button onClick={() => { daily.cancel(); stock.cancel() }} style={{ border: '1px solid #4A1D1D', background: 'transparent', color: C.bad, borderRadius: 8, height: 26, padding: '0 10px', fontSize: 12, cursor: 'pointer' }}>Cancel</button></span>}
          <button className="icon-btn" aria-label="Refresh purchases" disabled={!backendOk} onClick={() => { daily.refresh(); hist.refresh(); stock.refresh() }}>{Icon.refresh}</button>
        </div>
      </div>

      {backendOk === false || err === MP_OUTDATED ? (
        <div className="card a-up" style={{ padding: '12px 16px', borderColor: '#4A3A12', color: C.warn, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
          {Icon.warn}<span>The Google backend needs an update (latest: Code-v9-all-rewards.gs) before real purchases load and budgets can be saved.</span>
        </div>
      ) : err === MP_CANCELLED ? (
        <div className="card" style={{ padding: '12px 16px', color: C.muted, fontSize: 13 }}>Query cancelled — real spend is not shown. <button className="btn small" onClick={() => { daily.refresh(); stock.refresh() }}>Run again</button></div>
      ) : err ? <div className="card" style={{ padding: '12px 16px', borderColor: '#4A1D1D', color: C.bad, fontSize: 13 }}>Redash didn't answer: {err}</div> : null}

      <BudgetBox key={pid + (info.entry ? '+' : '')} pid={pid} info={info} canEdit={canEdit} onSaveMonthly={saveMonthly} onSavePeriod={savePeriod}
        planOpened={plan.opened * range.days} planExpected={plan.expected * range.days} />

      <div className="grid a-up" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', animationDelay: '140ms' }}>
        <Kpi label={hasPrizes ? 'Spent · all rewards' : 'Spent · marketplace'} value={daily.rows ? money(sum.spent) : '—'} sub={sum.future ? 'Not started' : !daily.rows ? 'Waiting for purchases' : sum.current ? `${money(sum.today)} today so far` : `${range.days} days`} accent delay={140} />
        <Kpi label="Utilization" value={sum.utilization !== null && daily.rows ? `${Math.round(sum.utilization * 100)}%` : '—'} sub={sum.budget ? `of ${money(sum.budget)}` : 'Set a budget to see this'} color={sum.utilization !== null && sum.utilization > 1 ? C.bad : C.text} delay={180} />
        <Kpi label="Pace" value={sum.pace !== null && daily.rows ? `${Math.round(sum.pace * 100)}%` : '—'} color={paceCol(sum.pace)}
          sub={!daily.rows ? '' : !sum.current && sum.expectedByNow !== null ? 'Whole period, against the budget' : sum.expectedByNow !== null && sum.completeDays ? `${money(sum.spentComplete)} vs ${money(sum.expectedByNow)} expected by now` : 'Needs a budget and one full day'} delay={220} />
        <Kpi label={sum.current ? 'Forecast at period end' : 'Final spend'} value={sum.forecast !== null && daily.rows ? money(sum.forecast) : '—'}
          sub={!daily.rows ? '' : sum.projectedUnused === null ? (sum.runRate !== null ? `${money(sum.runRate)}/day lately` : '') : sum.projectedUnused >= 0 ? `${money(sum.projectedUnused)} left unused` : `${money(-sum.projectedUnused)} over budget`}
          subColor={sum.projectedUnused === null ? C.faint : sum.projectedUnused > (sum.budget || 0) * 0.1 ? C.warn : sum.projectedUnused < -(sum.budget || 0) * 0.05 ? C.bad : C.good} delay={260} />
      </div>

      {!sum.future && daily.rows && <BurnUp pid={pid} today={today} byDay={byDay} budget={sum.budget} forecast={sum.current ? sum.forecast : null} />}
      {!sum.future && daily.rows && <RewardsCard totals={totals} prizes={prizes} budget={sum.budget} hasPrizes={hasPrizes} />}
      {sum.current && daily.rows && <Leftover sum={sum} today={today} lines={lines} raffles={raffles}
        rafflesNote={!hasPrizes ? 'Raffle suggestions load after the backend v9 update.' : raffleQ.loading ? 'Loading raffles…' : raffleQ.error ? `Raffles didn't load: ${raffleQ.error}` : 'No raffle data.'} />}

      {/* ── Over time: one range + grain for the chart and the table ── */}
      <div className="between a-up" style={{ alignItems: 'flex-end', marginTop: 8, gap: 12, flexWrap: 'wrap', animationDelay: '300ms' }}>
        <div>
          <h2 className="h2">Over time</h2>
          <div className="caption" style={{ marginTop: 4 }}>{dayLabel(histFrom)}, {histFrom.slice(0, 4)} → today · each day is held against its own period's budget</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {hist.loading && <span className="caption row" style={{ gap: 8 }}><span style={{ width: 14, height: 14, border: `2px solid ${C.line2}`, borderTopColor: C.lime, borderRadius: '50%', animation: 'bo-spin .8s linear infinite' }} />{hist.progress || 'Fetching history…'}<button onClick={hist.cancel} style={{ border: '1px solid #4A1D1D', background: 'transparent', color: C.bad, borderRadius: 8, height: 26, padding: '0 10px', fontSize: 12, cursor: 'pointer' }}>Cancel</button></span>}
          <Seg value={span} onChange={pickSpan} options={SPANS} />
          {span === 'custom' && <input type="date" className="input mono" aria-label="History from" value={customFrom} min="2024-01-01" max={today}
            onChange={(e) => { setCustomFrom(e.target.value); if (ISO_DAY.test(e.target.value)) remember('bo2_util_from', e.target.value) }} style={{ width: 150, height: 34 }} />}
          <Seg value={grain} onChange={pickGrain} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
        </div>
      </div>
      {hist.error && hist.error !== MP_OUTDATED && <div className="card" style={{ padding: '12px 16px', color: hist.error === MP_CANCELLED ? C.muted : C.bad, fontSize: 13 }}>{hist.error === MP_CANCELLED ? 'History query cancelled.' : `History didn't load: ${hist.error}`} <button className="btn small" onClick={hist.refresh}>Run again</button></div>}

      <Card delay={320}>
        <div className="between" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div><h2 className="h2">Spend by reward type</h2><div className="caption" style={{ marginTop: 4 }}>Per {grain} · dotted end = still running (to date)</div></div>
          {hist.rows && (
            <div className="row" style={{ gap: 22, flexWrap: 'wrap' }}>
              <div><div className="caption">Spent in range</div><div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{money(histTotal.spent)}</div></div>
              <div><div className="caption">Budget in range</div><div className="mono" style={{ fontSize: 18, fontWeight: 600, color: histTotal.budgetDays ? C.text : C.faint }}>{histTotal.budgetDays ? money(histTotal.budget) : '—'}</div>
                {histTotal.budgetDays > 0 && histTotal.budgetDays < histTotal.days && <div className="caption">{histTotal.budgetDays} of {histTotal.days} days have one</div>}</div>
              {hasPrizes && KINDS.filter((k) => k !== 'mp').map((k) => (
                <div key={k}><div className="caption">{KIND_LABEL[k]}</div><div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{money(histTotal.kinds[k])}</div></div>
              ))}
            </div>
          )}
        </div>
        {hist.rows
          ? <SpendLines data={series} grain={grain} stale={hist.stale} hasPrizes={hasPrizes} />
          : <div className="caption" style={{ height: 200, display: 'grid', placeItems: 'center' }}>{hist.loading ? 'Loading history…' : 'No history yet.'}</div>}
      </Card>

      <Card pad={false} delay={340} style={{ overflowX: 'auto' }}>
        <div style={{ padding: '16px 18px 12px' }}>
          <h2 className="h2">Spend vs. budget · {grain === 'day' ? 'by day' : grain === 'week' ? 'by week' : 'by month'}</h2>
          <div className="caption" style={{ marginTop: 4 }}>
            {grain === 'month'
              ? 'Set a past month\'s budget here (Edit). A monthly budget carries on to the next months until one has its own; a half-month override still wins.'
              : 'Budget = each period\'s budget ÷ its days. Switch to Monthly to set budgets for past months.'}
          </div>
        </div>
        <div style={{ minWidth: 1000, opacity: hist.stale ? 0.45 : 1 }}>
          <div className="thead" style={{ gridTemplateColumns: TGRID }}>
            <span>{grain === 'day' ? 'Day' : grain === 'week' ? 'Week' : 'Month'}</span><span>Spent</span><span>Budget</span><span>Utilization</span>
            {KINDS.map((k) => <span key={k} className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: KIND_COLOR[k] }} />{KIND_LABEL[k]}</span>)}
            <span>Units</span>
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {table.map((b) => (
              <div key={b.key} className="trow" style={{ gridTemplateColumns: TGRID, minHeight: 40 }}>
                <span>{b.label}{b.partial && <span className="caption">{b.cutStart ? ` · from ${dayLabel(histFrom)}` : ' · to date'}</span>}</span>
                <span className="mono">{hist.rows ? money(b.spent) : '—'}</span>
                {grain === 'month'
                  ? <MonthBudget b={b} periods={periods} canEdit={canEdit} onSave={(n) => saveMonth(b.key, n)} />
                  : <span className="mono" style={{ color: b.budget === null ? C.faint : C.muted }}>{b.budget === null ? 'no budget' : money(b.budget)}</span>}
                {b.utilization !== null && hist.rows ? (b.partial ? <UtilBar value={b.utilization * 100} dim /> : <BudgetBar value={b.utilization * 100} />) : <span className="caption">—</span>}
                {KINDS.map((k) => <span key={k} className="mono" style={{ color: b.kinds[k] ? C.muted : C.faint }}>{!hist.rows || (k !== 'mp' && !hasPrizes) ? '—' : money(b.kinds[k])}</span>)}
                <span className="mono" style={{ color: C.muted }}>{hist.rows ? b.units.toLocaleString('en-US') : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {!sum.future && (
        <Card pad={false} delay={380} style={{ overflowX: 'auto' }}>
          <div style={{ padding: '16px 18px 12px' }}>
            <h2 className="h2">Marketplace by product · {periodLabel(pid)}</h2>
            <div className="caption" style={{ marginTop: 4 }}>
              {sum.current ? `${prodDays} complete day${prodDays === 1 ? '' : 's'} (today is left out)` : `${range.days} days`} · plan/day = units opened by active marketplace allocations in BuffOps, all countries{sum.current ? ' · "Sold out" is live from the marketplace' : ''}
            </div>
          </div>
          <div style={{ minWidth: 860 }}>
            <div className="thead" style={{ gridTemplateColumns: PGRID }}><span>Product</span><span>Status</span><span>Bought</span><span>Per day</span><span>Plan / day</span><span>Sell-through</span><span>Spent</span><span>Share</span></div>
            {lines.map((l) => (
              <div key={l.name} className="trow" style={{ gridTemplateColumns: PGRID, height: 42 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.name}>{l.name}</span>
                <span><span className="chip" title={FLAG[l.flag].tip} style={{ color: FLAG[l.flag].color, background: FLAG[l.flag].color + '1A' }}>{FLAG[l.flag].label}</span></span>
                <span className="mono">{l.units.toLocaleString('en-US')}</span>
                <span className="mono" style={{ color: C.muted }}>{l.perDay.toFixed(1)}</span>
                <span className="mono" style={{ color: C.muted }}>{l.plannedPerDay ? l.plannedPerDay.toLocaleString('en-US') : '—'}</span>
                {l.sellThrough !== null ? <UtilBar value={l.sellThrough * 100} /> : <span className="caption">—</span>}
                <span className="mono" title={`${money(l.unitUSD, 2)} each (${l.source === 'plan' ? 'BuffOps price' : l.source === 'face' ? 'face value' : 'flat rate'})`}>{money(l.spent)}{l.source !== 'plan' && <span style={{ color: C.faint }}>*</span>}</span>
                <span className="mono" style={{ color: C.faint }}>{Math.round(l.share * 100)}%</span>
              </div>
            ))}
            {!lines.length && <div className="trow" style={{ height: 48, color: C.faint, gridTemplateColumns: '1fr' }}>{daily.rows ? 'No purchases in this window.' : 'Waiting for purchases…'}</div>}
          </div>
          {srcTotal > 0 && (
            <div className="caption" style={{ padding: '12px 18px 16px' }}>
              Value per unit: BuffOps product price ({Math.round((src.plan / srcTotal) * 100)}%), else the face value in the name* ({Math.round((src.face / srcTotal) * 100)}%), else a flat $0.66* ({Math.round((src.flat / srcTotal) * 100)}%).
            </div>
          )}
        </Card>
      )}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </>
  )
}
const TGRID = '1.5fr 0.9fr 1.25fr 1.3fr 0.9fr 0.8fr 0.8fr 0.8fr 0.6fr'

/** A month's budget in the history table: where it comes from, and an inline editor for that month's standing budget. */
function MonthBudget({ b, periods, canEdit, onSave }: { b: Bucket; periods: BudgetPeriod[]; canEdit: boolean; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false)
  const own = periods.find((p) => p.id === monthlyId(b.key) && p.amountUSD > 0)
  const carried = own ? undefined : monthlyFor(periods, b.key)
  const halves = periods.some((p) => (p.id === `${b.key}-A` || p.id === `${b.key}-B`) && p.amountUSD > 0)
  const [val, setVal] = useState(own ? String(own.amountUSD) : '')
  const n = parseUSD(val)
  if (editing) {
    return (
      <form className="row" style={{ gap: 6, padding: '4px 0' }} onSubmit={(e) => { e.preventDefault(); if (okUSD(n)) { onSave(n); setEditing(false) } }}>
        <input className="input mono" autoFocus inputMode="decimal" aria-label={`Monthly budget for ${b.label} in USD`} value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="0" style={{ width: 92, height: 30, padding: '0 8px', borderColor: okUSD(n) ? undefined : C.bad }} />
        <button className="btn primary small" type="submit" disabled={!okUSD(n)} style={{ height: 30 }}>Save</button>
        <button className="btn small" type="button" onClick={() => setEditing(false)} style={{ height: 30 }} aria-label="Cancel">✕</button>
      </form>
    )
  }
  const src = own || carried
  const note = src ? `${money(src.amountUSD)}/mo · ${own ? 'set here' : `from ${monthLabel(src.id.slice(2))}`}${b.partial ? ' · shown to date' : ''}` : ''
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <span className="mono" style={{ color: b.budget === null ? C.faint : C.muted }}>{b.budget === null ? 'no budget' : money(b.budget)}</span>
        {(note || halves) && <span className="caption" style={{ fontSize: 11 }}>{[note, halves && 'has override'].filter(Boolean).join(' · ')}</span>}
      </span>
      {canEdit && <button className="btn small" style={{ height: 22, padding: '0 8px' }} onClick={() => { setVal(own ? String(own.amountUSD) : ''); setEditing(true) }}>{own ? 'Edit' : 'Set'}</button>}
    </span>
  )
}

/** Like UtilBar, but spending past the budget (over 105%) is a problem too, not "great". */
function BudgetBar({ value }: { value: number }) {
  if (value <= 105) return <UtilBar value={value} />
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }} title="Over budget">
      <span style={{ flex: 1, height: 5, borderRadius: 3, background: C.orange }} />
      <span className="mono" style={{ fontSize: 12, color: C.orange, width: 34 }}>{Math.round(value)}%</span>
    </span>
  )
}
const PGRID = '2.4fr 1fr 0.7fr 0.7fr 0.9fr 1.3fr 0.9fr 0.6fr'

const parseUSD = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(/[$,\s]/g, '')))
const okUSD = (n: number) => Number.isFinite(n) && n >= 0

/** One "$ [amount] [Save]" form. Empty + save = remove. */
function MoneyForm({ label, value, canEdit, onSave, cta }: { label: string; value: number | null; canEdit: boolean; onSave: (n: number) => void; cta: string }) {
  const [val, setVal] = useState(value ? String(value) : '')
  const n = parseUSD(val)
  const ok = okUSD(n)
  const changed = n !== (value || 0)
  return (
    <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (ok && changed) onSave(n) }}>
      <span style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: 11, color: C.faint, fontSize: 14 }}>$</span>
        <input className="input mono" inputMode="decimal" aria-label={label} disabled={!canEdit} value={val} onChange={(e) => setVal(e.target.value)} placeholder="0" style={{ width: 150, paddingLeft: 24, borderColor: ok ? undefined : C.bad }} />
      </span>
      <button className="btn primary small" type="submit" disabled={!canEdit || !ok || !changed} style={{ height: 40 }}>{cta}</button>
    </form>
  )
}

function BudgetBox({ pid, info, canEdit, onSaveMonthly, onSavePeriod, planOpened, planExpected }: {
  pid: string; info: BudgetInfo; canEdit: boolean
  onSaveMonthly: (n: number) => void; onSavePeriod: (n: number) => void; planOpened: number; planExpected: number
}) {
  const [override, setOverride] = useState(info.from === 'period')
  const ym = pid.slice(0, 7)
  const m = info.monthly
  const stamp = (p?: BudgetPeriod) => (p?.updatedAt ? ` · set by ${p.updatedBy || 'someone'} ${p.updatedAt.slice(0, 10)}` : '')
  const budget = info.amount || 0
  return (
    <Card delay={110}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
          <div>
            <div className="label">Monthly budget · all rewards</div>
            <div style={{ marginTop: 10 }}>
              <MoneyForm key={m?.id || 'none'} label="Monthly budget in USD" value={m?.amountUSD ?? null} canEdit={canEdit} onSave={onSaveMonthly} cta={m ? 'Update' : 'Set'} />
            </div>
            <div className="caption" style={{ marginTop: 8, maxWidth: 300 }}>
              {m ? `Since ${monthLabel(m.id.slice(2))}, until changed${stamp(m)}` : 'Marketplace + Buff Pass + raffles. Applies from this month until you change it.'}
              {m && m.id.slice(2) !== ym && ' · a change applies from ' + monthLabel(ym)}
            </div>
          </div>
          <div>
            <div className="label">This period · {periodLabel(pid)}</div>
            {override ? (
              <>
                <div style={{ marginTop: 10 }}><MoneyForm key={info.entry?.id || 'new'} label="Budget for this period in USD" value={info.entry?.amountUSD ?? null} canEdit={canEdit} onSave={(n) => { onSavePeriod(n); if (!n) setOverride(false) }} cta={info.entry ? 'Update' : 'Set'} /></div>
                <div className="caption" style={{ marginTop: 8 }}>
                  {info.entry ? `Overrides the monthly budget${stamp(info.entry)} · clear and save to go back` : <>Only this half-month. <button className="btn small" style={{ height: 22, padding: '0 8px' }} onClick={() => setOverride(false)}>Cancel</button></>}
                </div>
              </>
            ) : (
              <>
                <div className="mono" style={{ fontSize: 26, fontWeight: 600, marginTop: 10, height: 40, display: 'flex', alignItems: 'center' }}>{info.amount ? money(info.amount) : '—'}</div>
                <div className="caption" style={{ marginTop: 8 }}>
                  {info.from === 'monthly' ? `From the monthly budget · ${periodRange(pid).days} of its month's days` : 'Set a monthly budget first'}
                  {canEdit && <> · <button className="btn small" style={{ height: 22, padding: '0 8px' }} onClick={() => setOverride(true)}>Override</button></>}
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div className="caption">Marketplace plan opens</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{money(planOpened)}</div>
            {budget > 0 && <div className="caption">{Math.round((planOpened / budget) * 100)}% of the budget</div>}
          </div>
          <div>
            <div className="caption">Expected to be bought</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{money(planExpected)}</div>
            {budget > 0 && <div className="caption">{Math.round((planExpected / budget) * 100)}% of the budget</div>}
          </div>
        </div>
      </div>
    </Card>
  )
}

/** Where the period's money went: marketplace vs. Buff Pass / raffle / other prizes from internal stock. */
function RewardsCard({ totals, prizes, budget, hasPrizes }: { totals: Record<Kind, number>; prizes: PrizeLine[]; budget: number | null; hasPrizes: boolean }) {
  const all = KINDS.reduce((a, k) => a + totals[k], 0)
  const COL = KIND_COLOR
  const unpriced = prizes.filter((p) => p.source === 'none')
  return (
    <Card delay={300}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><h2 className="h2">All rewards</h2><div className="caption" style={{ marginTop: 4 }}>Everything the budget pays for in this period, today included</div></div>
        <div className="mono caption">{money(all)}{budget ? ` of ${money(budget)}` : ''}</div>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#23262B', marginTop: 16 }}>
        {KINDS.map((k) => totals[k] > 0 && <span key={k} title={`${KIND_LABEL[k]}: ${money(totals[k])}`} style={{ width: `${(totals[k] / Math.max(all, budget || 0, 1)) * 100}%`, background: COL[k] }} />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 14 }}>
        {KINDS.map((k) => (
          <div key={k}>
            <div className="caption row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: COL[k] }} />{KIND_LABEL[k]}</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{k !== 'mp' && !hasPrizes ? '—' : money(totals[k])}</div>
            <div className="caption">{budget && (k === 'mp' || hasPrizes) ? `${totals[k] > 0 && totals[k] / budget < 0.005 ? '<1' : Math.round((totals[k] / budget) * 100)}% of the budget` : ''}</div>
          </div>
        ))}
      </div>
      {!hasPrizes && <div className="caption" style={{ marginTop: 12, color: C.warn }}>Buff Pass, raffle and other prizes load after the backend v9 update (Code-v9-all-rewards.gs) — until then only the marketplace is counted.</div>}
      {prizes.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${C.line}` }}>
          {prizes.map((p) => (
            <div key={p.name} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                <span className="chip" style={{ color: COL[p.kind], background: COL[p.kind] + '1A' }}>{KIND_LABEL[p.kind]}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>
              </span>
              <span className="mono" style={{ whiteSpace: 'nowrap', color: p.source === 'none' ? C.warn : C.text }}>
                {p.units} × {p.source === 'none' ? 'no price' : money(p.unitUSD, 2)} {p.source !== 'none' && <span style={{ color: C.muted }}>= {money(p.spent)}</span>}
              </span>
            </div>
          ))}
          {unpriced.length > 0 && <div className="caption" style={{ marginTop: 10 }}>"No price" items count as $0. Add them in Products with their exact name as the Redash name (and purpose Raffles / Buff Pass) to price and classify them.</div>}
        </div>
      )}
    </Card>
  )
}

/** Cumulative spend through the period vs. the ideal straight line to the budget, with daily bars underneath. */
function BurnUp({ pid, today, byDay, budget, forecast }: { pid: string; today: string; byDay: Map<string, { usd: number }>; budget: number | null; forecast: number | null }) {
  const { start, end, days } = periodRange(pid)
  const ds = dayList(start, end)
  const shown = ds.filter((d) => d <= today)
  const daily = shown.map((d) => byDay.get(d)?.usd || 0)
  const cum: number[] = []
  for (const v of daily) cum.push((cum.at(-1) || 0) + v)
  const run = cum.at(-1) || 0
  const top = Math.max(1, budget || 0, forecast || 0, run) * 1.1
  const maxDay = Math.max(1, ...daily, ...ds.map((d) => (budget ? (dailyBudget(d, [{ id: pid, amountUSD: budget }]) || 0) : 0)))
  const W = 800, H = 230, L = 52, R = 14, T = 14, B = 26, BAR = 46
  const x = (i: number) => L + ((i + 0.5) / days) * (W - L - R)
  const y = (v: number) => T + (1 - v / top) * (H - T - B - BAR - 8)
  const yb = (v: number) => H - B - (v / maxDay) * BAR
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top)
  const last = shown.length - 1
  return (
    <Card delay={280}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><h2 className="h2">Burn-up</h2><div className="caption" style={{ marginTop: 4 }}>Cumulative spend vs. the even path to the budget · bars = spend per day</div></div>
        <div className="row caption" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 3, background: C.lime, borderRadius: 2 }} />Spent</span>
          {budget && <span className="row" style={{ gap: 6 }}><span style={{ width: 14, borderTop: `2px dashed ${C.muted}` }} />Even pace</span>}
          {forecast !== null && <span className="row" style={{ gap: 6 }}><span style={{ width: 14, borderTop: `2px dotted ${C.sky}` }} />Forecast</span>}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 12, display: 'block' }} role="img" aria-label={`Spend through ${periodLabel(pid)}`}>
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.line} /><text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={C.faint}>{v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${Math.round(v)}`}</text></g>)}
        {budget && <>
          <line x1={L} x2={W - R} y1={y(budget)} y2={y(budget)} stroke={C.text} strokeOpacity=".5" />
          <text x={W - R} y={y(budget) - 6} textAnchor="end" fontSize="11" fill={C.muted}>Budget {money(budget)}</text>
          <line x1={L} y1={y(0)} x2={x(days - 1)} y2={y(budget)} stroke={C.muted} strokeDasharray="5 5" />
        </>}
        {forecast !== null && last >= 0 && <line x1={x(last)} y1={y(cum[last])} x2={x(days - 1)} y2={y(forecast)} stroke={C.sky} strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />}
        {cum.length > 0 && <polyline fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinejoin="round" points={[`${L},${y(0)}`, ...cum.map((v, i) => `${x(i)},${y(v)}`)].join(' ')} />}
        {last >= 0 && <circle cx={x(last)} cy={y(cum[last])} r="4" fill={C.lime} />}
        {daily.map((v, i) => {
          const bw = Math.max(4, ((W - L - R) / days) * 0.6)
          const over = budget && v > budget / days
          return <rect key={ds[i]} x={x(i) - bw / 2} y={yb(v)} width={bw} height={Math.max(0, H - B - yb(v))} rx="2" fill={ds[i] === today ? C.ghost : over ? C.orange : '#3A3F47'}><title>{`${ds[i]}: ${money(v)}${ds[i] === today ? ' (so far)' : ''}`}</title></rect>
        })}
        {budget && <line x1={L} x2={W - R} y1={yb(budget / days)} y2={yb(budget / days)} stroke={C.muted} strokeOpacity=".5" strokeDasharray="2 3" />}
        {ds.map((d, i) => (i === 0 || i === days - 1 || i % 3 === 0) && <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={d === today ? C.lime : C.faint}>{+d.slice(8)}</text>)}
      </svg>
    </Card>
  )
}
