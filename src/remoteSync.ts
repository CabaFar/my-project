import {
  loadCloudStore as loadLegacyCloud,
  syncWithCloud as syncLegacyCloud,
  type CloudStore,
  type SyncResult,
} from './cloud'
import { isSupabaseConfigured } from './supabaseConfig'
import { getSupabase } from './supabaseClient'
import {
  loadSupabaseStore,
  subscribeSupabaseStore,
  syncWithSupabase,
} from './supabaseSync'

export type { CloudStore, SyncResult }

/** Prefer Supabase when configured + signed in; otherwise ExtendsClass legacy. */
export async function loadRemoteStore(): Promise<CloudStore | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
    if (data.session) {
      const store = await loadSupabaseStore()
      if (store) return store
    }
  }
  return loadLegacyCloud()
}

export function syncRemoteStore(local: CloudStore): Promise<SyncResult> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()
    // Fire-and-check session synchronously via cached client is awkward;
    // try Supabase first when client exists — syncWithSupabase no-ops poorly without auth.
    if (supabase) {
      return supabase.auth.getSession().then(({ data }) => {
        if (data.session) return syncWithSupabase(local)
        return syncLegacyCloud(local)
      })
    }
  }
  return syncLegacyCloud(local)
}

export function subscribeRemoteStore(
  onRemoteChange: (store: CloudStore) => void,
): () => void {
  if (!isSupabaseConfigured()) return () => undefined
  return subscribeSupabaseStore(onRemoteChange)
}

export function syncModeLabel(opts: {
  configured: boolean
  signedIn: boolean
  offline: boolean
}): string {
  if (opts.offline) return 'بدون إنترنت — محفوظ محليًا'
  if (opts.configured && opts.signedIn) return 'Supabase — مزامنة فورية'
  return 'مزامنة سحابية'
}
