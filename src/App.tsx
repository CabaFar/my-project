import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { STAGES } from './stages'
import {
  downloadBackupToDisk,
  loadHistory,
  loadMonthlyTarget,
  loadOrders,
  saveHistory,
  saveMonthlyTarget,
  saveOrders,
} from './storage'
import { loadCloudStore, mergeStores, saveCloudStore, type CloudStore } from './cloud'
import type { DateFilter, HistoryEntry, Order, StageId } from './types'
import './App.css'

const TARGET_STAGES: StageId[] = ['77', '118', '120']

const EMPTY_FORM = {
  orderNumber: '',
  customerName: '',
  showroom: '',
  financeAmount: '',
  commission: '',
  stage: '04' as StageId,
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value)
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  // Saturday as start of week (common in KSA)
  const diff = (day + 1) % 7
  x.setDate(x.getDate() - diff)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function matchesDateFilter(createdAt: string, filter: DateFilter): boolean {
  if (filter === 'all') return true
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return false
  const now = new Date()
  if (filter === 'today') return created >= startOfDay(now)
  if (filter === 'week') return created >= startOfWeek(now)
  if (filter === 'month') return created >= startOfMonth(now)
  return true
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function IconMoney({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconBox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 8l9 5 9-5M12 13v8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function IconToday({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" />
    </svg>
  )
}

function IconWeek({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 14h8M8 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconMonth({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 14h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 17h2v2H7v-2zm4 0h2v2h-2v-2z" fill="currentColor" />
    </svg>
  )
}

function IconAll({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

const STAGE_ICONS: Record<StageId, (props: { className?: string }) => ReactNode> = {
  '04': (p) => <IconCheck {...p} />,
  '77': (p) => <IconFile {...p} />,
  '118': (p) => <IconMoney {...p} />,
  '120': (p) => <IconBox {...p} />,
}

const DATE_FILTERS: { id: DateFilter; label: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { id: 'today', label: 'اليوم', icon: (p) => <IconToday {...p} /> },
  { id: 'week', label: 'هذا الأسبوع', icon: (p) => <IconWeek {...p} /> },
  { id: 'month', label: 'هذا الشهر', icon: (p) => <IconMonth {...p} /> },
  { id: 'all', label: 'الجميع', icon: (p) => <IconAll {...p} /> },
]

export default function App() {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders())
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => loadMonthlyTarget())
  const [targetInput, setTargetInput] = useState(() => {
    const saved = loadMonthlyTarget()
    return saved > 0 ? String(saved) : ''
  })
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState<StageId | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [installEvent, setInstallEvent] = useState<{ prompt: () => Promise<void> } | null>(null)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const pipelineRef = useRef<HTMLElement | null>(null)
  const skipNextCloudSave = useRef(true)
  const cloudReady = useRef(false)

  useEffect(() => {
    saveOrders(orders)
  }, [orders])

  useEffect(() => {
    saveHistory(history)
  }, [history])

  useEffect(() => {
    saveMonthlyTarget(monthlyTarget)
  }, [monthlyTarget])

  useEffect(() => {
    let cancelled = false
    async function hydrateFromCloud() {
      setSyncState('syncing')
      const cloud = await loadCloudStore()
      if (cancelled) return
      const local: CloudStore = {
        updatedAt: new Date().toISOString(),
        monthlyTarget: loadMonthlyTarget(),
        orders: loadOrders(),
        history: loadHistory(),
      }
      if (cloud) {
        const merged = mergeStores(local, cloud)
        skipNextCloudSave.current = true
        setOrders(merged.orders)
        setHistory(merged.history)
        setMonthlyTarget(merged.monthlyTarget)
        setTargetInput(merged.monthlyTarget > 0 ? String(merged.monthlyTarget) : '')
        // Push merged result so all devices stay aligned
        const ok = await saveCloudStore(merged)
        setSyncState(ok ? 'ok' : 'error')
        setToast('تم تحميل البيانات من السحابة')
      } else if (local.orders.length || local.history.length) {
        const ok = await saveCloudStore(local)
        setSyncState(ok ? 'ok' : 'error')
        setToast(ok ? 'تم رفع بيانات هذا الجهاز للسحابة' : 'تعذر الاتصال بالسحابة')
      } else {
        setSyncState('ok')
      }
      cloudReady.current = true
    }
    void hydrateFromCloud()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!cloudReady.current) return
    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false
      return
    }
    const store: CloudStore = {
      updatedAt: new Date().toISOString(),
      monthlyTarget,
      orders,
      history,
    }
    setSyncState('syncing')
    void saveCloudStore(store).then((ok) => {
      setSyncState(ok ? 'ok' : 'error')
    })
  }, [orders, history, monthlyTarget])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      const evt = e as Event & { prompt: () => Promise<void> }
      setInstallEvent({ prompt: () => evt.prompt() })
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  function logHistory(entry: Omit<HistoryEntry, 'id' | 'at'>) {
    const item: HistoryEntry = {
      id: createId(),
      at: new Date().toISOString(),
      ...entry,
    }
    setHistory((prev) => [item, ...prev].slice(0, 1000))
  }

  function saveToDiskManual() {
    downloadBackupToDisk(orders, history, monthlyTarget)
    setToast('تم حفظ نسخة على القرص')
  }

  async function syncNow() {
    setSyncState('syncing')
    const cloud = await loadCloudStore()
    const local: CloudStore = {
      updatedAt: new Date().toISOString(),
      monthlyTarget,
      orders,
      history,
    }
    const merged = cloud ? mergeStores(local, cloud) : local
    skipNextCloudSave.current = true
    setOrders(merged.orders)
    setHistory(merged.history)
    setMonthlyTarget(merged.monthlyTarget)
    setTargetInput(merged.monthlyTarget > 0 ? String(merged.monthlyTarget) : '')
    const ok = await saveCloudStore(merged)
    setSyncState(ok ? 'ok' : 'error')
    setToast(ok ? 'تمت المزامنة مع السحابة' : 'فشلت المزامنة')
  }

  const dateFiltered = orders.filter((o) => matchesDateFilter(o.createdAt, dateFilter))

  const filtered = dateFiltered.filter((o) => {
    if (stageFilter !== 'all' && o.stage !== stageFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.showroom.toLowerCase().includes(q)
    )
  })

  const totalFinance = filtered.reduce((s, o) => s + o.financeAmount, 0)
  const totalCommission = filtered.reduce((s, o) => s + o.commission, 0)

  const achievedAmount = orders
    .filter((o) => TARGET_STAGES.includes(o.stage))
    .reduce((sum, o) => sum + o.financeAmount, 0)
  const targetPercent =
    monthlyTarget > 0
      ? Math.min(999, Math.round((achievedAmount / monthlyTarget) * 1000) / 10)
      : 0
  const progressWidth =
    monthlyTarget > 0 ? Math.min(100, (achievedAmount / monthlyTarget) * 100) : 0

  const monthName = new Intl.DateTimeFormat('ar-SA', {
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  function saveTarget() {
    const value = Number(targetInput)
    if (!Number.isFinite(value) || value < 0) {
      setToast('أدخل مبلغ تارقت صحيح بالريال')
      return
    }
    setMonthlyTarget(value)
    logHistory({
      action: 'target',
      detail: `تم تحديث التارقت الشهري إلى ${formatMoney(value)} ر.س`,
    })
    setToast('تم حفظ التارقت الشهري بالمبلغ')
  }

  const visibleStages =
    stageFilter === 'all' ? STAGES : STAGES.filter((s) => s.id === stageFilter)

  function countByStage(stageId: StageId): number {
    return dateFiltered.filter((o) => o.stage === stageId).length
  }

  function countByDate(filter: DateFilter): number {
    return orders.filter((o) => matchesDateFilter(o.createdAt, filter)).length
  }

  function selectStage(id: StageId | 'all') {
    setStageFilter(id)
    pipelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (id === 'all') {
      setToast('عرض جميع المراحل')
    } else {
      const title = STAGES.find((s) => s.id === id)?.title
      setToast(`عرض طلبات: ${title}`)
    }
  }

  function selectDate(id: DateFilter) {
    setDateFilter(id)
    const label = DATE_FILTERS.find((d) => d.id === id)?.label
    setToast(`فلتر التاريخ: ${label}`)
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  function openNew() {
    resetForm()
    setFormOpen(true)
  }

  function openEdit(order: Order) {
    setForm({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      showroom: order.showroom,
      financeAmount: String(order.financeAmount),
      commission: String(order.commission),
      stage: order.stage,
    })
    setEditingId(order.id)
    setFormOpen(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const financeAmount = Number(form.financeAmount)
    const commission = Number(form.commission)

    if (
      !form.orderNumber.trim() ||
      !form.customerName.trim() ||
      !form.showroom.trim() ||
      !Number.isFinite(financeAmount) ||
      financeAmount < 0 ||
      !Number.isFinite(commission) ||
      commission < 0
    ) {
      setToast('يرجى تعبئة جميع الحقول بشكل صحيح')
      return
    }

    const now = new Date().toISOString()

    if (editingId) {
      const prev = orders.find((o) => o.id === editingId)
      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === editingId
            ? {
                ...o,
                orderNumber: form.orderNumber.trim(),
                customerName: form.customerName.trim(),
                showroom: form.showroom.trim(),
                financeAmount,
                commission,
                stage: form.stage,
                updatedAt: now,
              }
            : o,
        ),
      )
      logHistory({
        action: 'update',
        orderId: editingId,
        orderNumber: form.orderNumber.trim(),
        customerName: form.customerName.trim(),
        fromStage: prev?.stage ?? null,
        toStage: form.stage,
        detail: `تعديل الطلب #${form.orderNumber.trim()} — المرحلة ${form.stage}`,
      })
      setToast('تم تحديث الطلب بنجاح')
    } else {
      const newOrder: Order = {
        id: createId(),
        orderNumber: form.orderNumber.trim(),
        customerName: form.customerName.trim(),
        showroom: form.showroom.trim(),
        financeAmount,
        commission,
        stage: form.stage,
        createdAt: now,
        updatedAt: now,
      }
      setOrders((prev) => [newOrder, ...prev])
      logHistory({
        action: 'create',
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        customerName: newOrder.customerName,
        toStage: newOrder.stage,
        detail: `إضافة طلب #${newOrder.orderNumber} في المرحلة ${newOrder.stage}`,
      })
      setToast('تمت إضافة الطلب بنجاح')
    }

    resetForm()
    setFormOpen(false)
  }

  function moveOrder(id: string, stage: StageId) {
    const current = orders.find((o) => o.id === id)
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, stage, updatedAt: new Date().toISOString() } : o,
      ),
    )
    const stageTitle = STAGES.find((s) => s.id === stage)?.title
    logHistory({
      action: 'move',
      orderId: id,
      orderNumber: current?.orderNumber,
      customerName: current?.customerName,
      fromStage: current?.stage ?? null,
      toStage: stage,
      detail: `نقل الطلب #${current?.orderNumber ?? ''} من ${current?.stage ?? '-'} إلى ${stage} (${stageTitle})`,
    })
    setToast(`تم نقل الطلب إلى: ${stageTitle}`)
  }

  function deleteOrder(id: string) {
    const current = orders.find((o) => o.id === id)
    setOrders((prev) => prev.filter((o) => o.id !== id))
    logHistory({
      action: 'delete',
      orderId: id,
      orderNumber: current?.orderNumber,
      customerName: current?.customerName,
      fromStage: current?.stage ?? null,
      detail: `حذف الطلب #${current?.orderNumber ?? ''} من المرحلة ${current?.stage ?? '-'}`,
    })
    setToast('تم حذف الطلب')
    if (editingId === id) {
      resetForm()
      setFormOpen(false)
    }
  }

  function deleteAllInStage(stageId: StageId) {
    const stageOrders = orders.filter((o) => o.stage === stageId)
    if (stageOrders.length === 0) {
      setToast('لا توجد طلبات للحذف في هذه المرحلة')
      return
    }
    const title = STAGES.find((s) => s.id === stageId)?.title
    const ok = window.confirm(
      `حذف جميع طلبات مرحلة ${stageId} — ${title}؟\nعدد الطلبات: ${stageOrders.length}`,
    )
    if (!ok) return
    setOrders((prev) => prev.filter((o) => o.stage !== stageId))
    logHistory({
      action: 'delete_stage',
      toStage: stageId,
      detail: `حذف الكل من مرحلة ${stageId} — ${title} (${stageOrders.length} طلب)`,
    })
    setToast(`تم حذف جميع طلبات مرحلة ${stageId}`)
  }

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden="true" />
      <div className="bg-pattern" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>الرياض</span>
          </div>
          <div className="brand-text">
            <h1>بنك الرياض</h1>
            <p>لوحة تحكم المبيعات — تمويل المعارض</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span
            className={`sync-badge sync-${syncState}`}
            title="حالة المزامنة السحابية"
          >
            {syncState === 'syncing'
              ? 'جاري المزامنة...'
              : syncState === 'ok'
                ? 'متصل بالسحابة'
                : syncState === 'error'
                  ? 'السحابة غير متصلة'
                  : 'جاهز'}
          </span>
          <button type="button" className="btn-ghost" onClick={() => void syncNow()}>
            مزامنة الآن
          </button>
          {installEvent && (
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                await installEvent.prompt()
                setInstallEvent(null)
                setToast('تم تثبيت تطبيق اللوحة على الجهاز')
              }}
            >
              تثبيت تطبيق أندرويد
            </button>
          )}
          <a className="btn-ghost" href={`${import.meta.env.BASE_URL}riyadh-sales-android.apk`} download>
            تحميل APK
          </a>
          <button type="button" className="btn-ghost" onClick={() => setHistoryOpen(true)}>
            سجل الخطوات ({history.length})
          </button>
          <button type="button" className="btn-ghost" onClick={saveToDiskManual}>
            حفظ على القرص
          </button>
          <button type="button" className="btn-primary" onClick={openNew}>
            + إضافة طلب
          </button>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">مسار التمويل</p>
            <h2>تابع طلبات عملائك من الموافقة حتى الاستلام</h2>
            <p className="hero-sub">
              أضف رقم الطلب وبيانات العميل، ثم حرّك الطلب عبر المراحل: موافقة
              مبدئية، عقد جاهز، تم التمويل، وتم الاستلام.
            </p>
          </div>
          <div className="hero-stats" role="list">
            <div className="stat" role="listitem">
              <span className="stat-label">الطلبات المعروضة</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="stat" role="listitem">
              <span className="stat-label">مبلغ التمويل</span>
              <strong>{formatMoney(totalFinance)} ر.س</strong>
            </div>
            <div className="stat" role="listitem">
              <span className="stat-label">إجمالي العمولة</span>
              <strong>{formatMoney(totalCommission)} ر.س</strong>
            </div>
          </div>
        </section>

        <section className="target-panel" aria-label="التارقت الشهري">
          <div className="target-head">
            <div>
              <h3>التارقت الشهري (بالمبالغ)</h3>
              <p>
                المتحقق = إجمالي مبالغ التمويل في المراحل 77 و118 و120 —{' '}
                {monthName}
              </p>
            </div>
            <div className="target-input-row">
              <label>
                المستهدف الشهري (ر.س)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="مثال: 500000"
                />
              </label>
              <button type="button" className="btn-primary" onClick={saveTarget}>
                حفظ التارقت
              </button>
            </div>
          </div>

          <div className="target-metrics">
            <div className="target-metric">
              <span>المستهدف (مبلغ)</span>
              <strong>{formatMoney(monthlyTarget)} ر.س</strong>
            </div>
            <div className="target-metric">
              <span>المتحقق: إجمالي مبالغ التمويل (77 + 118 + 120)</span>
              <strong>{formatMoney(achievedAmount)} ر.س</strong>
            </div>
            <div className="target-metric highlight">
              <span>نسبة الإنجاز</span>
              <strong>{monthlyTarget > 0 ? `${targetPercent}%` : '—'}</strong>
            </div>
          </div>

          <div className="progress-track" aria-hidden="true">
            <div
              className={`progress-fill ${progressWidth >= 100 ? 'done' : ''}`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <p className="target-note">
            {monthlyTarget > 0
              ? `إجمالي مبالغ التمويل المتحقق ${formatMoney(achievedAmount)} ر.س من أصل المستهدف ${formatMoney(monthlyTarget)} ر.س`
              : 'أدخل مبلغ التارقت الشهري بالريال ثم اضغط حفظ'}
          </p>
        </section>

        <section className="filters-panel" aria-label="فلاتر سريعة">
          <div className="filter-block">
            <h3>المراحل</h3>
            <div className="icon-grid">
              <button
                type="button"
                className={`icon-tile ${stageFilter === 'all' ? 'active' : ''}`}
                onClick={() => selectStage('all')}
              >
                <span className="icon-wrap">
                  <IconAll />
                </span>
                <span className="icon-label">كل المراحل</span>
                <span className="icon-count">{dateFiltered.length}</span>
              </button>
              {STAGES.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  className={`icon-tile stage-${stage.id} ${stageFilter === stage.id ? 'active' : ''}`}
                  onClick={() => selectStage(stage.id)}
                >
                  <span className="icon-wrap">{STAGE_ICONS[stage.id]({})}</span>
                  <span className="icon-code">{stage.code}</span>
                  <span className="icon-label">{stage.title}</span>
                  <span className="icon-count">{countByStage(stage.id)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <h3>حسب تاريخ الإدخال</h3>
            <div className="icon-grid date-grid">
              {DATE_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`icon-tile date-${item.id} ${dateFilter === item.id ? 'active' : ''}`}
                  onClick={() => selectDate(item.id)}
                >
                  <span className="icon-wrap">{item.icon({})}</span>
                  <span className="icon-label">{item.label}</span>
                  <span className="icon-count">{countByDate(item.id)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="toolbar">
          <label className="search">
            <span className="sr-only">بحث</span>
            <input
              type="search"
              placeholder="ابحث برقم الطلب أو اسم العميل أو المعرض..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <section
          className="pipeline"
          aria-label="مراحل الطلبات"
          ref={pipelineRef}
        >
          {visibleStages.map((stage, index) => {
            const stageOrders = filtered.filter((o) => o.stage === stage.id)
            const stageFinance = stageOrders.reduce(
              (s, o) => s + o.financeAmount,
              0,
            )

            return (
              <div
                key={stage.id}
                id={`stage-${stage.id}`}
                className={`column column-${stage.id}`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="column-head">
                  <div className="stage-code">{STAGE_ICONS[stage.id]({})}</div>
                  <div>
                    <h3>
                      {stage.code} — {stage.title}
                    </h3>
                    <p>{stage.description}</p>
                  </div>
                  <span className="count">{stageOrders.length}</span>
                </div>

                <div className="column-meta">
                  <span>تمويل المرحلة: {formatMoney(stageFinance)} ر.س</span>
                  <button
                    type="button"
                    className="delete-stage-btn"
                    onClick={() => deleteAllInStage(stage.id)}
                    disabled={stageOrders.length === 0}
                  >
                    حذف الكل
                  </button>
                </div>

                <div className="cards">
                  {stageOrders.length === 0 ? (
                    <div className="empty">لا توجد طلبات في هذه المرحلة</div>
                  ) : (
                    stageOrders.map((order) => (
                      <article key={order.id} className="order-card">
                        <div className="order-top">
                          <span className="order-no">#{order.orderNumber}</span>
                          <div className="order-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openEdit(order)}
                              title="تعديل"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => deleteOrder(order.id)}
                              title="حذف"
                            >
                              حذف
                            </button>
                          </div>
                        </div>

                        <h4>{order.customerName}</h4>
                        <p className="showroom">{order.showroom}</p>

                        <div className="amounts">
                          <div>
                            <span>مبلغ التمويل</span>
                            <strong>{formatMoney(order.financeAmount)} ر.س</strong>
                          </div>
                          <div>
                            <span>العمولة</span>
                            <strong>{formatMoney(order.commission)} ر.س</strong>
                          </div>
                        </div>

                        <div className="move">
                          <span>نقل إلى</span>
                          <div className="move-btns">
                            {STAGES.filter((s) => s.id !== order.stage).map(
                              (s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className={`move-btn stage-${s.id}`}
                                  onClick={() => moveOrder(order.id, s.id)}
                                >
                                  {s.code} — {s.title}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </section>
      </main>

      {formOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setFormOpen(false)
            resetForm()
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2 id="modal-title">
                {editingId ? 'تعديل الطلب' : 'إضافة طلب جديد'}
              </h2>
              <button
                type="button"
                className="close-btn"
                onClick={() => {
                  setFormOpen(false)
                  resetForm()
                }}
              >
                إغلاق
              </button>
            </div>

            <form onSubmit={handleSubmit} className="order-form">
              <label>
                رقم الطلب
                <input
                  required
                  value={form.orderNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, orderNumber: e.target.value }))
                  }
                  placeholder="مثال: 452189"
                />
              </label>

              <label>
                اسم العميل
                <input
                  required
                  value={form.customerName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerName: e.target.value }))
                  }
                  placeholder="الاسم الكامل"
                />
              </label>

              <label>
                المعرض
                <input
                  required
                  value={form.showroom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, showroom: e.target.value }))
                  }
                  placeholder="اسم المعرض أو الوكالة"
                />
              </label>

              <div className="form-row">
                <label>
                  مبلغ التمويل (ر.س)
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.financeAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, financeAmount: e.target.value }))
                    }
                    placeholder="0"
                  />
                </label>

                <label>
                  قيمة العمولة (ر.س)
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.commission}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, commission: e.target.value }))
                    }
                    placeholder="0"
                  />
                </label>
              </div>

              <fieldset className="stage-picker">
                <legend>المرحلة الحالية</legend>
                <div className="stage-options">
                  {STAGES.map((s) => (
                    <label key={s.id} className={`stage-option stage-${s.id}`}>
                      <input
                        type="radio"
                        name="stage"
                        value={s.id}
                        checked={form.stage === s.id}
                        onChange={() =>
                          setForm((f) => ({ ...f, stage: s.id }))
                        }
                      />
                      <span className="opt-code">{s.code}</span>
                      <span className="opt-title">{s.title}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingId ? 'حفظ التعديلات' : 'إضافة الطلب'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setFormOpen(false)
                    resetForm()
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="modal history-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>سجل الخطوات</h2>
              <button
                type="button"
                className="close-btn"
                onClick={() => setHistoryOpen(false)}
              >
                إغلاق
              </button>
            </div>
            <p className="history-hint">
              كل خطوة تُحفظ تلقائياً في السحابة، فتظهر على أي رابط أو جهاز عند فتح اللوحة.
              يمكنك أيضاً حفظ نسخة على القرص يدوياً.
            </p>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="empty">لا يوجد سجل بعد</div>
              ) : (
                history.map((h) => (
                  <article key={h.id} className="history-item">
                    <time>
                      {new Date(h.at).toLocaleString('ar-SA')}
                    </time>
                    <strong>{h.detail}</strong>
                    {(h.customerName || h.orderNumber) && (
                      <span>
                        {h.orderNumber ? `#${h.orderNumber}` : ''}{' '}
                        {h.customerName ?? ''}
                      </span>
                    )}
                  </article>
                ))
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={saveToDiskManual}>
                حفظ السجل على القرص
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
