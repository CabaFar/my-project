import type { Order } from './types'

const STORAGE_KEY = 'riyadh-bank-sales-orders'
const TARGET_KEY = 'riyadh-bank-monthly-target'

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
