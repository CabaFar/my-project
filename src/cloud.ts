import type { HistoryEntry, Order } from './types'

export interface CloudStore {
  updatedAt: string
  monthlyTarget: number
  orders: Order[]
  history: HistoryEntry[]
}

const POINTER_URL =
  'https://raw.githubusercontent.com/CabaFar/my-project/main/data/cloud-pointer.json'
const BLOB_BASE = 'https://jsonblob.com/api/jsonBlob'
const FALLBACK_STORE_URL =
  'https://raw.githubusercontent.com/CabaFar/my-project/main/data/sales-store.json'

let cachedBlobId: string | null = null

export function getLocalBlobOverride(): string | null {
  return localStorage.getItem('riyadh-bank-cloud-blob-id')
}

export function applyLocalBlobOverride(): void {
  const local = getLocalBlobOverride()
  if (local) cachedBlobId = local
}

async function resolveBlobId(): Promise<string | null> {
  // Prefer the shared GitHub pointer so all devices use the same blob
  try {
    const res = await fetch(`${POINTER_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (res.ok) {
      const data = (await res.json()) as { blobId?: string }
      if (data.blobId) {
        cachedBlobId = data.blobId
        localStorage.setItem('riyadh-bank-cloud-blob-id', data.blobId)
        return data.blobId
      }
    }
  } catch {
    // ignore
  }

  applyLocalBlobOverride()
  return cachedBlobId
}

export async function loadCloudStore(): Promise<CloudStore | null> {
  const blobId = await resolveBlobId()
  if (blobId) {
    try {
      const res = await fetch(`${BLOB_BASE}/${blobId}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = (await res.json()) as CloudStore
        if (data && Array.isArray(data.orders) && Array.isArray(data.history)) {
          return {
            updatedAt: data.updatedAt || new Date().toISOString(),
            monthlyTarget: Number(data.monthlyTarget) || 0,
            orders: data.orders,
            history: data.history,
          }
        }
      }
    } catch {
      // fall through to GitHub backup
    }
  }

  try {
    const res = await fetch(`${FALLBACK_STORE_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as CloudStore
    if (data && Array.isArray(data.orders) && Array.isArray(data.history)) {
      return {
        updatedAt: data.updatedAt || new Date().toISOString(),
        monthlyTarget: Number(data.monthlyTarget) || 0,
        orders: data.orders,
        history: data.history,
      }
    }
  } catch {
    // ignore
  }
  return null
}

export async function saveCloudStore(store: CloudStore): Promise<boolean> {
  const payload: CloudStore = {
    ...store,
    updatedAt: new Date().toISOString(),
  }

  const blobId = await resolveBlobId()
  if (!blobId) return false

  try {
    const res = await fetch(`${BLOB_BASE}/${blobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return res.ok
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
