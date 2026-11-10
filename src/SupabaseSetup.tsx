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

type PanelProps = {
  onConfigured: () => void
}

/** لوحة ظاهرة داخل الصفحة للصق Project URL و anon key */
export function SupabaseBackupPanel({ onConfigured }: PanelProps) {
  const existing = getSupabaseConfig()
  const [url, setUrl] = useState(existing?.url || '')
  const [anonKey, setAnonKey] = useState(existing?.anonKey || '')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [configured, setConfigured] = useState(isSupabaseConfigured())
  const [showSql, setShowSql] = useState(false)
  const [editing, setEditing] = useState(!isSupabaseConfigured())

  useEffect(() => {
    void loadRuntimeSupabaseConfig().then(() => {
      const ready = isSupabaseConfigured()
      setConfigured(ready)
      setEditing(!ready)
      const cfg = getSupabaseConfig()
      if (cfg) {
        setUrl(cfg.url)
        setAnonKey(cfg.anonKey)
      }
    })
    return onSupabaseConfigChange(() => {
      const ready = isSupabaseConfigured()
      setConfigured(ready)
      if (ready) setEditing(false)
    })
  }, [])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const cfg = { url: url.trim(), anonKey: anonKey.trim() }
      saveSupabaseConfig(cfg)
      resetSupabaseClient()
      void publishSharedSupabaseConfig(cfg)
      setConfigured(true)
      setEditing(false)
      onConfigured()
    } catch {
      setError('تأكد من لصق Project URL و anon key بشكل صحيح ثم أعد المحاولة')
    }
  }

  function onClear() {
    clearStoredSupabaseConfig()
    resetSupabaseClient()
    setConfigured(false)
    setEditing(true)
    setUrl('')
    setAnonKey('')
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('تعذر النسخ — افتح مربع SQL وانسخ يدويًا')
      setShowSql(true)
    }
  }

  if (configured && !editing) {
    return (
      <section className="supabase-panel supabase-panel-ready" aria-label="نسخ احتياطي Supabase">
        <div className="supabase-panel-ready-row">
          <div>
            <h3>نسخ احتياطي Supabase مفعّل</h3>
            <p>أي تغيير يُحفظ تلقائيًا ويصل لبقية الأجهزة فورًا</p>
            <code className="supabase-url-chip" dir="ltr">
              {url || getSupabaseConfig()?.url || ''}
            </code>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
            تعديل المفاتيح
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="supabase-panel" aria-label="تفعيل نسخ احتياطي Supabase">
      <div className="supabase-panel-head">
        <div>
          <h3>تفعيل النسخ الاحتياطي في Supabase</h3>
          <p>
            الصق هنا <strong>Project URL</strong> و <strong>anon key</strong> ثم اضغط تفعيل —
            بعدها أي تغيير يُحفظ تلقائيًا على كل الأجهزة
          </p>
        </div>
        <a
          className="btn-ghost"
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
        >
          فتح Supabase
        </a>
      </div>

      <div className="supabase-panel-hint">
        <span>1) أنشئ مشروعًا مجانيًا</span>
        <span>2) شغّل أمر SQL مرة واحدة</span>
        <span>3) الصق المفتاحين بالأسفل وفعّل</span>
      </div>

      <div className="supabase-sql-actions">
        <button type="button" className="btn-ghost" onClick={() => void copySql()}>
          {copied ? 'تم نسخ أمر SQL' : 'نسخ أمر SQL Editor'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setShowSql((v) => !v)}>
          {showSql ? 'إخفاء الأمر' : 'عرض أمر SQL'}
        </button>
      </div>

      {showSql && (
        <textarea className="supabase-sql" readOnly value={SCHEMA_SQL} dir="ltr" rows={10} />
      )}

      <form className="supabase-form supabase-panel-form" onSubmit={onSave}>
        <label>
          الصق Project URL هنا
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label>
          الصق anon public key هنا
          <textarea
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOi..."
            dir="ltr"
            rows={3}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <div className="supabase-form-actions">
          <button type="submit" className="btn-primary">
            تفعيل النسخ الاحتياطي
          </button>
          {configured && (
            <button type="button" className="btn-ghost" onClick={onClear}>
              مسح الإعداد
            </button>
          )}
          {configured && (
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
              إلغاء
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

type ModalProps = {
  open: boolean
  onClose: () => void
  onConfigured: () => void
}

/** نافذة من زر الشريط العلوي — نفس حقول اللصق */
export default function SupabaseSetup({ open, onClose, onConfigured }: ModalProps) {
  if (!open) return null

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
              الصق Project URL و anon key ثم فعّل الحفظ التلقائي بين الأجهزة
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            إغلاق
          </button>
        </header>
        <SupabaseBackupPanel
          onConfigured={() => {
            onConfigured()
            onClose()
          }}
        />
      </div>
    </div>
  )
}
