import { useEffect, useState, type FormEvent } from 'react'
import { STAGES } from './stages'
import { loadOrders, saveOrders } from './storage'
import type { Order, StageId } from './types'
import './App.css'

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

export default function App() {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders())
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    saveOrders(orders)
  }, [orders])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.showroom.toLowerCase().includes(q)
    )
  })

  const totalFinance = orders.reduce((s, o) => s + o.financeAmount, 0)
  const totalCommission = orders.reduce((s, o) => s + o.commission, 0)

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
      setOrders((prev) =>
        prev.map((o) =>
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
      setToast('تمت إضافة الطلب بنجاح')
    }

    resetForm()
    setFormOpen(false)
  }

  function moveOrder(id: string, stage: StageId) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, stage, updatedAt: new Date().toISOString() } : o,
      ),
    )
    const stageTitle = STAGES.find((s) => s.id === stage)?.title
    setToast(`تم نقل الطلب إلى: ${stageTitle}`)
  }

  function deleteOrder(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id))
    setToast('تم حذف الطلب')
    if (editingId === id) {
      resetForm()
      setFormOpen(false)
    }
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
        <button type="button" className="btn-primary" onClick={openNew}>
          + إضافة طلب
        </button>
      </header>

      <main className="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">مسار التمويل</p>
            <h2>تابع طلبات عملائك من الموافقة حتى الصرف</h2>
            <p className="hero-sub">
              أضف رقم الطلب وبيانات العميل، ثم حرّك الطلب عبر المراحل: موافقة
              مبدئية، عقد جاهز، وتم التمويل.
            </p>
          </div>
          <div className="hero-stats" role="list">
            <div className="stat" role="listitem">
              <span className="stat-label">إجمالي الطلبات</span>
              <strong>{orders.length}</strong>
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

        <section className="pipeline" aria-label="مراحل الطلبات">
          {STAGES.map((stage, index) => {
            const stageOrders = filtered.filter((o) => o.stage === stage.id)
            const stageFinance = stageOrders.reduce(
              (s, o) => s + o.financeAmount,
              0,
            )

            return (
              <div
                key={stage.id}
                className={`column column-${stage.id}`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="column-head">
                  <div className="stage-code">{stage.code}</div>
                  <div>
                    <h3>{stage.title}</h3>
                    <p>{stage.description}</p>
                  </div>
                  <span className="count">{stageOrders.length}</span>
                </div>

                <div className="column-meta">
                  تمويل المرحلة: {formatMoney(stageFinance)} ر.س
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

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
