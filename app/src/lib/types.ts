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
  /** v2: files attached to the request. The files live in Drive; only these references are in the state. */
  receipts?: Receipt[]
}

export interface Receipt {
  id: string
  name: string
  mime: string
  size: number
  uploadedAt: string
  uploadedBy?: string
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
  /** v2 access level. Missing = Editor (Admin for the built-in admin usernames). v1 ignores this field. */
  access?: 'Admin' | 'Editor' | 'Viewer'
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

/**
 * v2 (backend v8+): the marketplace budget for one half-month, entered by hand.
 * id is "YYYY-MM-A" (1st–15th) or "YYYY-MM-B" (16th–end of month).
 */
export interface BudgetPeriod {
  id: string
  amountUSD: number
  note?: string
  updatedAt?: string
  updatedBy?: string
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
  /** Optional on the server (older data has none); always an array after loadState. */
  budgetPeriods: BudgetPeriod[]
}

/** Required collections — loading fails if one is missing. */
export const STATE_KEYS = ['products', 'allocs', 'orders', 'transactions', 'appUsers', 'raffles', 'raffleCountries', 'budgetExtras'] as const satisfies readonly (keyof AppState)[]
/** Saved like the others, but older data may not have them (defaulted on load). The server keeps them only from backend v8. */
export const OPTIONAL_KEYS = ['budgetPeriods'] as const satisfies readonly (keyof AppState)[]

/** Marketplace gift cards bought per day per product (backend v8, ?action=mpq&q=mpdaily). */
export interface MpDailyRow {
  day: string
  product_name: string | null
  tier: string | null
  purchases: number
}

/** Live stock and demand per active item (backend v8, ?action=mpq&q=mpstock). */
export interface MpStockRow {
  product_name: string | null
  tier: string | null
  daily_restocks: number | null
  purchased_today: number | null
  out_of_stock: boolean | null
  p14: number | null
  p30: number | null
  last_purchase: string | null
}

export interface RedashRow {
  country: string | null
  product_name: string | null
  purchases: number
}
