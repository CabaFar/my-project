import { useEffect, useState, type FormEvent } from 'react'
import {
  clearStoredSupabaseConfig,
  getSupabaseConfig,
  isSupabaseConfigured,
  loadRuntimeSupabaseConfig,
  onSupabaseConfigChange,
  saveSupabaseConfig,
} from './supabaseConfig'
import { resetSupabaseClient } from './supabaseClient'
import { publishSharedSupabaseConfig } from './supabaseSharedConfig'
import { SCHEMA_SQL } from './supabaseSchemaText'

type Props = {
  open: boolean
  onClose: () => void
  onConfigured: () => void
}

export default function SupabaseSetup({ open, onClose, onConfigured }: Props) {
  const existing = getSupabaseConfig()
  const [url, setUrl] = useState(existing?.url || '')
  const [anonKey, setAnonKey] = useState(existing?.anonKey || '')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [configured, setConfigured] = useState(isSupabaseConfigured())

  useEffect(() => {
    void loadRuntimeSupabaseConfig().then(() => {
      setConfigured(isSupabaseConfigured())
      const cfg = getSupabaseConfig()
      if (cfg) {
        setUrl(cfg.url)
        setAnonKey(cfg.anonKey)
      }
    })
    return onSupabaseConfigChange(() => setConfigured(isSupabaseConfigured()))
  }, [])

  if (!open) return null

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const cfg = { url, anonKey }
      saveSupabaseConfig(cfg)
      resetSupabaseClient()
      // انشر الإعداد لبقية الأجهزة تلقائيًا
      void publishSharedSupabaseConfig(cfg)
      setConfigured(true)
      onConfigured()
      onClose()
    } catch {
      setError('تأكد من رابط المشروع ومفتاح anon ثم أعد المحاولة')
    }
  }

  function onClear() {
    clearStoredSupabaseConfig()
    resetSupabaseClient()
    setConfigured(false)
    setUrl('')
    setAnonKey('')
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('تعذر النسخ — انسخ النص يدويًا من المربع')
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supabase-setup-title"
      onClick={onClose}
    >
      <div className="modal supabase-setup" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2 id="supabase-setup-title">نسخ احتياطي Supabase</h2>
            <p className="supabase-lead">
              حفظ تلقائي على السحابة ومزامنة فورية بين كل الأجهزة عند أي تغيير
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            إغلاق
          </button>
        </header>

        <div className="supabase-setup-body">
          <ol className="supabase-steps">
            <li>
              أنشئ مشروعًا مجانيًا من{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                supabase.com
              </a>
            </li>
            <li>
              من SQL Editor الصق الأمر التالي واضغط Run
              <div className="supabase-sql-actions">
                <button type="button" className="btn-ghost" onClick={() => void copySql()}>
                  {copied ? 'تم النسخ' : 'نسخ أمر SQL'}
                </button>
              </div>
              <textarea className="supabase-sql" readOnly value={SCHEMA_SQL} dir="ltr" rows={8} />
            </li>
            <li>
              من Project Settings → API انسخ Project URL و anon public key وألصقهما هنا
            </li>
          </ol>

          <form className="supabase-form" onSubmit={onSave}>
            <label>
              Project URL
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxxx.supabase.co"
                dir="ltr"
                required
              />
            </label>
            <label>
              anon public key
              <textarea
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOi..."
                dir="ltr"
                rows={3}
                required
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <div className="supabase-form-actions">
              <button type="submit" className="btn-primary">
                {configured ? 'تحديث الإعداد والحفظ' : 'تفعيل النسخ الاحتياطي'}
              </button>
              {configured && (
                <button type="button" className="btn-ghost" onClick={onClear}>
                  إيقاف الإعداد المحلي
                </button>
              )}
            </div>
          </form>

          <p className="supabase-note">
            بعد التفعيل: أي إضافة أو تعديل أو حذف يُحفظ تلقائيًا في Supabase ويظهر فورًا على بقية
            الأجهزة. المزامنة الحالية تبقى تعمل كنسخة احتياطية ثانية.
          </p>
        </div>
      </div>
    </div>
  )
}
