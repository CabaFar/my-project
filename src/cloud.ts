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
    updatedAt: new Date(0).toISOString(),
    monthlyTarget: 0,
    orders: [],
    history: [],
    deletedIds: {},
  }
}

export function isStoreEmpty(store: CloudStore): boolean {
  return store.orders.length === 0 && store.history.length === 0
}

function storeRichness(store: CloudStore): number {
  return (
    store.orders.length * 1_000_000 +
    store.history.length * 100 +
    Object.keys(store.deletedIds || {}).length +
    (store.monthlyTarget > 0 ? 10 : 0)
  )
}

/**
 * Build a store timestamp from actual data changes — never "now",
 * so a quiet / empty device cannot overwrite richer cloud values.
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

/**
 * Prefer non-empty / richer stores. An empty blob with a fresh updatedAt
 * must never beat a store that still has orders (classic cross-device wipe).
 */
export function pickBestStore(a: CloudStore | null, b: CloudStore | null): CloudStore | null {
  if (!a) return b
  if (!b) return a

  const aEmpty = isStoreEmpty(a)
  const bEmpty = isStoreEmpty(b)
  if (aEmpty && !bEmpty) return b
  if (bEmpty && !aEmpty) return a

  const ra = storeRichness(a)
  const rb = storeRichness(b)
  const ta = new Date(revisionFromStore(a)).getTime()
  const tb = new Date(revisionFromStore(b)).getTime()

  // Same richness family: newer revision wins
  if (Math.abs(ra - rb) < 1_000_000) {
    if (ta !== tb) return ta >= tb ? a : b
    return ra >= rb ? a : b
  }

  // Much richer store wins even if slightly older (guards empty wipe + partial bins)
  return ra >= rb ? a : b
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
  const bins = Array.from(new Set([binId, DEFAULT_BIN_ID, BACKUP_BIN_ID]))
  const loaded = await Promise.all(bins.map((id) => loadFromExtendsClass(id)))
  let best: CloudStore | null = null
  for (const item of loaded) best = pickBestStore(best, item)

  // Always compare with GitHub backup — empty ExtendsClass must not hide real backup data
  const backup = await loadFromGitHubBackup()
  best = pickBestStore(best, backup)
  return best
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

/**
 * True when writing `next` would erase cloud orders that are not marked deleted.
 */
export function isDestructiveOverwrite(existing: CloudStore, next: CloudStore): boolean {
  if (isStoreEmpty(existing)) return false
  if (!isStoreEmpty(next) && next.orders.length >= existing.orders.length) return false

  const deleted = next.deletedIds || {}
  for (const order of existing.orders) {
    const stillPresent = next.orders.some((o) => o.id === order.id)
    if (stillPresent) continue
    const deletedAt = deleted[order.id]
    if (!deletedAt) return true
    // Delete only counts if it happened at/after the order's last update
    if (new Date(deletedAt).getTime() < new Date(order.updatedAt).getTime()) return true
  }
  return false
}

export async function saveCloudStore(
  store: CloudStore,
  opts?: { allowEmpty?: boolean },
): Promise<boolean> {
  const payload: CloudStore = {
    ...store,
    deletedIds: store.deletedIds || {},
    // Revision from data only — never stamp wall-clock "now" (that made empty wipes look newest)
    updatedAt: revisionFromStore(store),
  }

  // Safety net: refuse to wipe a richer cloud with an empty/sparse payload
  if (!opts?.allowEmpty) {
    const existing = await loadCloudStore()
    if (existing && isDestructiveOverwrite(existing, payload)) {
      console.warn('refusing destructive cloud overwrite', {
        existingOrders: existing.orders.length,
        nextOrders: payload.orders.length,
      })
      return false
    }
  }

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

  const cloudRev = revisionFromStore(cloud)
  const localRev = revisionFromStore(local)
  const cloudTime = new Date(cloudRev).getTime()
  const localTime = new Date(localRev).getTime()

  const mergedBase = {
    monthlyTarget: localTime > cloudTime ? local.monthlyTarget : cloud.monthlyTarget,
    orders,
    history,
    deletedIds,
  }

  const merged: CloudStore = {
    ...mergedBase,
    updatedAt: revisionFromStore(mergedBase),
  }
  return merged
}

export type SyncResult = { ok: boolean; store: CloudStore }

/**
 * Pull cloud → merge with local → push. Serialized so rapid edits don't race.
 * Never pushes an empty local when cloud could not be read (prevents wipe on new devices).
 */
export function syncWithCloud(local: CloudStore): Promise<SyncResult> {
  const run = async (): Promise<SyncResult> => {
    let latest: CloudStore = {
      ...local,
      updatedAt: revisionFromStore(local),
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      const cloud = await loadCloudStore()

      if (!cloud) {
        // Cloud unreachable: only push if this device actually has data
        if (isStoreEmpty(latest)) {
          return { ok: false, store: latest }
        }
        const ok = await saveCloudStore(latest)
        if (ok) return { ok: true, store: latest }
        await delay(500 * (attempt + 1))
        continue
      }

      const merged = mergeStores(latest, cloud)

      // Extra guard: never save a merge that destroys cloud content
      if (isDestructiveOverwrite(cloud, merged)) {
        latest = cloud
        return { ok: true, store: cloud }
      }

      latest = merged
      const ok = await saveCloudStore(merged)
      if (ok) {
        await delay(150)
        const verify = await loadCloudStore()
        if (verify) {
          const confirmed = mergeStores(merged, verify)
          if (merged.orders.length > 0 && verify.orders.length === 0) {
            await delay(300 * (attempt + 1))
            continue
          }
          // If verify is somehow empty but merged had data, keep merged locally
          if (isDestructiveOverwrite(merged, verify)) {
            return { ok: true, store: merged }
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
