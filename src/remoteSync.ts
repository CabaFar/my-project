import {
  isStoreEmpty,
  loadCloudStore as loadLegacyCloud,
  pickBestStore,
  syncWithCloud as syncLegacyCloud,
  type CloudStore,
  type SyncResult,
} from './cloud'
import { isSupabaseConfigured } from './supabaseConfig'
import {
  loadSupabaseStore,
  saveSupabaseStore,
  subscribeSupabaseStore,
  syncWithSupabase,
} from './supabaseSync'

export type { CloudStore, SyncResult }

/**
 * Load richest store from Supabase + ExtendsClass/GitHub.
 * If Supabase is empty but legacy has data, seed Supabase automatically.
 */
export async function loadRemoteStore(): Promise<CloudStore | null> {
  const legacy = await loadLegacyCloud()

  if (!isSupabaseConfigured()) {
    return legacy
  }

  const supabase = await loadSupabaseStore()
  const best = pickBestStore(supabase, legacy)

  // First-time seed: copy ExtendsClass/GitHub into Supabase so backups start immediately
  if (best && !isStoreEmpty(best) && (!supabase || isStoreEmpty(supabase))) {
    void saveSupabaseStore(best).catch((err) => {
      console.warn('supabase seed failed', err)
    })
  }

  return best
}

/**
 * Dual-write: Supabase (primary backup + realtime) + ExtendsClass (fallback).
 * Succeeds if at least one backend confirms the write.
 */
export async function syncRemoteStore(local: CloudStore): Promise<SyncResult> {
  const tasks: Promise<SyncResult>[] = []

  if (isSupabaseConfigured()) {
    tasks.push(syncWithSupabase(local))
  }
  tasks.push(syncLegacyCloud(local))

  const results = await Promise.all(tasks)
  let merged: CloudStore = {
    ...local,
    updatedAt: local.updatedAt,
  }
  let anyOk = false
  for (const result of results) {
    if (result.ok) anyOk = true
    merged = pickBestStore(merged, result.store) || merged
  }

  return { ok: anyOk, store: merged }
}

/** Instant updates when another device writes to Supabase. */
export function subscribeRemoteStore(
  onRemoteChange: (store: CloudStore) => void,
): () => void {
  if (!isSupabaseConfigured()) return () => undefined
  return subscribeSupabaseStore(onRemoteChange)
}

export function syncModeLabel(opts: {
  configured: boolean
  offline: boolean
}): string {
  if (opts.offline) return 'بدون إنترنت — محفوظ محليًا'
  if (opts.configured) return 'Supabase — نسخ احتياطي ومزامنة فورية'
  return 'مزامنة سحابية'
}
