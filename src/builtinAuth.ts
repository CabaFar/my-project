/** حسابات جاهزة — لا يحتاج المستخدم إنشاء شيء */

export type BuiltinAccount = {
  username: string
  password: string
  displayName: string
}

export const BUILTIN_ACCOUNTS: BuiltinAccount[] = [
  {
    username: 'riyadh',
    password: 'Riyadh123',
    displayName: 'مبيعات بنك الرياض',
  },
  {
    username: 'sales',
    password: 'Sales123',
    displayName: 'موظف المبيعات',
  },
]

/** الحساب الأساسي المعروض للمستخدم */
export const PRIMARY_ACCOUNT = BUILTIN_ACCOUNTS[0]

const SESSION_KEY = 'riyadh-builtin-session'

export type BuiltinSession = {
  username: string
  displayName: string
  at: string
}

export function findAccount(username: string, password: string): BuiltinAccount | null {
  const u = username.trim().toLowerCase()
  return (
    BUILTIN_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === u && a.password === password,
    ) || null
  )
}

export function loadBuiltinSession(): BuiltinSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BuiltinSession
    if (!parsed?.username) return null
    const known = BUILTIN_ACCOUNTS.some(
      (a) => a.username.toLowerCase() === parsed.username.toLowerCase(),
    )
    return known ? parsed : null
  } catch {
    return null
  }
}

export function saveBuiltinSession(account: BuiltinAccount): BuiltinSession {
  const session: BuiltinSession = {
    username: account.username,
    displayName: account.displayName,
    at: new Date().toISOString(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearBuiltinSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
