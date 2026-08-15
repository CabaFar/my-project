import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  BUILTIN_ACCOUNTS,
  PRIMARY_ACCOUNT,
  clearBuiltinSession,
  findAccount,
  loadBuiltinSession,
  saveBuiltinSession,
  type BuiltinSession,
} from './builtinAuth'
import { isSupabaseConfigured } from './supabaseConfig'

type AuthContextValue = {
  /** جلسة الدخول الجاهزة */
  session: BuiltinSession | null
  username: string | null
  loading: boolean
  /** هل Supabase مُعدّ (اختياري متقدم) */
  configured: boolean
  offline: boolean
  signOut: () => Promise<void>
  useLegacySync: boolean
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  username: null,
  loading: true,
  configured: false,
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  signOut: async () => undefined,
  useLegacySync: true,
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BuiltinSession | null>(() => loadBuiltinSession())
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [username, setUsername] = useState(PRIMARY_ACCOUNT.username)
  const [password, setPassword] = useState(PRIMARY_ACCOUNT.password)
  const [error, setError] = useState<string | null>(null)
  const configured = isSupabaseConfigured()

  useEffect(() => {
    setSession(loadBuiltinSession())
    setLoading(false)
  }, [])

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

  async function signOut() {
    clearBuiltinSession()
    setSession(null)
  }

  function onLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const account = findAccount(username, password)
    if (!account) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة')
      return
    }
    setSession(saveBuiltinSession(account))
  }

  const value: AuthContextValue = {
    session,
    username: session?.username ?? null,
    loading,
    configured,
    offline,
    signOut,
    useLegacySync: !configured,
  }

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="auth-loading">جاري التجهيز...</p>
        </div>
      </div>
    )
  }

  if (session) {
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
            <p>لوحة المبيعات — دخول جاهز ومزامنة بين كل الأجهزة</p>
          </div>

          {offline && (
            <div className="auth-offline">
              بدون إنترنت الآن — بعد الدخول تُحفظ البيانات على الجهاز وتُزامَن عند الاتصال.
            </div>
          )}

          <div className="auth-credentials">
            <h2>بيانات الدخول الجاهزة</h2>
            <p>استخدم أحد الحسابات التالية على أي جهاز:</p>
            <ul>
              {BUILTIN_ACCOUNTS.map((a) => (
                <li key={a.username}>
                  <strong>{a.displayName}</strong>
                  <span dir="ltr">
                    {a.username} / {a.password}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <form className="auth-form" onSubmit={onLogin}>
            <label>
              اسم المستخدم
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                dir="ltr"
              />
            </label>
            <label>
              كلمة المرور
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                dir="ltr"
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn-primary auth-submit">
              دخول
            </button>
            <button
              type="button"
              className="btn-ghost auth-alt"
              onClick={() => {
                setUsername(PRIMARY_ACCOUNT.username)
                setPassword(PRIMARY_ACCOUNT.password)
                setError(null)
              }}
            >
              تعبئة الحساب الرئيسي تلقائيًا
            </button>
          </form>
        </div>
      </div>
    </AuthContext.Provider>
  )
}
