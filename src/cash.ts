export type BranchId = 'waseeta' | 'beirut'

export interface BranchDayCash {
  cash: number
  expense: number
}

export interface CashDayRecord {
  date: string
  waseeta: BranchDayCash
  beirut: BranchDayCash
  updatedAt: string
}

export const BRANCHES: { id: BranchId; label: string }[] = [
  { id: 'waseeta', label: 'الوسيطاء' },
  { id: 'beirut', label: 'بيروت' },
]

export function emptyBranchCash(): BranchDayCash {
  return { cash: 0, expense: 0 }
}

export function emptyDayRecord(date: string): CashDayRecord {
  return {
    date,
    waseeta: emptyBranchCash(),
    beirut: emptyBranchCash(),
    updatedAt: new Date().toISOString(),
  }
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}

export function currentMonthKey(now = new Date()): string {
  return monthKey(now.getFullYear(), now.getMonth() + 1)
}

export function shiftMonthKey(key: string, delta: number): string {
  const parsed = parseMonthKey(key)
  if (!parsed) return currentMonthKey()
  const d = new Date(parsed.year, parsed.month - 1 + delta, 1)
  return monthKey(d.getFullYear(), d.getMonth() + 1)
}

export function weekdayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(d)
}

export function dayNumberLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'long',
  }).format(d)
}

export function monthTitle(key: string): string {
  const parsed = parseMonthKey(key)
  if (!parsed) return key
  return new Intl.DateTimeFormat('ar-SA', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(parsed.year, parsed.month - 1, 1))
}

export function normalizeCashDay(raw: unknown): CashDayRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<CashDayRecord> & {
    waseetaCash?: number
    waseetaExpense?: number
    beirutCash?: number
    beirutExpense?: number
  }
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null

  const waseeta =
    r.waseeta && typeof r.waseeta === 'object'
      ? {
          cash: Math.max(0, Number(r.waseeta.cash) || 0),
          expense: Math.max(0, Number(r.waseeta.expense) || 0),
        }
      : {
          cash: Math.max(0, Number(r.waseetaCash) || 0),
          expense: Math.max(0, Number(r.waseetaExpense) || 0),
        }

  const beirut =
    r.beirut && typeof r.beirut === 'object'
      ? {
          cash: Math.max(0, Number(r.beirut.cash) || 0),
          expense: Math.max(0, Number(r.beirut.expense) || 0),
        }
      : {
          cash: Math.max(0, Number(r.beirutCash) || 0),
          expense: Math.max(0, Number(r.beirutExpense) || 0),
        }

  return {
    date: r.date,
    waseeta,
    beirut,
    updatedAt:
      typeof r.updatedAt === 'string' && r.updatedAt
        ? r.updatedAt
        : new Date().toISOString(),
  }
}

export function mergeCashDays(
  local: CashDayRecord[],
  cloud: CashDayRecord[],
): CashDayRecord[] {
  const map = new Map<string, CashDayRecord>()
  for (const day of cloud) {
    const n = normalizeCashDay(day)
    if (n) map.set(n.date, n)
  }
  for (const day of local) {
    const n = normalizeCashDay(day)
    if (!n) continue
    const existing = map.get(n.date)
    if (!existing || new Date(n.updatedAt) >= new Date(existing.updatedAt)) {
      map.set(n.date, n)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function buildMonthDays(
  year: number,
  month: number,
  records: CashDayRecord[],
): CashDayRecord[] {
  const byDate = new Map(records.map((r) => [r.date, r]))
  const total = daysInMonth(year, month)
  const days: CashDayRecord[] = []
  for (let day = 1; day <= total; day += 1) {
    const key = dateKey(year, month, day)
    days.push(byDate.get(key) ?? emptyDayRecord(key))
  }
  return days
}

export interface BranchTotals {
  cash: number
  expense: number
  net: number
}

export interface CashTotals {
  waseeta: BranchTotals
  beirut: BranchTotals
  all: BranchTotals
}

function sumBranch(days: CashDayRecord[], branch: BranchId): BranchTotals {
  const cash = days.reduce((s, d) => s + d[branch].cash, 0)
  const expense = days.reduce((s, d) => s + d[branch].expense, 0)
  return { cash, expense, net: cash - expense }
}

export function computeTotals(days: CashDayRecord[]): CashTotals {
  const waseeta = sumBranch(days, 'waseeta')
  const beirut = sumBranch(days, 'beirut')
  return {
    waseeta,
    beirut,
    all: {
      cash: waseeta.cash + beirut.cash,
      expense: waseeta.expense + beirut.expense,
      net: waseeta.net + beirut.net,
    },
  }
}
