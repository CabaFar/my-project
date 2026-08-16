import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  emptyCloudStore,
  mergeStores,
  normalizeStore,
  revisionFromStore,
  type CloudStore,
} from './cloud'
import type { HistoryEntry, Order } from './types'
import { getSupabase } from './supabaseClient'

type OrderRow = {
  id: string
  payload: Order | Record<string, unknown>
  updated_at: string
  deleted: boolean
}

type HistoryRow = {
  id: string
  payload: HistoryEntry | Record<string, unknown>
  updated_at: string
  deleted: boolean
}

type MetaRow = {
  key: string
  value: unknown
  updated_at: string
}

let syncChain: Promise<unknown> = Promise.resolve()
let realtimeChannel: RealtimeChannel | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function asOrder(payload: unknown, id: string, updatedAt: string): Order | null {
  if (!payload || typeof payload !== 'object') return null
  const raw = payload as Partial<Order>
  if (!raw.orderNumber && !raw.customerName) return null
  return {
    id: raw.id || id,
    orderNumber: String(raw.orderNumber || ''),
    customerName: String(raw.customerName || ''),
    showroom: String(raw.showroom || ''),
    financeAmount: Number(raw.financeAmount) || 0,
    commission: Number(raw.commission) || 0,
    stage: (raw.stage as Order['stage']) || '0',
    replied: Boolean(raw.replied),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    createdAt: raw.createdAt || updatedAt,
    updatedAt: raw.updatedAt || updatedAt,
  }
}

function asHistory(payload: unknown, id: string, updatedAt: string): HistoryEntry | null {
  if (!payload || typeof payload !== 'object') return null
  const raw = payload as Partial<HistoryEntry>
  if (!raw.detail && !raw.action) return null
  return {
    id: raw.id || id,
    at: raw.at || updatedAt,
    action: (raw.action as HistoryEntry['action']) || 'update',
    orderId: raw.orderId,
    orderNumber: raw.orderNumber,
    customerName: raw.customerName,
    fromStage: raw.fromStage ?? null,
    toStage: raw.toStage ?? null,
    detail: String(raw.detail || ''),
  }
}

export async function loadSupabaseStore(): Promise<CloudStore | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    const [ordersRes, historyRes, metaRes] = await Promise.all([
      supabase.from('sales_orders').select('id,payload,updated_at,deleted'),
      supabase.from('sales_history').select('id,payload,updated_at,deleted'),
      supabase.from('sales_meta').select('key,value,updated_at'),
    ])

    if (ordersRes.error || historyRes.error || metaRes.error) {
      console.warn('supabase load error', ordersRes.error || historyRes.error || metaRes.error)
      return null
    }

    const deletedIds: Record<string, string> = {}
    const orders: Order[] = []
    for (const row of (ordersRes.data || []) as OrderRow[]) {
      if (row.deleted) {
        deletedIds[row.id] = row.updated_at
        continue
      }
      const order = asOrder(row.payload, row.id, row.updated_at)
      if (order) orders.push(order)
    }

    const history: HistoryEntry[] = []
    for (const row of (historyRes.data || []) as HistoryRow[]) {
      if (row.deleted) continue
      const entry = asHistory(row.payload, row.id, row.updated_at)
      if (entry) history.push(entry)
    }

    let monthlyTarget = 0
    let metaUpdated = new Date(0).toISOString()
    for (const row of (metaRes.data || []) as MetaRow[]) {
      if (new Date(row.updated_at).getTime() > new Date(metaUpdated).getTime()) {
        metaUpdated = row.updated_at
      }
      if (row.key === 'monthlyTarget') {
        monthlyTarget = Number(row.value) || 0
      }
      if (row.key === 'deletedIds' && row.value && typeof row.value === 'object') {
        for (const [id, at] of Object.entries(row.value as Record<string, unknown>)) {
          if (typeof at === 'string' && at) {
            const prev = deletedIds[id]
            deletedIds[id] =
              !prev || new Date(at).getTime() >= new Date(prev).getTime() ? at : prev
          }
        }
      }
    }

    const store: CloudStore = {
      updatedAt: revisionFromStore({
        monthlyTarget,
        orders,
        history,
        deletedIds,
        updatedAt: metaUpdated,
      }),
      monthlyTarget,
      orders,
      history,
      deletedIds,
    }
    return normalizeStore(store)
  } catch (err) {
    console.warn('supabase load failed', err)
    return null
  }
}

