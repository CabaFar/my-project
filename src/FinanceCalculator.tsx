import { useMemo, useState } from 'react'
import SalaryRacPolicy from './SalaryRacPolicy'
import {
  DEFAULT_MARGIN_RATES,
  loadMarginRates,
  saveMarginRates,
  type MarginRates,
} from './storage'

type FinanceMode = 'installments' | 'fiftyfifty'
type AmountMode = 'amount' | 'percent'
type CustomerType = 'converted' | 'nonconverted'

/** أرقام إنجليزية (لاتينية) مع فواصل آلاف — بدون رمز عملة */
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
  return `${label}: ${formatMoney(value)}`
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

function cleanRate(raw: string, fallback: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return String(raw).trim() || fallback
}

export default function FinanceCalculator() {
  const [mode, setMode] = useState<FinanceMode>('installments')
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [ratesMsg, setRatesMsg] = useState<string | null>(null)

  const [marginRates, setMarginRates] = useState<MarginRates>(() => loadMarginRates())
  const [ratesDraft, setRatesDraft] = useState<MarginRates>(() => loadMarginRates())

  // Installments inputs (independent from 50-50)
  const [instPrice, setInstPrice] = useState('')
  const [downRaw, setDownRaw] = useState('')
  const [downMode, setDownMode] = useState<AmountMode>('amount')
  const [finalRaw, setFinalRaw] = useState('')
  const [finalMode, setFinalMode] = useState<AmountMode>('amount')
  const [instCustomerType, setInstCustomerType] = useState<CustomerType>('converted')
  const [instMargin, setInstMargin] = useState<string>(
    () => loadMarginRates().installmentsConverted,
  )
  const [years, setYears] = useState('5')
  const [months, setMonths] = useState('59')
  const [instInsurance, setInstInsurance] = useState('')

  // 50-50 inputs (independent from installments)
  const [ffPrice, setFfPrice] = useState('')
  const [ffCustomerType, setFfCustomerType] = useState<CustomerType>('converted')
  const [ffMargin, setFfMargin] = useState<string>(
    () => loadMarginRates().fiftyFiftyConverted,
  )
  const [ffInsurance, setFfInsurance] = useState('')
  const [ffYears, setFfYears] = useState<2 | 3 | 4>(2)

  const price = toNumber(instPrice)
  const marginPct = toNumber(instMargin)
  const insure = toNumber(instInsurance)

  const ffCarPrice = toNumber(ffPrice)
  const ffMarginPct = toNumber(ffMargin)
  const ffInsure = toNumber(ffInsurance)

  const instPreset = {
    converted: marginRates.installmentsConverted,
    nonconverted: marginRates.installmentsNonConverted,
  }
  const ffPreset = {
    converted: marginRates.fiftyFiftyConverted,
    nonconverted: marginRates.fiftyFiftyNonConverted,
  }

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

  function applyInstCustomerType(type: CustomerType) {
    setInstCustomerType(type)
    setInstMargin(instPreset[type])
  }

  function applyFfCustomerType(type: CustomerType) {
    setFfCustomerType(type)
    setFfMargin(ffPreset[type])
  }

  function saveFixedRates() {
    const next: MarginRates = {
      installmentsConverted: cleanRate(
        ratesDraft.installmentsConverted,
        DEFAULT_MARGIN_RATES.installmentsConverted,
      ),
      installmentsNonConverted: cleanRate(
        ratesDraft.installmentsNonConverted,
        DEFAULT_MARGIN_RATES.installmentsNonConverted,
      ),
      fiftyFiftyConverted: cleanRate(
        ratesDraft.fiftyFiftyConverted,
        DEFAULT_MARGIN_RATES.fiftyFiftyConverted,
      ),
      fiftyFiftyNonConverted: cleanRate(
        ratesDraft.fiftyFiftyNonConverted,
        DEFAULT_MARGIN_RATES.fiftyFiftyNonConverted,
      ),
    }
    saveMarginRates(next)
    setMarginRates(next)
    setRatesDraft(next)
    setInstMargin(
      instCustomerType === 'converted'
        ? next.installmentsConverted
        : next.installmentsNonConverted,
    )
    setFfMargin(
      ffCustomerType === 'converted'
        ? next.fiftyFiftyConverted
        : next.fiftyFiftyNonConverted,
    )
    setRatesMsg('تم حفظ النسب الثابتة')
    window.setTimeout(() => setRatesMsg(null), 2200)
  }

  function resetFixedRates() {
    const next = { ...DEFAULT_MARGIN_RATES }
    setRatesDraft(next)
    saveMarginRates(next)
    setMarginRates(next)
    setInstCustomerType('converted')
    setFfCustomerType('converted')
    setInstMargin(next.installmentsConverted)
    setFfMargin(next.fiftyFiftyConverted)
    setRatesMsg('تمت إعادة النسب الافتراضية')
    window.setTimeout(() => setRatesMsg(null), 2200)
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
      moneyLine('الدفعة الأولى شامل الرسوم الإدارية', installments.firstPayment),
      `مدة التمويل: ${duration}`,
      moneyLine('القسط الشهري', installments.monthly),
      moneyLine('الدفعة الأخيرة', installments.last),
      moneyLine('الإجمالي', installments.total),
      moneyLine('الربح', installments.profit),
      moneyLine('التأمين', installments.insurance),
    ].filter(Boolean) as string[]

    showCopyFeedback(await copyText(lines.join('\n')))
  }

  async function copyFiftyFiftyResult() {
    const lines = [
      moneyLine('الدفعة الأولى شامل الرسوم الإدارية', fiftyFifty.firstPayment),
      `مدة التمويل: ${fiftyFifty.years} سنوات`,
      moneyLine('الدفعة الأخيرة', fiftyFifty.finalPayment),
      moneyLine('الإجمالي', fiftyFifty.total),
      moneyLine('الربح', fiftyFifty.profit),
      moneyLine('التأمين', fiftyFifty.insurance),
    ].filter(Boolean) as string[]

    showCopyFeedback(await copyText(lines.join('\n')))
  }

  return (
    <section className="calculator-page" aria-label="حاسبة تمويل السيارات">
      <div className="calc-hero">
        <p className="eyebrow">أدوات المبيعات</p>
        <h2>حاسبة تمويل السيارات</h2>
        <p className="hero-sub">
          احسب القسط أو نظام الدفعتين قبل تقديم العرض للعميل. سجّل النسب الثابتة
          بالأعلى وغيّرها في أي وقت، والنسخ بدون رمز العملة.
        </p>
      </div>

      <section className="margin-rates-panel" aria-label="تسجيل النسب الثابتة">
        <div className="margin-rates-head">
          <div>
            <h3>تسجيل النسب الثابتة</h3>
            <p>يمكن تغييرها في أي وقت — تُحفظ على هذا الجهاز وتُستخدم مباشرة في الحاسبة</p>
          </div>
          <div className="margin-rates-actions">
            <button type="button" className="btn-primary" onClick={saveFixedRates}>
              حفظ النسب
            </button>
            <button type="button" className="btn-ghost" onClick={resetFixedRates}>
              افتراضي
            </button>
          </div>
        </div>
        {ratesMsg && <p className="calc-copy-feedback">{ratesMsg}</p>}
        <div className="margin-rates-grid">
          <label>
            أقساط — محوّل %
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              lang="en"
              value={ratesDraft.installmentsConverted}
              onChange={(e) =>
                setRatesDraft((r) => ({
                  ...r,
                  installmentsConverted: e.target.value,
                }))
              }
            />
          </label>
          <label>
            أقساط — غير محوّل %
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              lang="en"
              value={ratesDraft.installmentsNonConverted}
              onChange={(e) =>
                setRatesDraft((r) => ({
                  ...r,
                  installmentsNonConverted: e.target.value,
                }))
              }
            />
          </label>
          <label>
            50–50 — محوّل %
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              lang="en"
              value={ratesDraft.fiftyFiftyConverted}
              onChange={(e) =>
                setRatesDraft((r) => ({
                  ...r,
                  fiftyFiftyConverted: e.target.value,
                }))
              }
            />
          </label>
          <label>
            50–50 — غير محوّل %
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              lang="en"
              value={ratesDraft.fiftyFiftyNonConverted}
              onChange={(e) =>
                setRatesDraft((r) => ({
                  ...r,
                  fiftyFiftyNonConverted: e.target.value,
                }))
              }
            />
          </label>
        </div>
      </section>

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

            <fieldset className="reply-picker">
              <legend>نوع العميل — نسبة الربح</legend>
              <div className="calc-toggle wide" role="group" aria-label="نوع العميل">
                <button
                  type="button"
                  className={instCustomerType === 'converted' ? 'active' : ''}
                  onClick={() => applyInstCustomerType('converted')}
                >
                  محوّل <span lang="en">{instPreset.converted}%</span>
                </button>
                <button
                  type="button"
                  className={instCustomerType === 'nonconverted' ? 'active' : ''}
                  onClick={() => applyInstCustomerType('nonconverted')}
                >
                  غير محوّل <span lang="en">{instPreset.nonconverted}%</span>
                </button>
              </div>
            </fieldset>

            <label>
              هامش الربح (%) — ثابت ويمكن تعديله
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                lang="en"
                value={instMargin}
                onChange={(e) => {
                  setInstMargin(e.target.value)
                  const v = e.target.value.trim()
                  if (v === instPreset.converted) setInstCustomerType('converted')
                  else if (v === instPreset.nonconverted) setInstCustomerType('nonconverted')
                }}
                placeholder={instPreset.converted}
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
            <div className="calc-result-row highlight">
              <span>الدفعة الأولى (شامل الرسوم)</span>
              <strong lang="en">{formatMoney(installments.firstPayment)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>الدفعة الأخيرة</span>
              <strong lang="en">{formatMoney(installments.last)} ر.س</strong>
            </div>
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
              عند النسخ: بدون رمز العملة وبدون مبلغ التمويل — فقط الدفعة الأولى
              شامل الرسوم، المدة، القسط، الدفعة الأخيرة، الإجمالي، الربح، والتأمين.
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

            <fieldset className="reply-picker">
              <legend>نوع العميل — نسبة الربح</legend>
              <div className="calc-toggle wide" role="group" aria-label="نوع العميل">
                <button
                  type="button"
                  className={ffCustomerType === 'converted' ? 'active' : ''}
                  onClick={() => applyFfCustomerType('converted')}
                >
                  محوّل <span lang="en">{ffPreset.converted}%</span>
                </button>
                <button
                  type="button"
                  className={ffCustomerType === 'nonconverted' ? 'active' : ''}
                  onClick={() => applyFfCustomerType('nonconverted')}
                >
                  غير محوّل <span lang="en">{ffPreset.nonconverted}%</span>
                </button>
              </div>
            </fieldset>

            <label>
              هامش الربح (%) — ثابت ويمكن تعديله
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                lang="en"
                value={ffMargin}
                onChange={(e) => {
                  setFfMargin(e.target.value)
                  const v = e.target.value.trim()
                  if (v === ffPreset.converted) setFfCustomerType('converted')
                  else if (v === ffPreset.nonconverted) setFfCustomerType('nonconverted')
                }}
                placeholder={ffPreset.converted}
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
              <span>الدفعة الأولى شامل الرسوم</span>
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
            <p className="calc-note">
              عند النسخ: بدون رمز العملة وبدون مبلغ التمويل — الدفعة الأولى، المدة،
              الدفعة الأخيرة، الإجمالي، الربح، والتأمين.
            </p>
          </aside>
        </div>
      )}

      <SalaryRacPolicy />
    </section>
  )
}
