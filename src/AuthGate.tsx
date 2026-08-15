import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, resetSupabaseClient } from './supabaseClient'
import {
  clearStoredSupabaseConfig,
  getSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseConfig,
  usernameToEmail,
} from './supabaseConfig'

type AuthMode = 'login' | 'signup' | 'config'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  offline: boolean
  signOut: () => Promise<void>
  useLegacySync: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  configured: false,
  offline: !navigator.onLine,
  signOut: async () => undefined,
  useLegacySync: true,
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState(() => isSupabaseConfigured())
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [legacyAllowed, setLegacyAllowed] = useState(() => {
    try {
      return localStorage.getItem('riyadh-allow-legacy-sync') === '1'
    } catch {
      return false
    }
  })
  const [mode, setMode] = useState<AuthMode>(() =>
    isSupabaseConfigured() ? 'login' : 'config',
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState(() => getSupabaseConfig()?.url || '')
  const [anonKey, setAnonKey] = useState(() => getSupabaseConfig()?.anonKey || '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      setSession(null)
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    let alive = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [configured])

  async function signOut() {
    const supabase = getSupabase()
    if (supabase) await supabase.auth.signOut()
    setSession(null)
  }

  async function onAuthSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = getSupabase()
    if (!supabase) {
      setError('أضف رابط ومفتاح Supabase أولًا')
      setMode('config')
      return
    }
    if (!username.trim() || password.length < 6) {
      setError('اسم المستخدم مطلوب وكلمة المرور 6 أحرف على الأقل')
      return
    }
    setBusy(true)
    const email = usernameToEmail(username)
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username.trim() } },
        })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (err) throw err
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر تسجيل الدخول'
      if (/Invalid login credentials/i.test(message)) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة')
      } else if (/already registered/i.test(message)) {
        setError('هذا الحساب موجود — جرّب تسجيل الدخول')
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  function onSaveConfig(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!url.trim() || !anonKey.trim()) {
      setError('أدخل رابط المشروع ومفتاح anon')
      return
    }
    if (!/^https:\/\/.+\.supabase\.co$/i.test(url.trim().replace(/\/+$/, ''))) {
      setError('الرابط يجب أن يكون مثل https://xxxx.supabase.co')
      return
    }
    saveSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() })
    resetSupabaseClient()
    setConfigured(true)
    setMode('login')
    try {
      localStorage.removeItem('riyadh-allow-legacy-sync')
    } catch {
      // ignore
    }
    setLegacyAllowed(false)
  }

  function continueLegacy() {
    try {
      localStorage.setItem('riyadh-allow-legacy-sync', '1')
    } catch {
      // ignore
    }
    setLegacyAllowed(true)
  }

  const readyForApp =
    (configured && Boolean(session)) || (!configured && legacyAllowed)

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    configured,
    offline,
    signOut,
    useLegacySync: !configured || (legacyAllowed && !session),
  }

  if (loading && configured) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="auth-loading">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    )
  }

  if (readyForApp) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  }

  return (
    <AuthContext.Provider value={value}>
      <div className="auth-shell">
        <div className="bg-glow" aria-hidden="true" />
        <div className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark" aria-hidden="true">
              <span>الرياض</span>
            </div>
            <h1>بنك الرياض</h1>
            <p>مزامنة فورية بدون إنترنت — مثل نظام المطعم</p>
          </div>

          {offline && (
            <div className="auth-offline">
              أنت غير متصل — يمكنك فتح اللوحة لاحقًا بعد تسجيل الدخول مرة واحدة
              (البيانات تُحفظ على الجهاز).
            </div>
          )}

          {mode === 'config' ? (
            <form className="auth-form" onSubmit={onSaveConfig}>
              <h2>إعداد قاعدة البيانات</h2>
              <p className="auth-hint">
                من Supabase → Settings → API انسخ Project URL و anon key. ثم شغّل ملف{' '}
                <code>supabase/schema.sql</code> من SQL Editor.
              </p>
              <label>
                رابط المشروع
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  dir="ltr"
                  autoComplete="url"
                />
              </label>
              <label>
                المفتاح العام (anon)
                <textarea
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  dir="ltr"
                  rows={3}
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="btn-primary auth-submit">
                حفظ والاتصال
              </button>
              <button type="button" className="btn-ghost auth-alt" onClick={continueLegacy}>
                متابعة بالمزامنة القديمة (بدون حساب)
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={onAuthSubmit}>
              <h2>{mode === 'signup' ? 'إنشاء حساب' : 'تسجيل الدخول'}</h2>
              <p className="auth-hint">
                نفس اليوزر وكلمة المرور على كل الأجهزة — التعديلات تتزامن تلقائيًا حتى لو
                أُدخلت من جهاز آخر.
              </p>
              <label>
                اسم المستخدم
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                كلمة المرور
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="btn-primary auth-submit" disabled={busy}>
                {busy
                  ? '...'
                  : mode === 'signup'
                    ? 'إنشاء الحساب'
                    : 'دخول'}
              </button>
              <button
                type="button"
                className="btn-ghost auth-alt"
                onClick={() => {
                  setError(null)
                  setMode(mode === 'signup' ? 'login' : 'signup')
                }}
              >
                {mode === 'signup' ? 'لدي حساب — تسجيل الدخول' : 'حساب جديد'}
              </button>
              <button
                type="button"
                className="btn-ghost auth-alt"
                onClick={() => {
                  setMode('config')
                  setError(null)
                }}
              >
                تغيير إعدادات Supabase
              </button>
              <button
                type="button"
                className="btn-ghost auth-alt"
                onClick={() => {
                  clearStoredSupabaseConfig()
                  resetSupabaseClient()
                  setConfigured(false)
                  setMode('config')
                }}
              >
                مسح الإعداد المحفوظ
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthContext.Provider>
  )
}
