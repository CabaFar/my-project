import type { HistoryEntry, Order } from './types'

const STORAGE_KEY = 'riyadh-bank-sales-orders'
const TARGET_KEY = 'riyadh-bank-monthly-target'
const HISTORY_KEY = 'riyadh-bank-sales-history'
const DELETED_KEY = 'riyadh-bank-deleted-ids'

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

export function loadDeletedIds(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [id, at] of Object.entries(parsed)) {
      if (typeof at === 'string' && at) out[id] = at
    }
    return out
  } catch {
    return {}
  }
}

export function saveDeletedIds(deletedIds: Record<string, string>): void {
  localStorage.setItem(DELETED_KEY, JSON.stringify(deletedIds))
}

export function buildDiskBackup(orders: Order[], history: HistoryEntry[], target: number) {
  return {
    savedAt: new Date().toISOString(),
    app: 'riyadh-bank-sales',
    monthlyTarget: target,
    orders,
    history,
  }
}

export function downloadBackupToDisk(
  orders: Order[],
  history: HistoryEntry[],
  target: number,
): void {
  const payload = buildDiskBackup(orders, history, target)
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