async function upsertChunks(
  table: 'sales_orders' | 'sales_history' | 'sales_meta',
  rows: Record<string, unknown>[],
): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  if (!rows.length) return true

  const conflict = table === 'sales_meta' ? 'key' : 'id'
  const size = 80
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await supabase.from(table).upsert(chunk as never, { onConflict: conflict })
    if (error) {
      console.warn(`supabase upsert ${table} error`, error)
      return false
    }
  }
  return true
}

export async function saveSupabaseStore(store: CloudStore): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false

  const payload: CloudStore = {
    ...store,
    deletedIds: store.deletedIds || {},
    updatedAt: store.updatedAt || new Date().toISOString(),
  }

  const orderRows = payload.orders.map((o) => ({
    id: o.id,
    payload: o,
    updated_at: o.updatedAt,
    deleted: false,
  }))

  const deletedRows = Object.entries(payload.deletedIds).map(([id, at]) => ({
    id,
    payload: { id },
    updated_at: at,
    deleted: true,
  }))

  const historyRows = payload.history.map((h) => ({
    id: h.id,
    payload: h,
    updated_at: h.at,
    deleted: false,
  }))

  const now = new Date().toISOString()
  const metaRows = [
    {
      key: 'monthlyTarget',
      value: payload.monthlyTarget,
      updated_at: payload.updatedAt || now,
    },
    {
      key: 'deletedIds',
      value: payload.deletedIds,
      updated_at: payload.updatedAt || now,
    },
    {
      key: 'revision',
      value: payload.updatedAt || now,
      updated_at: payload.updatedAt || now,
    },
  ]

  const okOrders = await upsertChunks('sales_orders', [...orderRows, ...deletedRows])
  const okHistory = await upsertChunks('sales_history', historyRows)
  const okMeta = await upsertChunks('sales_meta', metaRows)
  return okOrders && okHistory && okMeta
}

export type SyncResult = { ok: boolean; store: CloudStore }

/**
 * Offline-first: local is always kept; when online we pull → merge → push.
 */
export function syncWithSupabase(local: CloudStore): Promise<SyncResult> {
  const run = async (): Promise<SyncResult> => {
    let latest: CloudStore = {
      ...local,
      updatedAt: revisionFromStore(local),
    }

    if (!navigator.onLine) {
      return { ok: false, store: latest }
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      const cloud = await loadSupabaseStore()
      const merged = cloud ? mergeStores(latest, cloud) : latest
      latest = merged
      const ok = await saveSupabaseStore(merged)
      if (ok) {
        await delay(120)
        const verify = await loadSupabaseStore()
        if (verify) {
          const confirmed = mergeStores(merged, verify)
          if (merged.orders.length > 0 && verify.orders.length === 0) {
            await delay(250 * (attempt + 1))
            continue
          }
          return { ok: true, store: confirmed }
        }
        return { ok: true, store: merged }
      }
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

export function subscribeSupabaseStore(
  onRemoteChange: (store: CloudStore) => void,
): () => void {
  const supabase = getSupabase()
  if (!supabase) return () => undefined

  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  let timer: number | null = null
  const schedulePull = () => {
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(async () => {
      const store = await loadSupabaseStore()
      if (store) onRemoteChange(store)
    }, 250)
  }

  realtimeChannel = supabase
    .channel('riyadh-sales-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales_orders' },
      schedulePull,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales_history' },
      schedulePull,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales_meta' },
      schedulePull,
    )
    .subscribe()

  return () => {
    if (timer != null) window.clearTimeout(timer)
    if (realtimeChannel) {
      void supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }
}

export function emptyLocalFriendlyStore(): CloudStore {
  return emptyCloudStore()
}
