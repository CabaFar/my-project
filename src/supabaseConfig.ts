const URL_KEY = 'riyadh-supabase-url'
const ANON_KEY = 'riyadh-supabase-anon-key'
const CONFIG_READY_EVENT = 'riyadh-supabase-config'

export type SupabaseConfig = {
  url: string
  anonKey: string
}

declare const __RIYADH_SUPABASE_URL__: string | undefined
declare const __RIYADH_SUPABASE_ANON_KEY__: string | undefined

function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function validConfig(url: string, anonKey: string): SupabaseConfig | null {
  const cleanUrl = trimSlash(url)
  const cleanKey = anonKey.trim()
  if (!cleanUrl || !cleanKey) return null
  if (!/^https:\/\//i.test(cleanUrl)) return null
  return { url: cleanUrl, anonKey: cleanKey }
}

export function getBuildSupabaseConfig(): SupabaseConfig | null {
  try {
    const url = String(__RIYADH_SUPABASE_URL__ || '').trim()
    const anonKey = String(__RIYADH_SUPABASE_ANON_KEY__ || '').trim()
    return validConfig(url, anonKey)
  } catch {
    return null
  }
}

export function getEnvSupabaseConfig(): SupabaseConfig | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  return validConfig(url, anonKey)
}

export function getStoredSupabaseConfig(): SupabaseConfig | null {
  try {
    const url = localStorage.getItem(URL_KEY)?.trim() || ''
    const anonKey = localStorage.getItem(ANON_KEY)?.trim() || ''
    return validConfig(url, anonKey)
  } catch {
    return null
  }
}

let runtimeFileConfig: SupabaseConfig | null = null
let runtimeFileLoaded = false

/** Config from public/supabase-config.json (optional, loaded once). */
export function getRuntimeFileSupabaseConfig(): SupabaseConfig | null {
  return runtimeFileConfig
}

export async function loadRuntimeSupabaseConfig(): Promise<SupabaseConfig | null> {
  if (runtimeFileLoaded) return runtimeFileConfig
  runtimeFileLoaded = true
  try {
    const base = import.meta.env.BASE_URL || '/'
    const res = await fetch(`${base}supabase-config.json`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string; anonKey?: string }
    runtimeFileConfig = validConfig(String(data.url || ''), String(data.anonKey || ''))
    if (runtimeFileConfig) notifyConfigChanged()
    return runtimeFileConfig
  } catch {
    return null
  }
}

export function getSupabaseConfig(): SupabaseConfig | null {
  return (
    getBuildSupabaseConfig() ||
    getEnvSupabaseConfig() ||
    getRuntimeFileSupabaseConfig() ||
    getStoredSupabaseConfig()
  )
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseConfig())
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  const clean = validConfig(config.url, config.anonKey)
  if (!clean) throw new Error('invalid supabase config')
  localStorage.setItem(URL_KEY, clean.url)
  localStorage.setItem(ANON_KEY, clean.anonKey)
  notifyConfigChanged()
}

export function clearStoredSupabaseConfig(): void {
  localStorage.removeItem(URL_KEY)
  localStorage.removeItem(ANON_KEY)
  notifyConfigChanged()
}

function notifyConfigChanged() {
  try {
    window.dispatchEvent(new Event(CONFIG_READY_EVENT))
  } catch {
    // ignore
  }
}

export function onSupabaseConfigChange(cb: () => void): () => void {
  const handler = () => cb()
  window.addEventListener(CONFIG_READY_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(CONFIG_READY_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export { CONFIG_READY_EVENT }
