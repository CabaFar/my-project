/** مفتاح الشهر الميلادي: YYYY-MM */
export type MonthKey = string

const GREGORIAN_MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toMonthKey(input: Date | string): MonthKey {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function currentMonthKey(): MonthKey {
  return toMonthKey(new Date())
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number)
  const year = Number.isFinite(y) ? y : new Date().getFullYear()
  const month = Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1
  return { year, month }
}

export function nextMonthKey(key: MonthKey): MonthKey {
  const { year, month } = parseMonthKey(key)
  if (month === 12) return `${year + 1}-01`
  return `${year}-${pad2(month + 1)}`
}

export function prevMonthKey(key: MonthKey): MonthKey {
  const { year, month } = parseMonthKey(key)
  if (month === 1) return `${year - 1}-12`
  return `${year}-${pad2(month - 1)}`
}

export function monthLabelAr(key: MonthKey): string {
  const { year, month } = parseMonthKey(key)
  return `${GREGORIAN_MONTHS_AR[month - 1]} ${year}`
}

export function monthShortAr(monthIndex1to12: number): string {
  const m = Math.min(12, Math.max(1, monthIndex1to12))
  return GREGORIAN_MONTHS_AR[m - 1]
}

export function monthsOfYear(year: number): MonthKey[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${pad2(i + 1)}`)
}

export function isValidMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== 'string') return false
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}
