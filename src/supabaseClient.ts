import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig, type SupabaseConfig } from './supabaseConfig'

let client: SupabaseClient | null = null
let clientKey = ''

function configKey(config: SupabaseConfig): string {
  return `${config.url}::${config.anonKey.slice(0, 16)}`
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
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
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
