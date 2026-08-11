import { useEffect, useMemo, useState } from 'react'
import {
  BRANCHES,
  buildMonthDays,
  computeTotals,
  currentMonthKey,
  dayNumberLabel,
  emptyDayRecord,
  monthTitle,
  parseMonthKey,
  shiftMonthKey,
  weekdayLabel,
  type BranchId,
  type CashDayRecord,
} from './cash'

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value)
}

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface CashDashboardProps {
  cashDays: CashDayRecord[]
  onChange: (days: CashDayRecord[]) => void
  onToast: (message: string) => void
}

export default function CashDashboard({
  cashDays,
  onChange,
  onToast,
}: CashDashboardProps) {
  const [month, setMonth] = useState(() => currentMonthKey())

  // Auto-refresh to the real current month when the calendar month rolls over
  useEffect(() => {
    const syncMonth = () => {
      const key = currentMonthKey()
      setMonth((prev) => (prev === key ? prev : key))
    }
    syncMonth()
    const id = window.setInterval(syncMonth, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncMonth()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const parsed = parseMonthKey(month)
  const monthDays = useMemo(() => {
    if (!parsed) return []
    return buildMonthDays(parsed.year, parsed.month, cashDays)
  }, [cashDays, parsed])

  const totals = useMemo(() => computeTotals(monthDays), [monthDays])
  const today = todayKey()

  function upsertDay(next: CashDayRecord) {
    const exists = cashDays.some((d) => d.date === next.date)
    const cleaned =
      next.waseeta.cash === 0 &&
      next.waseeta.expense === 0 &&
      next.beirut.cash === 0 &&
      next.beirut.expense === 0

    if (cleaned) {
      if (!exists) return
      onChange(cashDays.filter((d) => d.date !== next.date))
      return
    }

    if (exists) {
      onChange(cashDays.map((d) => (d.date === next.date ? next : d)))
    } else {
      onChange([...cashDays, next].sort((a, b) => a.date.localeCompare(b.date)))
    }
  }

  function updateField(
    date: string,
    branch: BranchId,
    field: 'cash' | 'expense',
    raw: string,
  ) {
    const value = raw === '' ? 0 : Number(raw)
    if (!Number.isFinite(value) || value < 0) {
      onToast('أدخل مبلغاً صحيحاً')
      return
    }
    const current = cashDays.find((d) => d.date === date) ?? emptyDayRecord(date)
    upsertDay({
      ...current,
      [branch]: {
        ...current[branch],
        [field]: Math.round(value),
      },
      updatedAt: new Date().toISOString(),
    })
  }

  function clearMonth() {
    if (!parsed) return
    const prefix = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-`
    const remaining = cashDays.filter((d) => !d.date.startsWith(prefix))
    if (remaining.length === cashDays.length) {
      onToast('لا توجد بيانات لمسحها في هذا الشهر')
      return
    }
    const ok = window.confirm(`مسح كل بيانات الكاش لشهر ${monthTitle(month)}؟`)
    if (!ok) return
    onChange(remaining)
    onToast('تم مسح بيانات الشهر')
  }

  return (
    <section className="cash-dashboard" aria-label="لوحة الكاش اليومية">
      <div className="cash-hero">
        <div className="cash-hero-copy">
          <p className="eyebrow">متابعة الكاش اليومية</p>
          <h2>إجمالي الكاش والمصروف لكل يوم — فرع الوسيطاء وفرع بيروت</h2>
          <p className="hero-sub">
            سجّل كاش اليوم ومصروفه لكل فرع. اللوحة تعرض أيام الشهر كاملة وتتحدّث
            تلقائياً مع بداية كل شهر جديد.
          </p>
        </div>
        <div className="cash-month-nav" aria-label="اختيار الشهر">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
          >
            الشهر السابق
          </button>
          <div className="cash-month-label">
            <strong>{monthTitle(month)}</strong>
            <span>من 1 إلى نهاية الشهر</span>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
          >
            الشهر التالي
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setMonth(currentMonthKey())}
          >
            الشهر الحالي
          </button>
        </div>
      </div>

      <div className="cash-summary" role="list">
        <article className="cash-summary-card waseeta" role="listitem">
          <h3>فرع الوسيطاء</h3>
          <dl>
            <div>
              <dt>إجمالي الكاش</dt>
              <dd>{formatMoney(totals.waseeta.cash)} ر.س</dd>
            </div>
            <div>
              <dt>إجمالي المصروف</dt>
              <dd>{formatMoney(totals.waseeta.expense)} ر.س</dd>
            </div>
            <div className="net">
              <dt>الصافي</dt>
              <dd>{formatMoney(totals.waseeta.net)} ر.س</dd>
            </div>
          </dl>
        </article>

        <article className="cash-summary-card beirut" role="listitem">
          <h3>فرع بيروت</h3>
          <dl>
            <div>
              <dt>إجمالي الكاش</dt>
              <dd>{formatMoney(totals.beirut.cash)} ر.س</dd>
            </div>
            <div>
              <dt>إجمالي المصروف</dt>
              <dd>{formatMoney(totals.beirut.expense)} ر.س</dd>
            </div>
            <div className="net">
              <dt>الصافي</dt>
              <dd>{formatMoney(totals.beirut.net)} ر.س</dd>
            </div>
          </dl>
        </article>

        <article className="cash-summary-card all" role="listitem">
          <h3>إجمالي الفرعين</h3>
          <dl>
            <div>
              <dt>إجمالي الكاش</dt>
              <dd>{formatMoney(totals.all.cash)} ر.س</dd>
            </div>
            <div>
              <dt>إجمالي المصروف</dt>
              <dd>{formatMoney(totals.all.expense)} ر.س</dd>
            </div>
            <div className="net">
              <dt>الصافي</dt>
              <dd>{formatMoney(totals.all.net)} ر.س</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="cash-table-wrap">
        <div className="cash-table-head">
          <div>
            <h3>سجل أيام الشهر</h3>
            <p>أدخل إجمالي الكاش والمصروف من الكاش لكل يوم ولكل فرع.</p>
          </div>
          <button type="button" className="btn-ghost danger-text" onClick={clearMonth}>
            مسح بيانات الشهر
          </button>
        </div>

        <div className="cash-table-scroll">
          <table className="cash-table">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky-col">
                  اليوم
                </th>
                {BRANCHES.map((branch) => (
                  <th key={branch.id} colSpan={3} className={`branch-head ${branch.id}`}>
                    {branch.label}
                  </th>
                ))}
                <th colSpan={3} className="branch-head all">
                  مجموع اليوم
                </th>
              </tr>
              <tr>
                {BRANCHES.flatMap((branch) => [
                  <th key={`${branch.id}-cash`}>الكاش</th>,
                  <th key={`${branch.id}-expense`}>المصروف</th>,
                  <th key={`${branch.id}-net`}>الصافي</th>,
                ])}
                <th>الكاش</th>
                <th>المصروف</th>
                <th>الصافي</th>
              </tr>
            </thead>
            <tbody>
              {monthDays.map((day) => {
                const dayCash = day.waseeta.cash + day.beirut.cash
                const dayExpense = day.waseeta.expense + day.beirut.expense
                const dayNet = dayCash - dayExpense
                const isToday = day.date === today
                return (
                  <tr key={day.date} className={isToday ? 'is-today' : undefined}>
                    <td className="sticky-col day-cell">
                      <strong>{dayNumberLabel(day.date)}</strong>
                      <span>
                        {weekdayLabel(day.date)}
                        {isToday ? ' · اليوم' : ''}
                      </span>
                    </td>
                    {BRANCHES.map((branch) => {
                      const entry = day[branch.id]
                      return (
                        <FragmentCells
                          key={branch.id}
                          cash={entry.cash}
                          expense={entry.expense}
                          onCash={(v) => updateField(day.date, branch.id, 'cash', v)}
                          onExpense={(v) =>
                            updateField(day.date, branch.id, 'expense', v)
                          }
                        />
                      )
                    })}
                    <td className="total-cell">{formatMoney(dayCash)}</td>
                    <td className="total-cell expense">{formatMoney(dayExpense)}</td>
                    <td className="total-cell net">{formatMoney(dayNet)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th className="sticky-col">إجمالي الشهر</th>
                <td className="total-cell">{formatMoney(totals.waseeta.cash)}</td>
                <td className="total-cell expense">
                  {formatMoney(totals.waseeta.expense)}
                </td>
                <td className="total-cell net">{formatMoney(totals.waseeta.net)}</td>
                <td className="total-cell">{formatMoney(totals.beirut.cash)}</td>
                <td className="total-cell expense">
                  {formatMoney(totals.beirut.expense)}
                </td>
                <td className="total-cell net">{formatMoney(totals.beirut.net)}</td>
                <td className="total-cell">{formatMoney(totals.all.cash)}</td>
                <td className="total-cell expense">{formatMoney(totals.all.expense)}</td>
                <td className="total-cell net">{formatMoney(totals.all.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  )
}

function FragmentCells({
  cash,
  expense,
  onCash,
  onExpense,
}: {
  cash: number
  expense: number
  onCash: (value: string) => void
  onExpense: (value: string) => void
}) {
  return (
    <>
      <td>
        <input
          className="cash-input"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={cash || ''}
          placeholder="0"
          onChange={(e) => onCash(e.target.value)}
          aria-label="إجمالي الكاش"
        />
      </td>
      <td>
        <input
          className="cash-input expense"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={expense || ''}
          placeholder="0"
          onChange={(e) => onExpense(e.target.value)}
          aria-label="المصروف من الكاش"
        />
      </td>
      <td className="total-cell net">{formatMoney(cash - expense)}</td>
    </>
  )
}
