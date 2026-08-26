import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { STAGES } from './stages'
import {
  downloadBackupToDisk,
  loadDeletedIds,
  loadHistory,
  loadMonthlyTarget,
  loadOrders,
  saveDeletedIds,
  saveHistory,
  saveMonthlyTarget,
  saveOrders,
} from './storage'
import {
  isStoreEmpty,
  loadCloudStore,
  mergeStores,
  revisionFromStore,
  syncWithCloud,
  type CloudStore,
} from './cloud'
import type {
  DateFilter,
  HistoryEntry,
  InquiryStatus,
  Order,
  StageId,
} from './types'
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  countsTowardFinance,
  isInquiryStatus,
  repliedFromInquiryStatus,
} from './types'
import FinanceCalculator from './FinanceCalculator'
import './App.css'

const TARGET_STAGES: StageId[] = ['77', '118', '120']

const EMPTY_FORM = {
  orderNumber: '',
  customerName: '',
  showroom: '',
  financeAmount: '',
  commission: '',
  stage: '0' as StageId,
  phone: '',
  carModel: '',
  source: '',
  lastContactAt: '',
  inquiryStatus: 'new' as InquiryStatus,
  notes: '',
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value)
}

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDateDisplay(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function resolveInquiryStatus(order: Partial<Order>): InquiryStatus {
  if (isInquiryStatus(order.inquiryStatus)) return order.inquiryStatus
  return order.replied ? 'contacted' : 'new'
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

function IconNew({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

const STAGE_ICONS: Record<StageId, (props: { className?: string }) => ReactNode> = {
  '0': (p) => <IconNew {...p} />,
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

function normalizeOrder(order: Order): Order {
  const inquiryStatus = resolveInquiryStatus(order)
  return {
    ...order,
    stage: (['0', '04', '77', '118', '120'] as StageId[]).includes(order.stage)
      ? order.stage
      : '0',
    phone: typeof order.phone === 'string' ? order.phone : '',
    carModel: typeof order.carModel === 'string' ? order.carModel : '',
    source: typeof order.source === 'string' ? order.source : '',
    lastContactAt: typeof order.lastContactAt === 'string' ? order.lastContactAt : '',
    inquiryStatus,
    replied: repliedFromInquiryStatus(inquiryStatus),
    notes: typeof order.notes === 'string' ? order.notes : '',
  }
}

export default function App() {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders().map(normalizeOrder))
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [deletedIds, setDeletedIds] = useState<Record<string, string>>(() => loadDeletedIds())
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => loadMonthlyTarget())
  const [targetInput, setTargetInput] = useState(() => {
    const saved = loadMonthlyTarget()
    return saved > 0 ? String(saved) : ''
  })
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [page, setPage] = useState<'board' | 'calculator'>('board')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState<StageId | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [installEvent, setInstallEvent] = useState<{ prompt: () => Promise<void> } | null>(null)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const pipelineRef = useRef<HTMLElement | null>(null)
  const skipNextCloudSave = useRef(true)
  const cloudReady = useRef(false)
  const ordersRef = useRef(orders)
  const historyRef = useRef(history)
  const deletedIdsRef = useRef(deletedIds)
  const monthlyTargetRef = useRef(monthlyTarget)
  const hydrateToastShown = useRef(false)
  /** Bumps when the user actually edits data — used as local revision clock */
  const localRevisionRef = useRef<string>(new Date(0).toISOString())

  ordersRef.current = orders
  historyRef.current = history
  deletedIdsRef.current = deletedIds
  monthlyTargetRef.current = monthlyTarget

  function touchLocalRevision() {
    localRevisionRef.current = new Date().toISOString()
  }

  function currentLocalStore(): CloudStore {
    const base = {
      monthlyTarget: monthlyTargetRef.current,
      orders: ordersRef.current,
      history: historyRef.current,
      deletedIds: deletedIdsRef.current,
    }
    return {
      ...base,
      updatedAt: revisionFromStore({
        ...base,
        updatedAt: localRevisionRef.current,
      }),
    }
  }

  function applyStore(store: CloudStore, opts?: { skipSave?: boolean }) {
    if (opts?.skipSave) skipNextCloudSave.current = true
    setOrders(store.orders.map((o) => normalizeOrder(o as Order)))
    setHistory(store.history)
    setDeletedIds(store.deletedIds || {})
    setMonthlyTarget(store.monthlyTarget)
    setTargetInput(store.monthlyTarget > 0 ? String(store.monthlyTarget) : '')
  }

  useEffect(() => {
    saveOrders(orders)
  }, [orders])

  useEffect(() => {
    saveHistory(history)
  }, [history])

  useEffect(() => {
    saveDeletedIds(deletedIds)
  }, [deletedIds])

  useEffect(() => {
    saveMonthlyTarget(monthlyTarget)
  }, [monthlyTarget])

  async function runSync(options?: { silent?: boolean; pullOnly?: boolean }) {
    setSyncState('syncing')
    const local = currentLocalStore()
    if (options?.pullOnly) {
      const cloud = await loadCloudStore()
      if (!cloud) {
        setSyncState(isStoreEmpty(local) ? 'idle' : 'error')
        if (!options.silent) setToast('تعذر الاتصال بالسحابة')
        return false
      }
      const merged = mergeStores(local, cloud)
      applyStore(merged, { skipSave: true })
      // جهاز فاضي: سحب فقط — لا دفع قد يصفّر السحابة
      if (isStoreEmpty(local)) {
        setSyncState('ok')
        return true
      }
      const result = await syncWithCloud(merged)
      if (result.ok) applyStore(result.store, { skipSave: true })
      setSyncState(result.ok ? 'ok' : 'error')
      return result.ok
    }

    // جهاز جديد فاضي بدون بيانات محلية: اسحب فقط ولا تكتب فوق السحابة
    if (isStoreEmpty(local)) {
      const cloud = await loadCloudStore()
      if (cloud) {
        applyStore(mergeStores(local, cloud), { skipSave: true })
        setSyncState('ok')
        return true
      }
      setSyncState('idle')
      return false
    }

    const result = await syncWithCloud(local)
    if (result.ok) {
      // Apply merged cloud result so other-device changes appear here too
      applyStore(result.store, { skipSave: true })
      setSyncState('ok')
      return true
    }
    setSyncState('error')
    if (!options?.silent) setToast('تعذر الحفظ في السحابة — سيُعاد المحاولة تلقائياً')
    return false
  }

  useEffect(() => {
    let cancelled = false
    async function hydrateFromCloud() {
      setSyncState('syncing')
      const cloud = await loadCloudStore()
      if (cancelled) return
      const localRaw = {
        monthlyTarget: loadMonthlyTarget(),
        orders: loadOrders(),
        history: loadHistory(),
        deletedIds: loadDeletedIds(),
      }
      const localForMerge: CloudStore = {
        ...localRaw,
        updatedAt: revisionFromStore(localRaw),
      }
      if (cloud) {
        const merged = mergeStores(localForMerge, cloud)
        applyStore(merged, { skipSave: true })
        // جهاز فاضي يستقبل البيانات فقط — الدفع للجهاز الذي لديه إدخالات
        if (isStoreEmpty(localForMerge)) {
          setSyncState('ok')
          if (!hydrateToastShown.current) {
            hydrateToastShown.current = true
            setToast('تم تحميل بيانات السحابة على هذا الجهاز')
          }
        } else {
          const result = await syncWithCloud(merged)
          if (cancelled) return
          if (result.ok) applyStore(result.store, { skipSave: true })
          setSyncState(result.ok ? 'ok' : 'error')
          if (!hydrateToastShown.current) {
            hydrateToastShown.current = true
            setToast(
              result.ok
                ? 'تم تحميل أحدث البيانات — الحفظ التلقائي مفعّل'
                : 'تم التحميل، لكن الحفظ السحابي متأخر — سيُعاد تلقائياً',
            )
          }
        }
      } else if (!isStoreEmpty(localForMerge)) {
        const result = await syncWithCloud(localForMerge)
        if (cancelled) return
        if (result.ok) applyStore(result.store, { skipSave: true })
        setSyncState(result.ok ? 'ok' : 'error')
        if (!hydrateToastShown.current) {
          hydrateToastShown.current = true
          setToast(
            result.ok
              ? 'تم رفع بيانات هذا الجهاز — الحفظ التلقائي مفعّل'
              : 'تعذر الاتصال بالسحابة — سيُعاد الحفظ تلقائياً',
          )
        }
      } else {
        setSyncState('idle')
        if (!hydrateToastShown.current) {
          hydrateToastShown.current = true
          setToast('بانتظار بيانات السحابة — لن يتم تصفير الطلبات من جهاز فاضي')
        }
      }
      cloudReady.current = true
    }
    void hydrateFromCloud()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-save every change to the shared cloud (debounced + merge-safe)
  useEffect(() => {
    if (!cloudReady.current) return
    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false
      return
    }
    touchLocalRevision()
    const timer = window.setTimeout(() => {
      void runSync({ silent: true })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [orders, history, monthlyTarget, deletedIds])

  // Keep devices aligned while the board stays open
  useEffect(() => {
    const tick = () => {
      if (!cloudReady.current) return
      if (document.visibilityState !== 'visible') return
      void runSync({ silent: true })
    }
    const interval = window.setInterval(tick, 12000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const onOnline = () => {
      void runSync({ silent: false })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
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
    const ok = await runSync({ silent: false })
    setToast(ok ? 'تمت المزامنة — بياناتك على كل الأجهزة' : 'فشلت المزامنة — أعد المحاولة')
  }

  const dateFiltered = orders.filter((o) => matchesDateFilter(o.createdAt, dateFilter))

  const filtered = dateFiltered.filter((o) => {
    if (stageFilter !== 'all' && o.stage !== stageFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.showroom.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q) ||
      o.carModel.toLowerCase().includes(q) ||
      o.source.toLowerCase().includes(q)
    )
  })

  const totalFinance = filtered
    .filter((o) => countsTowardFinance(o.stage))
    .reduce((s, o) => s + o.financeAmount, 0)
  const totalCommission = filtered
    .filter((o) => countsTowardFinance(o.stage))
    .reduce((s, o) => s + o.commission, 0)

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
      phone: order.phone || '',
      carModel: order.carModel || '',
      source: order.source || '',
      lastContactAt: order.lastContactAt || '',
      inquiryStatus: resolveInquiryStatus(order),
      notes: order.notes || '',
    })
    setEditingId(order.id)
    setFormOpen(true)
  }

  function setOrderInquiryStatus(order: Order, status: InquiryStatus) {
    const now = new Date().toISOString()
    const lastContactAt =
      status === 'new'
        ? order.lastContactAt
        : order.lastContactAt || todayDateInput()
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              inquiryStatus: status,
              replied: repliedFromInquiryStatus(status),
              lastContactAt,
              updatedAt: now,
            }
          : o,
      ),
    )
    logHistory({
      action: 'reply',
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      fromStage: order.stage,
      toStage: order.stage,
      detail: `حالة الطلب #${order.orderNumber}: ${INQUIRY_STATUS_LABELS[status]}`,
    })
    setToast(`تم تحديث الحالة: ${INQUIRY_STATUS_LABELS[status]}`)
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
      const inquiryStatus = form.inquiryStatus
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
                phone: form.phone.trim(),
                carModel: form.carModel.trim(),
                source: form.source.trim(),
                lastContactAt: form.lastContactAt,
                inquiryStatus,
                replied: repliedFromInquiryStatus(inquiryStatus),
                notes: form.notes.trim(),
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
      const inquiryStatus = form.inquiryStatus
      const newOrder: Order = {
        id: createId(),
        orderNumber: form.orderNumber.trim(),
        customerName: form.customerName.trim(),
        showroom: form.showroom.trim(),
        financeAmount,
        commission,
        stage: form.stage,
        phone: form.phone.trim(),
        carModel: form.carModel.trim(),
        source: form.source.trim(),
        lastContactAt: form.lastContactAt,
        inquiryStatus,
        replied: repliedFromInquiryStatus(inquiryStatus),
        notes: form.notes.trim(),
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
    const deletedAt = new Date().toISOString()
    setDeletedIds((prev) => ({ ...prev, [id]: deletedAt }))
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
    const deletedAt = new Date().toISOString()
    setDeletedIds((prev) => {
      const next = { ...prev }
      for (const o of stageOrders) next[o.id] = deletedAt
      return next
    })
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
          <div className="page-switch" role="tablist" aria-label="أقسام اللوحة">
            <button
              type="button"
              role="tab"
              aria-selected={page === 'board'}
              className={page === 'board' ? 'active' : ''}
              onClick={() => setPage('board')}
            >
              لوحة الطلبات
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={page === 'calculator'}
              className={page === 'calculator' ? 'active' : ''}
              onClick={() => setPage('calculator')}
            >
              حاسبة التمويل
            </button>
          </div>
          <span
            className={`sync-badge sync-${syncState}`}
            title="حالة المزامنة السحابية"
          >
            {syncState === 'syncing'
              ? 'جاري الحفظ...'
              : syncState === 'ok'
                ? 'محفوظ على كل الأجهزة'
                : syncState === 'error'
                  ? 'سيُعاد الحفظ تلقائياً'
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
          {page === 'board' && (
            <button type="button" className="btn-primary" onClick={openNew}>
              + إضافة طلب
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {page === 'calculator' ? (
          <FinanceCalculator />
        ) : (
          <>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">مسار التمويل</p>
            <h2>تابع طلبات عملائك من الاستفسار حتى الاستلام</h2>
            <p className="hero-sub">
              ابدأ من مرحلة الطلبات الجديدة (استفسارات)، ثم انقل للمرحلة 04
              لاحتساب مبلغ التمويل، ثم عقد جاهز، تم التمويل، وتم الاستلام.
            </p>
          </div>
          <div className="hero-stats" role="list">
            <div className="stat" role="listitem">
              <span className="stat-label">الطلبات المعروضة</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="stat" role="listitem">
              <span className="stat-label">مبلغ التمويل (من 04 فما فوق)</span>
              <strong>{formatMoney(totalFinance)} ر.س</strong>
            </div>
            <div className="stat" role="listitem">
              <span className="stat-label">إجمالي العمولة (من 04 فما فوق)</span>
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
            const countsFinance = countsTowardFinance(stage.id)

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
                  <span>
                    {countsFinance
                      ? `تمويل المرحلة: ${formatMoney(stageFinance)} ر.س`
                      : `مبالغ تقديرية (لا تُحتسب): ${formatMoney(stageFinance)} ر.س`}
                  </span>
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

                        <div className="order-meta">
                          {order.phone ? (
                            <p>
                              <span>الجوال</span>
                              <strong lang="en" dir="ltr">
                                {order.phone}
                              </strong>
                            </p>
                          ) : null}
                          {order.carModel ? (
                            <p>
                              <span>السيارة</span>
                              <strong>{order.carModel}</strong>
                            </p>
                          ) : null}
                          {order.source ? (
                            <p>
                              <span>المصدر</span>
                              <strong>{order.source}</strong>
                            </p>
                          ) : null}
                          <p>
                            <span>آخر تواصل</span>
                            <strong lang="en">{formatDateDisplay(order.lastContactAt)}</strong>
                          </p>
                        </div>

                        {order.stage === '0' ? (
                          <div
                            className="inquiry-status-grid"
                            role="group"
                            aria-label="حالة الطلب الجديد"
                          >
                            {INQUIRY_STATUSES.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                className={`inquiry-status-btn status-${s.id} ${
                                  order.inquiryStatus === s.id ? 'active' : ''
                                }`}
                                onClick={() => setOrderInquiryStatus(order, s.id)}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={`inquiry-status-chip status-${order.inquiryStatus}`}
                          >
                            {INQUIRY_STATUS_LABELS[order.inquiryStatus]}
                          </span>
                        )}

                        <div className="amounts">
                          <div>
                            <span>
                              {countsFinance ? 'مبلغ التمويل' : 'مبلغ تقديري'}
                            </span>
                            <strong>{formatMoney(order.financeAmount)} ر.س</strong>
                          </div>
                          <div>
                            <span>العمولة</span>
                            <strong>{formatMoney(order.commission)} ر.س</strong>
                          </div>
                        </div>

                        {order.notes?.trim() ? (
                          <p className="order-notes">
                            <span>ملاحظة</span>
                            {order.notes}
                          </p>
                        ) : null}

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
          </>
        )}
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
                  رقم جوال العميل
                  <input
                    type="tel"
                    inputMode="tel"
                    lang="en"
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="05xxxxxxxx"
                  />
                </label>
                <label>
                  السيارة المطلوبة
                  <input
                    value={form.carModel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, carModel: e.target.value }))
                    }
                    placeholder="مثال: كامري 2025"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  مصدر الطلب
                  <input
                    value={form.source}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, source: e.target.value }))
                    }
                    placeholder="مثال: معرض / إحالة / إعلان"
                  />
                </label>
                <label>
                  تاريخ آخر تواصل
                  <input
                    type="date"
                    lang="en"
                    value={form.lastContactAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastContactAt: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  مبلغ التمويل (ر.س)
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    lang="en"
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
                    lang="en"
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
                {form.stage === '0' && (
                  <p className="form-hint">
                    مرحلة الطلبات الجديدة للاستفسارات — مبلغ التمويل لا يُحتسب في
                    الإجمالي حتى النقل إلى 04 أو ما بعدها.
                  </p>
                )}
              </fieldset>

              {form.stage === '0' && (
                <fieldset className="reply-picker">
                  <legend>حالة الطلب الجديد</legend>
                  <div className="inquiry-status-grid form">
                    {INQUIRY_STATUSES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`inquiry-status-btn status-${s.id} ${
                          form.inquiryStatus === s.id ? 'active' : ''
                        }`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            inquiryStatus: s.id,
                            lastContactAt:
                              s.id === 'new'
                                ? f.lastContactAt
                                : f.lastContactAt || todayDateInput(),
                          }))
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <label>
                ملاحظة
                <textarea
                  className="notes-input"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="اكتب أي ملاحظة عن الطلب أو العميل..."
                />
              </label>

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
