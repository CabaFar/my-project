import { useMemo, useState } from 'react'
import SalaryRacPolicy from './SalaryRacPolicy'

type FinanceMode = 'installments' | 'fiftyfifty'
type AmountMode = 'amount' | 'percent'

/** أرقام إنجليزية (لاتينية) مع فواصل آلاف */
function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)
}

function moneyLine(label: string, value: number, skipIfZero = false): string | null {
  if (skipIfZero && (!Number.isFinite(value) || value === 0)) return null
  return `${label}: ${formatMoney(value)} ر.س`
}

function toNumber(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function resolveAmount(price: number, raw: string, mode: AmountMode): number {
  const n = toNumber(raw)
  if (mode === 'percent') return (price * n) / 100
  return n
}

/** Administrative fees = 0.5% of financing amount + 15% VAT on that fee. */
function adminFees(financeAmount: number) {
  const base = Math.max(0, financeAmount) * 0.005
  const vat = base * 0.15
  return { base, vat, total: base + vat }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export default function FinanceCalculator() {
  const [mode, setMode] = useState<FinanceMode>('installments')
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  // Installments inputs (independent from 50-50)
  const [instPrice, setInstPrice] = useState('')
  const [downRaw, setDownRaw] = useState('')
  const [downMode, setDownMode] = useState<AmountMode>('amount')
  const [finalRaw, setFinalRaw] = useState('')
  const [finalMode, setFinalMode] = useState<AmountMode>('amount')
  const [instMargin, setInstMargin] = useState('')
  const [years, setYears] = useState('5')
  const [months, setMonths] = useState('59')
  const [instInsurance, setInstInsurance] = useState('')

  // 50-50 inputs (independent from installments)
  const [ffPrice, setFfPrice] = useState('')
  const [ffMargin, setFfMargin] = useState('')
  const [ffInsurance, setFfInsurance] = useState('')
  const [ffYears, setFfYears] = useState<2 | 3 | 4>(2)

  const price = toNumber(instPrice)
  const marginPct = toNumber(instMargin)
  const insure = toNumber(instInsurance)

  const ffCarPrice = toNumber(ffPrice)
  const ffMarginPct = toNumber(ffMargin)
  const ffInsure = toNumber(ffInsurance)

  const installments = useMemo(() => {
    const down = resolveAmount(price, downRaw, downMode)
    const last = resolveAmount(price, finalRaw, finalMode)
    const y = Math.min(5, Math.max(1, Math.round(toNumber(years) || 1)))
    const m = Math.min(59, Math.max(1, Math.round(toNumber(months) || 1)))
    // Financed amount = car price - down payment only (admin fees not deducted)
    const financed = Math.max(0, price - down)
    // Admin fees = 0.5% of financing amount (not car price)
    const fees = adminFees(financed)
    const firstPayment = down + fees.total
    const profit = financed > 0 ? financed * (marginPct / 100) * y : 0
    const monthlyBase = Math.max(0, financed - last + profit + insure)
    const monthly = m > 0 ? monthlyBase / m : 0
    const total = firstPayment + monthly * m + last
    return {
      down,
      last,
      firstPayment,
      financed,
      fees,
      profit,
      monthly,
      years: y,
      months: m,
      insurance: insure,
      carPrice: price,
      total,
    }
  }, [price, downRaw, downMode, finalRaw, finalMode, years, months, marginPct, insure])

  const fiftyFifty = useMemo(() => {
    const half = ffCarPrice / 2
    // In 50-50, financed amount is the deferred half
    const fees = adminFees(half)
    const firstPayment = half + fees.total + ffInsure
    const profit = half * (ffMarginPct / 100) * ffYears
    const finalPayment = half + profit
    return {
      carPrice: ffCarPrice,
      half,
      fees,
      firstPayment,
      profit,
      finalPayment,
      insurance: ffInsure,
      years: ffYears,
      total: firstPayment + finalPayment,
    }
  }, [ffCarPrice, ffInsure, ffMarginPct, ffYears])

  function onYearsChange(value: string) {
    setYears(value)
    const y = Math.min(5, Math.max(1, Math.round(toNumber(value) || 1)))
    const suggested = Math.min(59, y * 12 - (y >= 5 ? 1 : 0))
    setMonths(String(Math.max(1, suggested || y * 12)))
  }

  function showCopyFeedback(ok: boolean) {
    setCopyMsg(ok ? 'تم نسخ نتيجة الحساب' : 'تعذر النسخ — حاول مرة أخرى')
    window.setTimeout(() => setCopyMsg(null), 2200)
  }

  async function copyInstallmentsResult() {
    const duration =
      installments.years === 1
        ? `1 سنة (${installments.months} شهر)`
        : `${installments.years} سنوات (${installments.months} شهر)`

    const lines = [
      'عرض تمويل سيارة — بنك الرياض',
      'نظام أقساط شهرية',
      '────────────────────',
      moneyLine('سعر السيارة كاش', installments.carPrice),
      moneyLine('مبلغ التمويل', installments.financed),
      `مدة التمويل: ${duration}`,
      moneyLine('الدفعة الأولى', installments.down, true),
      moneyLine('الرسوم الإدارية (شامل الضريبة)', installments.fees.total),
      moneyLine('الدفعة الأولى شامل الرسوم', installments.firstPayment),
      moneyLine('الدفعة الأخيرة', installments.last, true),
      moneyLine('القسط الشهري', installments.monthly),
      moneyLine('الإجمالي', installments.total),
      moneyLine('إجمالي التأمين', installments.insurance),
      moneyLine('إجمالي الربح', installments.profit),
      '────────────────────',
      'ملاحظة: الرسوم الإدارية = 0.5% من مبلغ التمويل + ضريبة 15%.',
    ].filter(Boolean) as string[]

    showCopyFeedback(await copyText(lines.join('\n')))
  }

  async function copyFiftyFiftyResult() {
    const lines = [
      'عرض تمويل سيارة — بنك الرياض',
      'نظام دفعتين 50–50',
      '────────────────────',
      moneyLine('سعر السيارة كاش', fiftyFifty.carPrice),
      moneyLine('مبلغ التمويل (النصف المؤجل)', fiftyFifty.half),
      `مدة التمويل: ${fiftyFifty.years} سنوات`,
      moneyLine('الدفعة الأولى (نصف السعر)', fiftyFifty.half),
      moneyLine('الرسوم الإدارية (شامل الضريبة)', fiftyFifty.fees.total),
      moneyLine('الدفعة الأولى شامل الرسوم والتأمين', fiftyFifty.firstPayment),
      moneyLine('الدفعة الأخيرة', fiftyFifty.finalPayment),
      moneyLine('الإجمالي', fiftyFifty.total),
      moneyLine('إجمالي التأمين', fiftyFifty.insurance),
      moneyLine('إجمالي الربح', fiftyFifty.profit),
      '────────────────────',
      'ملاحظة: بدون أقساط شهرية — دفعتان فقط.',
    ].filter(Boolean) as string[]

    showCopyFeedback(await copyText(lines.join('\n')))
  }

  return (
    <section className="calculator-page" aria-label="حاسبة تمويل السيارات">
      <div className="calc-hero">
        <p className="eyebrow">أدوات المبيعات</p>
        <h2>حاسبة تمويل السيارات</h2>
        <p className="hero-sub">
          احسب القسط أو نظام الدفعتين قبل تقديم العرض للعميل. كل نظام له مدخلاته
          المستقلة. الأرقام بالإنجليزية، ويمكنك نسخ نتيجة الحساب كاملة.
        </p>
      </div>

      <div className="calc-mode-switch" role="tablist" aria-label="نوع التمويل">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'installments'}
          className={mode === 'installments' ? 'active' : ''}
          onClick={() => setMode('installments')}
        >
          نظام أقساط شهرية
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'fiftyfifty'}
          className={mode === 'fiftyfifty' ? 'active' : ''}
          onClick={() => setMode('fiftyfifty')}
        >
          نظام دفعتين 50–50
        </button>
      </div>

      {mode === 'installments' ? (
        <div className="calc-layout">
          <div className="calc-form">
            <label>
              سعر السيارة (ر.س)
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                lang="en"
                value={instPrice}
                onChange={(e) => setInstPrice(e.target.value)}
                placeholder="مثال: 120000"
              />
            </label>

            <div className="calc-split">
              <label>
                الدفعة الأولى
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  lang="en"
                  value={downRaw}
                  onChange={(e) => setDownRaw(e.target.value)}
                  placeholder={downMode === 'percent' ? 'مثال: 20' : 'مثال: 24000'}
                />
              </label>
              <div className="calc-toggle" role="group" aria-label="نوع الدفعة الأولى">
                <button
                  type="button"
                  className={downMode === 'amount' ? 'active' : ''}
                  onClick={() => setDownMode('amount')}
                >
                  مبلغ
                </button>
                <button
                  type="button"
                  className={downMode === 'percent' ? 'active' : ''}
                  onClick={() => setDownMode('percent')}
                >
                  نسبة %
                </button>
              </div>
            </div>

            <div className="calc-split">
              <label>
                الدفعة الأخيرة
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  lang="en"
                  value={finalRaw}
                  onChange={(e) => setFinalRaw(e.target.value)}
                  placeholder={finalMode === 'percent' ? 'مثال: 10' : 'مثال: 12000'}
                />
              </label>
              <div className="calc-toggle" role="group" aria-label="نوع الدفعة الأخيرة">
                <button
                  type="button"
                  className={finalMode === 'amount' ? 'active' : ''}
                  onClick={() => setFinalMode('amount')}
                >
                  مبلغ
                </button>
                <button
                  type="button"
                  className={finalMode === 'percent' ? 'active' : ''}
                  onClick={() => setFinalMode('percent')}
                >
                  نسبة %
                </button>
              </div>
            </div>

            <label>
              هامش الربح (%)
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                lang="en"
                value={instMargin}
                onChange={(e) => setInstMargin(e.target.value)}
                placeholder="مثال: 3.5"
              />
            </label>

            <div className="form-row">
              <label>
                مدة التمويل (سنوات)
                <select value={years} onChange={(e) => onYearsChange(e.target.value)} lang="en">
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      {y} {y === 1 ? 'سنة' : 'سنوات'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                عدد الأقساط (شهر)
                <input
                  type="number"
                  min="1"
                  max="59"
                  step="1"
                  inputMode="numeric"
                  lang="en"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                />
              </label>
            </div>

            <label>
              التأمين (ر.س)
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                lang="en"
                value={instInsurance}
                onChange={(e) => setInstInsurance(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          <aside className="calc-results" aria-live="polite">
            <div className="calc-results-head">
              <h3>نتيجة الحساب</h3>
              <button
                type="button"
                className="btn-ghost calc-copy-btn"
                onClick={() => void copyInstallmentsResult()}
              >
                نسخ النتيجة للعميل
              </button>
            </div>
            {copyMsg && mode === 'installments' && (
              <p className="calc-copy-feedback">{copyMsg}</p>
            )}
            <div className="calc-result-row">
              <span>سعر السيارة كاش</span>
              <strong lang="en">{formatMoney(installments.carPrice)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>مبلغ التمويل</span>
              <strong lang="en">{formatMoney(installments.financed)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>مدة التمويل</span>
              <strong lang="en">
                {installments.years} سنوات / {installments.months} شهر
              </strong>
            </div>
            <p className="calc-note tiny">سعر السيارة − الدفعة الأولى (بدون الرسوم)</p>
            {installments.down > 0 && (
              <div className="calc-result-row">
                <span>الدفعة الأولى</span>
                <strong lang="en">{formatMoney(installments.down)} ر.س</strong>
              </div>
            )}
            <div className="calc-result-row">
              <span>الرسوم الإدارية (0.5% من التمويل)</span>
              <strong lang="en">{formatMoney(installments.fees.base)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>ضريبة الرسوم (15%)</span>
              <strong lang="en">{formatMoney(installments.fees.vat)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>إجمالي الرسوم</span>
              <strong lang="en">{formatMoney(installments.fees.total)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>الدفعة الأولى (شامل الرسوم)</span>
              <strong lang="en">{formatMoney(installments.firstPayment)} ر.س</strong>
            </div>
            {installments.last > 0 && (
              <div className="calc-result-row">
                <span>الدفعة الأخيرة</span>
                <strong lang="en">{formatMoney(installments.last)} ر.س</strong>
              </div>
            )}
            <div className="calc-result-row highlight">
              <span>القسط الشهري</span>
              <strong lang="en">{formatMoney(installments.monthly)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>الإجمالي</span>
              <strong lang="en">{formatMoney(installments.total)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>إجمالي التأمين</span>
              <strong lang="en">{formatMoney(installments.insurance)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>إجمالي الربح</span>
              <strong lang="en">{formatMoney(installments.profit)} ر.س</strong>
            </div>
            <p className="calc-note">
              الرسوم الإدارية = 0.5% من مبلغ التمويل (وليس سعر السيارة)، ثم تُضاف
              ضريبة 15% على الرسوم إلى الدفعة الأولى.
            </p>
          </aside>
        </div>
      ) : (
        <div className="calc-layout">
          <div className="calc-form">
            <label>
              سعر السيارة (ر.س)
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                lang="en"
                value={ffPrice}
                onChange={(e) => setFfPrice(e.target.value)}
                placeholder="مثال: 120000"
              />
            </label>

            <label>
              مدة التمويل
              <div className="calc-toggle wide" role="group">
                {([2, 3, 4] as const).map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={ffYears === y ? 'active' : ''}
                    onClick={() => setFfYears(y)}
                  >
                    <span lang="en">{y}</span> سنوات
                  </button>
                ))}
              </div>
            </label>

            <label>
              هامش الربح (%)
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                lang="en"
                value={ffMargin}
                onChange={(e) => setFfMargin(e.target.value)}
                placeholder="مثال: 3.5"
              />
            </label>

            <label>
              التأمين (ر.س)
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                lang="en"
                value={ffInsurance}
                onChange={(e) => setFfInsurance(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          <aside className="calc-results" aria-live="polite">
            <div className="calc-results-head">
              <h3>نتيجة نظام 50–50</h3>
              <button
                type="button"
                className="btn-ghost calc-copy-btn"
                onClick={() => void copyFiftyFiftyResult()}
              >
                نسخ النتيجة للعميل
              </button>
            </div>
            {copyMsg && mode === 'fiftyfifty' && (
              <p className="calc-copy-feedback">{copyMsg}</p>
            )}
            <div className="calc-result-row">
              <span>سعر السيارة كاش</span>
              <strong lang="en">{formatMoney(fiftyFifty.carPrice)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>مبلغ التمويل (النصف المؤجل)</span>
              <strong lang="en">{formatMoney(fiftyFifty.half)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>مدة التمويل</span>
              <strong lang="en">{fiftyFifty.years} سنوات</strong>
            </div>
            <div className="calc-result-row">
              <span>الرسوم (0.5% من التمويل + ضريبة)</span>
              <strong lang="en">{formatMoney(fiftyFifty.fees.total)} ر.س</strong>
            </div>
            <div className="calc-result-row highlight">
              <span>الدفعة الأولى</span>
              <strong lang="en">{formatMoney(fiftyFifty.firstPayment)} ر.س</strong>
            </div>
            <p className="calc-note tiny">
              نصف السعر + رسوم 0.5% من مبلغ التمويل (النصف المؤجل) مع ضريبة 15% +
              التأمين
            </p>
            <div className="calc-result-row highlight">
              <span>الدفعة الأخيرة</span>
              <strong lang="en">{formatMoney(fiftyFifty.finalPayment)} ر.س</strong>
            </div>
            <p className="calc-note tiny">نصف السعر + الربح ({fiftyFifty.years} سنوات)</p>
            <div className="calc-result-row">
              <span>الإجمالي</span>
              <strong lang="en">{formatMoney(fiftyFifty.total)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>إجمالي التأمين</span>
              <strong lang="en">{formatMoney(fiftyFifty.insurance)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>إجمالي الربح</span>
              <strong lang="en">{formatMoney(fiftyFifty.profit)} ر.س</strong>
            </div>
            <p className="calc-note">بدون أقساط شهرية — دفعتان فقط.</p>
          </aside>
        </div>
      )}

      <SalaryRacPolicy />
    </section>
  )
}
