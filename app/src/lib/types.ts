// Data contract shared with BuffOps v1 and the Apps Script backend.
// Field names must stay exactly as v1 writes them, or old data and backups stop loading.

export type Demand = 'Low' | 'Medium' | 'High' | 'Very High'
export type Purpose = 'MP' | 'Raffles' | 'Buff Pass'

export interface Product {
  id: number
  brand: string
  category: string
  priceToBuffLocal: number
  currency: string
  provider?: string
  vendor?: string
  type: string
  bpRegular: number | null
  bpPremium: number | null
  discountPct: number
  demandLevel: Demand | string
  purpose?: Purpose | string
  redashName?: string
  lootkeyscode?: string
}

export interface AllocRow {
  productId: number
  pulsesPerDay: number
  qtyPerPulse: number
  active?: boolean
  utilizationOverride?: number | null
}

export type Allocs = Record<string, AllocRow[]>

export interface Raffle {
  id: number
  name: string
  vendor: string
  marketPrice: number
  timesPerMonth: number
}

export interface BudgetExtra {
  id: number
  name: string
  vendor: string
  purpose: string
  monthly: number
}

export const DEPTS = ['productDesktop', 'productMobile', 'marketing', 'buffPay', 'dataProject'] as const
export type Dept = (typeof DEPTS)[number]

export interface Transaction {
  id: number
  vendor: string
  productDesktop?: number
  productMobile?: number
  marketing?: number
  buffPay?: number
  dataProject?: number
  totalAmount: number
  note?: string
  enteredBy?: string
  dateRequested: string
  status: 'pending' | 'delivered' | string
  lastUpdate?: string
  departmentsSplit?: string
  statusChangedAt?: string
  statusChangedBy?: string
}

export interface AppUser {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  username: string
  password?: string
  defaultRecipient?: boolean
}

export interface VendorOrder {
  id: number
  vendor: string
  period: string
  month: number
  year: number
  date: string
  items: unknown[]
  totalUSD: number
  status: string
  createdAt?: string
}

export interface AppState {
  products: Product[]
  allocs: Allocs
  orders: VendorOrder[]
  transactions: Transaction[]
  appUsers: AppUser[]
  raffles: Raffle[]
  raffleCountries: Record<string, number[]>
  budgetExtras: BudgetExtra[]
}

export const STATE_KEYS: (keyof AppState)[] = ['products', 'allocs', 'orders', 'transactions', 'appUsers', 'raffles', 'raffleCountries', 'budgetExtras']

export interface RedashRow {
  country: string | null
  product_name: string | null
  purchases: number
}
