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
/** Primary shared bin */
const DEFAULT_BIN_ID = 'bcafcbb'
/** Secondary bin — dual-write so one CDN glitch does not lose sync */
const BACKUP_BIN_ID = 'eaaaadb'

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

/**
 * Build a store timestamp from actual data changes — never "now",
 * so a quiet device cannot overwrite newer cloud values on merge.
 */
export function revisionFromStore(store: Omit<CloudStore, 'updatedAt'> & { updatedAt?: string }): string {
  const times: number[] = []
  if (store.updatedAt) times.push(new Date(store.updatedAt).getTime())
  for (const o of store.orders) times.push(new Date(o.updatedAt).getTime())
  for (const h of store.history) times.push(new Date(h.at).getTime())
  for (const at of Object.values(store.deletedIds || {})) times.push(new Date(at).getTime())
  const max = times.filter((t) => Number.isFinite(t) && t > 0)
  if (!max.length) return new Date(0).toISOString()
  return new Date(Math.max(...max)).toISOString()
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

function pickNewest(a: CloudStore | null, b: CloudStore | null): CloudStore | null {
  if (!a) return b
  if (!b) return a
  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b
}

export async function loadCloudStore(): Promise<CloudStore | null> {
  const binId = await resolveBinId()
  const bins = Array.from(new Set([binId, DEFAULT_BIN_ID, BACKUP_BIN_ID]))
  const loaded = await Promise.all(bins.map((id) => loadFromExtendsClass(id)))
  let best: CloudStore | null = null
  for (const item of loaded) best = pickNewest(best, item)
  if (best) return best
  return loadFromGitHubBackup()
}

/**
 * PUT with text/plain avoids browser CORS preflight.
 * ExtendsClass OPTIONS often returns 500, which blocks application/json PUTs.
 */
async function putExtendsClass(binId: string, payload: CloudStore): Promise<boolean> {
  const body = JSON.stringify(payload)
  const attempts: Array<{ contentType: string; parseJson: boolean }> = [
    { contentType: 'text/plain;charset=UTF-8', parseJson: true },
    { contentType: 'text/plain', parseJson: true },
    { contentType: 'application/json', parseJson: true },
  ]

  for (const attempt of attempts) {
    try {
      const res = await fetch(`${EXTENDS_BASE}/${binId}`, {
        method: 'PUT',
        mode: 'cors',
        cache: 'no-store',
        headers: {
          'Content-Type': attempt.contentType,
          Accept: 'application/json',
        },
        body,
      })
      if (!res.ok) continue
      if (attempt.parseJson) {
        try {
          const data = (await res.json()) as { status?: number }
          if (typeof data.status === 'number' && data.status !== 0) continue
        } catch {
          // empty body ok
        }
      }
      return true
    } catch {
      // try next content-type
    }
  }
  return false
}

export async function saveCloudStore(store: CloudStore): Promise<boolean> {
  const payload: CloudStore = {
    ...store,
    deletedIds: store.deletedIds || {},
    updatedAt: store.updatedAt || new Date().toISOString(),
  }
  // Always stamp a fresh write time so other devices see this revision as newest
  payload.updatedAt = new Date().toISOString()

  const binId = await resolveBinId()
  const targets = Array.from(new Set([binId, DEFAULT_BIN_ID, BACKUP_BIN_ID]))
  const results = await Promise.all(targets.map((id) => putExtendsClass(id, payload)))
  const ok = results.some(Boolean)
  if (ok) localStorage.setItem(LOCAL_BIN_KEY, binId)
  return ok
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

  const merged: CloudStore = {
    updatedAt: new Date(Math.max(cloudTime, localTime, Date.now())).toISOString(),
    monthlyTarget:
      localTime > cloudTime ? local.monthlyTarget : cloud.monthlyTarget,
    orders,
    history,
    deletedIds,
  }
  return merged
}

export type SyncResult = { ok: boolean; store: CloudStore }

/**
 * Pull cloud → merge with local → push. Serialized so rapid edits don't race.
 * Retries a few times on failure.
 */
export function syncWithCloud(local: CloudStore): Promise<SyncResult> {
  const run = async (): Promise<SyncResult> => {
    // Normalize local revision so we don't pretend "now" is a data change
    let latest: CloudStore = {
      ...local,
      updatedAt: revisionFromStore(local),
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const cloud = await loadCloudStore()
      const merged = cloud ? mergeStores(latest, cloud) : latest
      latest = merged
      const ok = await saveCloudStore(merged)
      if (ok) {
        // Verify write is readable (guards against CDN lying / silent fail)
        await delay(150)
        const verify = await loadCloudStore()
        if (verify) {
          const confirmed = mergeStores(merged, verify)
          // If cloud lost our orders, retry
          if (merged.orders.length > 0 && verify.orders.length === 0) {
            await delay(300 * (attempt + 1))
            continue
          }
          return { ok: true, store: confirmed }
        }
        return { ok: true, store: merged }
      }
      await delay(500 * (attempt + 1))
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
