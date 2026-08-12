import type { HistoryEntry, Order } from './types'

export interface CloudStore {
  updatedAt: string
  monthlyTarget: number
  orders: Order[]
  history: HistoryEntry[]
}

const POINTER_URL =
  'https://raw.githubusercontent.com/CabaFar/my-project/main/data/cloud-pointer.json'
const FALLBACK_STORE_URL =
  'https://raw.githubusercontent.com/CabaFar/my-project/main/data/sales-store.json'
const EXTENDS_BASE = 'https://extendsclass.com/api/json-storage/bin'

const LOCAL_BIN_KEY = 'riyadh-bank-cloud-bin-id'
/** Shared ExtendsClass bin used by all devices. */
const DEFAULT_BIN_ID = 'bcafcbb'

let cachedBinId: string | null = null

function normalizeStore(data: unknown): CloudStore | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Partial<CloudStore>
  if (!Array.isArray(raw.orders) || !Array.isArray(raw.history)) return null
  return {
    updatedAt: raw.updatedAt || new Date().toISOString(),
    monthlyTarget: Number(raw.monthlyTarget) || 0,
    orders: raw.orders,
    history: raw.history,
  }
}

export function getLocalBinOverride(): string | null {
  return localStorage.getItem(LOCAL_BIN_KEY)
}

export function applyLocalBinOverride(): void {
  const local = getLocalBinOverride()
  if (local) cachedBinId = local
}

async function resolveBinId(): Promise<string> {
  try {
    const res = await fetch(`${POINTER_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (res.ok) {
      const data = (await res.json()) as {
        binId?: string
        provider?: string
      }
      if (data.binId) {
        cachedBinId = data.binId
        localStorage.setItem(LOCAL_BIN_KEY, data.binId)
        return data.binId
      }
    }
  } catch {
    // ignore — fall back to local/default
  }

  applyLocalBinOverride()
  return cachedBinId || DEFAULT_BIN_ID
}

async function loadFromExtendsClass(binId: string): Promise<CloudStore | null> {
  try {
    const res = await fetch(`${EXTENDS_BASE}/${binId}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return normalizeStore(await res.json())
  } catch {
    return null
  }
}

async function loadFromGitHubBackup(): Promise<CloudStore | null> {
  try {
    const res = await fetch(`${FALLBACK_STORE_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return normalizeStore(await res.json())
  } catch {
    return null
  }
}

export async function loadCloudStore(): Promise<CloudStore | null> {
  const binId = await resolveBinId()
  const primary = await loadFromExtendsClass(binId)
  if (primary) return primary
  return loadFromGitHubBackup()
}

export async function saveCloudStore(store: CloudStore): Promise<boolean> {
  const payload: CloudStore = {
    ...store,
    updatedAt: new Date().toISOString(),
  }
  const binId = await resolveBinId()

  try {
    const res = await fetch(`${EXTENDS_BASE}/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return false
    try {
      const body = (await res.json()) as { status?: number }
      if (typeof body.status === 'number' && body.status !== 0) return false
    } catch {
      // empty body is fine
    }
    localStorage.setItem(LOCAL_BIN_KEY, binId)
    return true
  } catch {
    return false
  }
}

export function mergeStores(local: CloudStore, cloud: CloudStore): CloudStore {
  const orderMap = new Map<string, Order>()
  for (const o of cloud.orders) orderMap.set(o.id, o)
  for (const o of local.orders) {
    const existing = orderMap.get(o.id)
    if (!existing || new Date(o.updatedAt) >= new Date(existing.updatedAt)) {
      orderMap.set(o.id, o)
    }
  }

  const historyMap = new Map<string, HistoryEntry>()
  for (const h of [...cloud.history, ...local.history]) {
    historyMap.set(h.id, h)
  }

  const history = Array.from(historyMap.values()).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )

  const cloudTime = new Date(cloud.updatedAt || 0).getTime()
  const localTime = new Date(local.updatedAt || 0).getTime()

  return {
    updatedAt: new Date(Math.max(cloudTime, localTime)).toISOString(),
    monthlyTarget:
      localTime >= cloudTime ? local.monthlyTarget : cloud.monthlyTarget,
    orders: Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
    history: history.slice(0, 1000),
  }
}
