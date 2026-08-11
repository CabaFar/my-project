import { normalizeCashDay, type CashDayRecord } from './cash'
import type { HistoryEntry, Order } from './types'

const STORAGE_KEY = 'riyadh-bank-sales-orders'
const TARGET_KEY = 'riyadh-bank-monthly-target'
const HISTORY_KEY = 'riyadh-bank-sales-history'
const CASH_KEY = 'riyadh-bank-cash-days'

export function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Order[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveOrders(orders: Order[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

export function loadMonthlyTarget(): number {
  try {
    const raw = localStorage.getItem(TARGET_KEY)
    if (!raw) return 0
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

export function saveMonthlyTarget(target: number): void {
  localStorage.setItem(TARGET_KEY, String(target))
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(history: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function loadCashDays(): CashDayRecord[] {
  try {
    const raw = localStorage.getItem(CASH_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeCashDay(item))
      .filter((item): item is CashDayRecord => item !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

export function saveCashDays(days: CashDayRecord[]): void {
  localStorage.setItem(CASH_KEY, JSON.stringify(days))
}

export function buildDiskBackup(
  orders: Order[],
  history: HistoryEntry[],
  target: number,
  cashDays: CashDayRecord[] = [],
) {
  return {
    savedAt: new Date().toISOString(),
    app: 'riyadh-bank-sales',
    monthlyTarget: target,
    orders,
    history,
    cashDays,
  }
}

export function downloadBackupToDisk(
  orders: Order[],
  history: HistoryEntry[],
  target: number,
  cashDays: CashDayRecord[] = [],
): void {
  const payload = buildDiskBackup(orders, history, target, cashDays)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const a = document.createElement('a')
  a.href = url
  a.download = `riyadh-sales-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
