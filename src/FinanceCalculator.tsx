import { useMemo, useState } from 'react'

type FinanceMode = 'installments' | 'fiftyfifty'
type AmountMode = 'amount' | 'percent'

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ar-SA', {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(value)
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

function adminFees(price: number) {
  const base = price * 0.005
  const vat = base * 0.15
  return { base, vat, total: base + vat }
}

export default function FinanceCalculator() {
  const [mode, setMode] = useState<FinanceMode>('installments')

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
  const fees = adminFees(price)
  const marginPct = toNumber(instMargin)
  const insure = toNumber(instInsurance)

  const ffCarPrice = toNumber(ffPrice)
  const ffFees = adminFees(ffCarPrice)
  const ffMarginPct = toNumber(ffMargin)
  const ffInsure = toNumber(ffInsurance)

  const installments = useMemo(() => {
    const down = resolveAmount(price, downRaw, downMode)
    const last = resolveAmount(price, finalRaw, finalMode)
    const y = Math.min(5, Math.max(1, Math.round(toNumber(years) || 1)))
    const m = Math.min(59, Math.max(1, Math.round(toNumber(months) || 1)))
    // First payment paid by customer includes admin fees + VAT
    const firstPayment = down + fees.total
    // Financed amount = car price - down payment only (admin fees not deducted)
    const financed = Math.max(0, price - down)
    const profit = financed > 0 ? financed * (marginPct / 100) * y : 0
    const monthlyBase = Math.max(0, financed - last + profit + insure)
    const monthly = m > 0 ? monthlyBase / m : 0
    return {
      down,
      last,
      firstPayment,
      financed,
      profit,
      monthly,
      years: y,
      months: m,
    }
  }, [price, downRaw, downMode, finalRaw, finalMode, years, months, marginPct, insure, fees.total])

  const fiftyFifty = useMemo(() => {
    const half = ffCarPrice / 2
    const firstPayment = half + ffFees.total + ffInsure
    const profit = half * (ffMarginPct / 100) * ffYears
    const finalPayment = half + profit
    return {
      half,
      firstPayment,
      profit,
      finalPayment,
      total: firstPayment + finalPayment,
    }
  }, [ffCarPrice, ffFees.total, ffInsure, ffMarginPct, ffYears])

  function onYearsChange(value: string) {
    setYears(value)
    const y = Math.min(5, Math.max(1, Math.round(toNumber(value) || 1)))
    const suggested = Math.min(59, y * 12 - (y >= 5 ? 1 : 0))
    setMonths(String(Math.max(1, suggested || y * 12)))
  }

  return (
    <section className="calculator-page" aria-label="حاسبة تمويل السيارات">
      <div className="calc-hero">
        <p className="eyebrow">أدوات المبيعات</p>
        <h2>حاسبة تمويل السيارات</h2>
        <p className="hero-sub">
          احسب القسط أو نظام الدفعتين قبل تقديم العرض للعميل. كل نظام له مدخلاته
          المستقلة.
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
                value={instMargin}
                onChange={(e) => setInstMargin(e.target.value)}
                placeholder="مثال: 3.5"
              />
            </label>

            <div className="form-row">
              <label>
                مدة التمويل (سنوات)
                <select value={years} onChange={(e) => onYearsChange(e.target.value)}>
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
                value={instInsurance}
                onChange={(e) => setInstInsurance(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          <aside className="calc-results" aria-live="polite">
            <h3>نتيجة الحساب</h3>
            <div className="calc-result-row">
              <span>الرسوم الإدارية (0.5%)</span>
              <strong>{formatMoney(fees.base)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>ضريبة الرسوم (15%)</span>
              <strong>{formatMoney(fees.vat)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>إجمالي الرسوم</span>
              <strong>{formatMoney(fees.total)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>الدفعة الأولى (شامل الرسوم)</span>
              <strong>{formatMoney(installments.firstPayment)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>مبلغ التمويل</span>
              <strong>{formatMoney(installments.financed)} ر.س</strong>
            </div>
            <p className="calc-note tiny">سعر السيارة − الدفعة الأولى (بدون الرسوم)</p>
            <div className="calc-result-row">
              <span>إجمالي الربح</span>
              <strong>{formatMoney(installments.profit)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>الدفعة الأخيرة</span>
              <strong>{formatMoney(installments.last)} ر.س</strong>
            </div>
            <div className="calc-result-row highlight">
              <span>القسط الشهري</span>
              <strong>{formatMoney(installments.monthly)} ر.س</strong>
            </div>
            <p className="calc-note">
              مبلغ التمويل = سعر السيارة − الدفعة الأولى فقط.
              الرسوم تُضاف للدفعة الأولى ولا تُخصم من مبلغ التمويل.
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
                    {y} سنوات
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
                value={ffInsurance}
                onChange={(e) => setFfInsurance(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          <aside className="calc-results" aria-live="polite">
            <h3>نتيجة نظام 50–50</h3>
            <div className="calc-result-row">
              <span>نصف سعر السيارة</span>
              <strong>{formatMoney(fiftyFifty.half)} ر.س</strong>
            </div>
            <div className="calc-result-row">
              <span>الرسوم الإدارية + الضريبة</span>
              <strong>{formatMoney(ffFees.total)} ر.س</strong>
            </div>
            <div className="calc-result-row highlight">
              <span>الدفعة الأولى</span>
              <strong>{formatMoney(fiftyFifty.firstPayment)} ر.س</strong>
            </div>
            <p className="calc-note tiny">
              نصف السعر + الرسوم (0.5% + ضريبة 15%) + التأمين
            </p>
            <div className="calc-result-row">
              <span>الربح حسب المدة</span>
              <strong>{formatMoney(fiftyFifty.profit)} ر.س</strong>
            </div>
            <div className="calc-result-row highlight">
              <span>الدفعة الأخيرة</span>
              <strong>{formatMoney(fiftyFifty.finalPayment)} ر.س</strong>
            </div>
            <p className="calc-note tiny">نصف السعر + الربح ({ffYears} سنوات)</p>
            <div className="calc-result-row">
              <span>إجمالي ما يدفعه العميل</span>
              <strong>{formatMoney(fiftyFifty.total)} ر.س</strong>
            </div>
            <p className="calc-note">بدون أقساط شهرية — دفعتان فقط.</p>
          </aside>
        </div>
      )}
    </section>
  )
}
