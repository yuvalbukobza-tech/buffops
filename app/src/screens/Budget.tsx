import { useState } from 'react'
import { Seg } from '../ui/kit'
import Finance, { type FinancePrefill } from './budget/Finance'
import Overview from './budget/Overview'
import PlanVsActual from './budget/PlanVsActual'
import VendorOrders from './budget/VendorOrders'

type Sub = 'overview' | 'actual' | 'orders' | 'finance'
const SUBS: { value: Sub; label: string; title: string; sub: string }[] = [
  { value: 'overview', label: 'Overview', title: 'Budget', sub: 'What each vendor needs per month, and what it is for' },
  { value: 'actual', label: 'Planned vs actual', title: 'Planned vs actual', sub: 'Did each vendor spend what we planned?' },
  { value: 'orders', label: 'Vendor orders', title: 'Vendor orders', sub: 'Build a code order or a money transfer for the next 15 days' },
  { value: 'finance', label: 'Finance requests', title: 'Finance requests', sub: 'Transfers requested from finance, month by month' },
]

export default function Budget() {
  const [sub, setSub] = useState<Sub>(() => (sessionStorage.getItem('bo2_budget_sub') as Sub) || 'overview')
  const [prefill, setPrefill] = useState<FinancePrefill | null>(null)
  // A new prefill re-creates the finance form; clearing it after submit must not (that would reset the screen).
  const [formVersion, setFormVersion] = useState(0)
  const go = (s: Sub) => { setSub(s); try { sessionStorage.setItem('bo2_budget_sub', s) } catch { /* ignore */ } }
  const requestTransfer = (p: FinancePrefill) => { setPrefill(p); setFormVersion((v) => v + 1); go('finance') }
  const cur = SUBS.find((s) => s.value === sub)!
  return (
    <div className="page">
      <div className="between a-up">
        <div><h1 className="h1">{cur.title}</h1><div className="sub">{cur.sub}</div></div>
        <Seg value={sub} onChange={go} options={SUBS.map(({ value, label }) => ({ value, label }))} />
      </div>
      <div key={sub} style={{ display: 'contents' }}>
        {sub === 'overview' && <Overview requestTransfer={requestTransfer} />}
        {sub === 'actual' && <PlanVsActual />}
        {sub === 'orders' && <VendorOrders requestTransfer={requestTransfer} />}
        {sub === 'finance' && <Finance key={formVersion} prefill={prefill} clearPrefill={() => setPrefill(null)} />}
      </div>
    </div>
  )
}
