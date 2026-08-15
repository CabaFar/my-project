const URL_KEY = 'riyadh-supabase-url'
const ANON_KEY = 'riyadh-supabase-anon-key'

export type SupabaseConfig = {
  url: string
  anonKey: string
}

function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function getEnvSupabaseConfig(): SupabaseConfig | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !anonKey) return null
  return { url: trimSlash(url), anonKey }
}

export function getStoredSupabaseConfig(): SupabaseConfig | null {
  try {
    const url = localStorage.getItem(URL_KEY)?.trim() || ''
    const anonKey = localStorage.getItem(ANON_KEY)?.trim() || ''
    if (!url || !anonKey) return null
    return { url: trimSlash(url), anonKey }
  } catch {
    return null
  }
}

export function getSupabaseConfig(): SupabaseConfig | null {
  return getEnvSupabaseConfig() || getStoredSupabaseConfig()
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseConfig())
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(URL_KEY, trimSlash(config.url))
  localStorage.setItem(ANON_KEY, config.anonKey.trim())
}

export function clearStoredSupabaseConfig(): void {
  localStorage.removeItem(URL_KEY)
  localStorage.removeItem(ANON_KEY)
}

/** Username → email for Supabase Auth (no real mailbox needed if confirm is OFF). */
export function usernameToEmail(username: string): string {
  const raw = username.trim().toLowerCase()
  if (raw.includes('@')) return raw
  const safe = raw.replace(/[^a-z0-9._-]/g, '') || 'user'
  return `${safe}@riyadh-sales.app`
}
