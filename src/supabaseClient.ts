import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig, type SupabaseConfig } from './supabaseConfig'

let client: SupabaseClient | null = null
let clientKey = ''

function configKey(config: SupabaseConfig): string {
  return `${config.url}::${config.anonKey.slice(0, 12)}`
}

export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig()
  if (!config) {
    client = null
    clientKey = ''
    return null
  }
  const key = configKey(config)
  if (!client || clientKey !== key) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: window.localStorage,
      },
      realtime: {
        params: { eventsPerSecond: 8 },
      },
    })
    clientKey = key
  }
  return client
}

export function resetSupabaseClient(): void {
  client = null
  clientKey = ''
}
