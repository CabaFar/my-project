import type { HistoryEntry, Order } from './types'

export interface CloudStore {
  updatedAt: string
  monthlyTarget: number
  orders: Order[]
  history: HistoryEntry[]
  /** orderId -> ISO time when deleted (keeps deletes in sync across devices) */
  deletedIds: Record<string, string>
}

const POINTER_URL =
  'https://raw.githubusercontent.com/CabaFar/my-project/main/data/cloud-pointer.json'
const FALLBACK_STORE_URL =
  'https://raw.githubusercontent.com/CabaFar/my-project/main/data/sales-store.json'
const EXTENDS_BASE = 'https://extendsclass.com/api/json-storage/bin'

const LOCAL_BIN_KEY = 'riyadh-bank-cloud-bin-id'
const DEFAULT_BIN_ID = 'bcafcbb'

let cachedBinId: string | null = null
let syncChain: Promise<unknown> = Promise.resolve()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function normalizeDeletedIds(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof at === 'string' && at) out[id] = at
  }
  return out
}

export function normalizeStore(data: unknown): CloudStore | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Partial<CloudStore>
  if (!Array.isArray(raw.orders) || !Array.isArray(raw.history)) return null
  return {
    updatedAt: raw.updatedAt || new Date().toISOString(),
    monthlyTarget: Number(raw.monthlyTarget) || 0,
    orders: raw.orders,
    history: raw.history,
    deletedIds: normalizeDeletedIds(raw.deletedIds),
  }
}

export function emptyCloudStore(): CloudStore {
  return {
    updatedAt: new Date().toISOString(),
    monthlyTarget: 0,
    orders: [],
    history: [],
    deletedIds: {},
  }
}

async function resolveBinId(): Promise<string> {
  try {
    const res = await fetch(`${POINTER_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (res.ok) {
      const data = (await res.json()) as { binId?: string }
      if (data.binId) {
        cachedBinId = data.binId
        localStorage.setItem(LOCAL_BIN_KEY, data.binId)
        return data.binId
      }
    }
  } catch {
    // ignore
  }

  const local = localStorage.getItem(LOCAL_BIN_KEY)
  if (local) {
    cachedBinId = local
    return local
  }
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
    deletedIds: store.deletedIds || {},
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

function laterIso(a: string | undefined, b: string | undefined): string {
  const ta = a ? new Date(a).getTime() : 0
  const tb = b ? new Date(b).getTime() : 0
  return ta >= tb ? a || b || new Date().toISOString() : b || a || new Date().toISOString()
}

export function mergeStores(local: CloudStore, cloud: CloudStore): CloudStore {
  const deletedIds: Record<string, string> = { ...(cloud.deletedIds || {}) }
  for (const [id, at] of Object.entries(local.deletedIds || {})) {
    deletedIds[id] = laterIso(deletedIds[id], at)
  }

  const orderMap = new Map<string, Order>()
  for (const o of cloud.orders) orderMap.set(o.id, o)
  for (const o of local.orders) {
    const existing = orderMap.get(o.id)
    if (!existing || new Date(o.updatedAt) >= new Date(existing.updatedAt)) {
      orderMap.set(o.id, o)
    }
  }

  const orders = Array.from(orderMap.values())
    .filter((o) => {
      const deletedAt = deletedIds[o.id]
      if (!deletedAt) return true
      // Keep order only if it was updated after the delete (re-created / restored)
      return new Date(o.updatedAt).getTime() > new Date(deletedAt).getTime()
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const historyMap = new Map<string, HistoryEntry>()
  for (const h of [...cloud.history, ...local.history]) {
    historyMap.set(h.id, h)
  }
  const history = Array.from(historyMap.values())
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 1000)

  const cloudTime = new Date(cloud.updatedAt || 0).getTime()
  const localTime = new Date(local.updatedAt || 0).getTime()

  return {
    updatedAt: new Date(Math.max(cloudTime, localTime)).toISOString(),
    monthlyTarget:
      localTime >= cloudTime ? local.monthlyTarget : cloud.monthlyTarget,
    orders,
    history,
    deletedIds,
  }
}

export type SyncResult = { ok: boolean; store: CloudStore }

/**
 * Pull cloud → merge with local → push. Serialized so rapid edits don't race.
 * Retries a few times on failure.
 */
export function syncWithCloud(local: CloudStore): Promise<SyncResult> {
  const run = async (): Promise<SyncResult> => {
    let latest = local
    for (let attempt = 0; attempt < 3; attempt++) {
      const cloud = await loadCloudStore()
      const merged = cloud ? mergeStores(latest, cloud) : latest
      latest = merged
      const ok = await saveCloudStore(merged)
      if (ok) return { ok: true, store: { ...merged, updatedAt: new Date().toISOString() } }
      await delay(400 * (attempt + 1))
    }
    return { ok: false, store: latest }
  }

  const next = syncChain.then(run, run)
  syncChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}
