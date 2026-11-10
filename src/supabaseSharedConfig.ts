import type { SupabaseConfig } from './supabaseConfig'
import { getStoredSupabaseConfig, saveSupabaseConfig } from './supabaseConfig'
import { resetSupabaseClient } from './supabaseClient'

/** Bin مشترك لنشر إعداد Supabase لكل الأجهزة بعد التفعيل مرة واحدة */
const SHARED_CONFIG_BIN_ID = 'abaaede'
const SHARED_CONFIG_BIN = `https://json.extendsclass.com/bin/${SHARED_CONFIG_BIN_ID}`
const SHARED_CONFIG_BIN_ALT = `https://extendsclass.com/api/json-storage/bin/${SHARED_CONFIG_BIN_ID}`
const SHARED_CONFIG_FALLBACK =
  'https://raw.githubusercontent.com/CabaFar/my-project/main/public/supabase-config.json'

type SharedPayload = {
  url?: string
  anonKey?: string
  updatedAt?: string
}

function asConfig(data: unknown): SupabaseConfig | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as SharedPayload
  const url = String(raw.url || '').trim()
  const anonKey = String(raw.anonKey || '').trim()
  if (!url || !anonKey || !/^https:\/\//i.test(url)) return null
  return { url: url.replace(/\/+$/, ''), anonKey }
}

/** سحب إعداد Supabase المشترك إن وُجد، وحفظه محليًا على الجهاز */
export async function pullSharedSupabaseConfig(): Promise<SupabaseConfig | null> {
  if (getStoredSupabaseConfig()) return getStoredSupabaseConfig()

  const sources = [SHARED_CONFIG_BIN, SHARED_CONFIG_BIN_ALT, SHARED_CONFIG_FALLBACK]
  for (const src of sources) {
    try {
      const res = await fetch(src, { cache: 'no-store', mode: 'cors' })
      if (!res.ok) continue
      const cfg = asConfig(await res.json())
      if (!cfg) continue
      saveSupabaseConfig(cfg)
      resetSupabaseClient()
      return cfg
    } catch {
      // try next
    }
  }
  return null
}

/** نشر الإعداد لكل الأجهزة بعد التفعيل من جهاز واحد */
export async function publishSharedSupabaseConfig(config: SupabaseConfig): Promise<boolean> {
  const body = JSON.stringify({
    url: config.url,
    anonKey: config.anonKey,
    updatedAt: new Date().toISOString(),
  })

  const attempts: Array<{ contentType: string }> = [
    { contentType: 'text/plain;charset=UTF-8' },
    { contentType: 'application/json' },
  ]

  const endpoints = [SHARED_CONFIG_BIN, SHARED_CONFIG_BIN_ALT]
  for (const endpoint of endpoints) {
    for (const attempt of attempts) {
      try {
        const res = await fetch(endpoint, {
          method: 'PUT',
          mode: 'cors',
          cache: 'no-store',
          headers: {
            'Content-Type': attempt.contentType,
            Accept: 'application/json',
          },
          body,
        })
        if (res.ok) return true
      } catch {
        // try next
      }
    }
  }
  return false
}
