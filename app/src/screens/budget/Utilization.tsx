// Marketplace budget utilization: the half-month budget (entered by hand) against what users really bought.
// Real purchases come from the Inventory DB through backend v8 (?action=mpq); the math lives in lib/utilization.ts.
import { useMemo, useState } from 'react'
import { calcDailyQty, calcPriceUSD, calcRealDaily } from '../../lib/calc'
import { MP_CANCELLED, MP_OUTDATED, useBackendVersion, useMpDaily, useMpStock } from '../../lib/mpdata'
import { iso } from '../../lib/redash'
import { useSession } from '../../lib/session'
import { useData, useStore } from '../../lib/store'
import {
  addDays, budgetOf, buckets, dayList, dailyBudget, makePricer, periodLabel, periodOf, periodRange, productLines,
  shiftPeriod, spendByDay, spendBySource, summarizePeriod, upsertBudget, type Flag, type Grain,
} from '../../lib/utilization'
import { C, Card, Icon, Kpi, Seg, Toast, UtilBar, money } from '../../ui/kit'

const NEED_VERSION = 8
const firstOfPrevMonth = (day: string) => {
  const y = +day.slice(0, 4), m = +day.slice(5, 7)
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
}

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
  const [grain, setGrain] = useState<Grain>('day')
  const [toast, setToast] = useState('')

  const range = periodRange(pid)
  // One query covers last month → today (exclusive end = tomorrow); going further back widens it.
  const from = [firstOfPrevMonth(today), `${range.start.slice(0, 7)}-01`].sort()[0]
  const to = addDays(today, 1)
  const backendOk = version === null ? null : version >= NEED_VERSION
  const daily = useMpDaily(from, to, backendOk === true)
  const stock = useMpStock(backendOk === true)

  const price = useMemo(() => makePricer(data.allocs, data.products), [data.allocs, data.products])
  const byDay = useMemo(() => spendByDay(daily.rows || [], price), [daily.rows, price])
  const periods = data.budgetPeriods
  const sum = summarizePeriod(pid, byDay, periods, today)

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

  // Newest first.
  const table = useMemo(() => buckets(grain, from, today, today, byDay, periods).reverse(), [grain, from, today, byDay, periods])

  const canEdit = !store.viewOnly && backendOk === true
  const saveBudget = (amount: number) => {
    store.update((s) => ({ ...s, budgetPeriods: upsertBudget(s.budgetPeriods, pid, amount, session.username) }))
    setToast(amount > 0 ? `Budget for ${periodLabel(pid)} set to ${money(amount)}` : `Budget for ${periodLabel(pid)} removed`)
  }

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
          <button className="icon-btn" aria-label="Refresh purchases" disabled={!backendOk} onClick={() => { daily.refresh(); stock.refresh() }}>{Icon.refresh}</button>
        </div>
      </div>

      {backendOk === false || err === MP_OUTDATED ? (
        <div className="card a-up" style={{ padding: '12px 16px', borderColor: '#4A3A12', color: C.warn, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
          {Icon.warn}<span>The Google backend needs the v8 update (Code-v8-mp-utilization.gs) before real purchases load and budgets can be saved.</span>
        </div>
      ) : err === MP_CANCELLED ? (
        <div className="card" style={{ padding: '12px 16px', color: C.muted, fontSize: 13 }}>Query cancelled — real spend is not shown. <button className="btn small" onClick={() => { daily.refresh(); stock.refresh() }}>Run again</button></div>
      ) : err ? <div className="card" style={{ padding: '12px 16px', borderColor: '#4A1D1D', color: C.bad, fontSize: 13 }}>Redash didn't answer: {err}</div> : null}

      <BudgetBox key={pid} pid={pid} current={budgetOf(periods, pid)} meta={periods.find((p) => p.id === pid)} canEdit={canEdit} onSave={saveBudget}
        planOpened={plan.opened * range.days} planExpected={plan.expected * range.days} />

      <div className="grid a-up" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', animationDelay: '140ms' }}>
        <Kpi label="Spent" value={daily.rows ? money(sum.spent) : '—'} sub={sum.future ? 'Not started' : !daily.rows ? 'Waiting for purchases' : sum.current ? `${money(sum.today)} today so far` : `${range.days} days`} accent delay={140} />
        <Kpi label="Utilization" value={sum.utilization !== null && daily.rows ? `${Math.round(sum.utilization * 100)}%` : '—'} sub={sum.budget ? `of ${money(sum.budget)}` : 'Set a budget to see this'} color={sum.utilization !== null && sum.utilization > 1 ? C.bad : C.text} delay={180} />
        <Kpi label="Pace" value={sum.pace !== null && daily.rows ? `${Math.round(sum.pace * 100)}%` : '—'} color={paceCol(sum.pace)}
          sub={!daily.rows ? '' : !sum.current && sum.expectedByNow !== null ? 'Whole period, against the budget' : sum.expectedByNow !== null && sum.completeDays ? `${money(sum.spentComplete)} vs ${money(sum.expectedByNow)} expected by now` : 'Needs a budget and one full day'} delay={220} />
        <Kpi label={sum.current ? 'Forecast at period end' : 'Final spend'} value={sum.forecast !== null && daily.rows ? money(sum.forecast) : '—'}
          sub={!daily.rows ? '' : sum.projectedUnused === null ? (sum.runRate !== null ? `${money(sum.runRate)}/day lately` : '') : sum.projectedUnused >= 0 ? `${money(sum.projectedUnused)} left unused` : `${money(-sum.projectedUnused)} over budget`}
          subColor={sum.projectedUnused === null ? C.faint : sum.projectedUnused > (sum.budget || 0) * 0.1 ? C.warn : sum.projectedUnused < -(sum.budget || 0) * 0.05 ? C.bad : C.good} delay={260} />
      </div>

      {!sum.future && daily.rows && <BurnUp pid={pid} today={today} byDay={byDay} budget={sum.budget} forecast={sum.current ? sum.forecast : null} />}

      <Card pad={false} delay={320} style={{ overflowX: 'auto' }}>
        <div className="between" style={{ padding: '16px 18px 12px', alignItems: 'center' }}>
          <div><h2 className="h2">Spend over time</h2><div className="caption" style={{ marginTop: 4 }}>{from} → today · budget per day = period budget ÷ its days</div></div>
          <Seg value={grain} onChange={setGrain} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
        </div>
        <div style={{ minWidth: 640 }}>
          <div className="thead" style={{ gridTemplateColumns: TGRID }}><span>{grain === 'day' ? 'Day' : grain === 'week' ? 'Week' : 'Month'}</span><span>Spent</span><span>Budget</span><span>Utilization</span><span>Units</span></div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {table.map((b) => (
              <div key={b.key} className="trow" style={{ gridTemplateColumns: TGRID, height: 40 }}>
                <span>{b.label}{b.partial && <span className="caption"> · to date</span>}</span>
                <span className="mono">{daily.rows ? money(b.spent) : '—'}</span>
                <span className="mono" style={{ color: b.budget === null ? C.faint : C.muted }}>{b.budget === null ? 'no budget' : money(b.budget)}</span>
                {b.utilization !== null && daily.rows ? (grain === 'day' && b.partial ? <UtilBar value={b.utilization * 100} dim /> : <BudgetBar value={b.utilization * 100} />) : <span className="caption">—</span>}
                <span className="mono" style={{ color: C.muted }}>{daily.rows ? b.units.toLocaleString('en-US') : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {!sum.future && (
        <Card pad={false} delay={380} style={{ overflowX: 'auto' }}>
          <div style={{ padding: '16px 18px 12px' }}>
            <h2 className="h2">By product · {periodLabel(pid)}</h2>
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
const TGRID = '1.4fr 1fr 1fr 1.4fr 0.7fr'

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

function BudgetBox({ pid, current, meta, canEdit, onSave, planOpened, planExpected }: {
  pid: string; current: number | null; meta?: { updatedAt?: string; updatedBy?: string }; canEdit: boolean
  onSave: (n: number) => void; planOpened: number; planExpected: number
}) {
  const [val, setVal] = useState(current ? String(current) : '')
  const n = Number(val.replace(/[$,\s]/g, ''))
  const valid = val.trim() === '' || (Number.isFinite(n) && n >= 0)
  const changed = (val.trim() === '' ? 0 : n) !== (current || 0)
  const ref = current || (valid && n > 0 ? n : 0)
  return (
    <Card delay={110}>
      <div className="between" style={{ alignItems: 'center' }}>
        <div>
          <div className="label">Marketplace budget · {periodLabel(pid)}</div>
          <form className="row" style={{ marginTop: 10, gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (valid && changed) onSave(val.trim() === '' ? 0 : n) }}>
            <span style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: 11, color: C.faint, fontSize: 14 }}>$</span>
              <input className="input mono" inputMode="decimal" aria-label="Budget in USD" disabled={!canEdit} value={val} onChange={(e) => setVal(e.target.value)} placeholder="0" style={{ width: 160, paddingLeft: 24, borderColor: valid ? undefined : C.bad }} />
            </span>
            <button className="btn primary small" type="submit" disabled={!canEdit || !valid || !changed} style={{ height: 40 }}>{current ? 'Update' : 'Set budget'}</button>
          </form>
          <div className="caption" style={{ marginTop: 8 }}>
            {meta?.updatedAt ? `Set by ${meta.updatedBy || 'someone'} · ${meta.updatedAt.slice(0, 10)}` : 'Not set yet — empty saves nothing; clear and save to remove'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div className="caption">Opened by current allocations</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{money(planOpened)}</div>
            {ref > 0 && <div className="caption" style={{ color: planOpened >= ref ? C.good : C.warn }}>{Math.round((planOpened / ref) * 100)}% of budget</div>}
          </div>
          <div>
            <div className="caption">Expected to be bought</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{money(planExpected)}</div>
            {ref > 0 && <div className="caption" style={{ color: planExpected >= ref * 0.9 ? C.good : C.warn }}>{Math.round((planExpected / ref) * 100)}% of budget</div>}
          </div>
        </div>
      </div>
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
