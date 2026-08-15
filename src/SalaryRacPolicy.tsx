const CATEGORY_A = [
  'GMC',
  'KIA',
  'Chevrolet',
  'Mazda',
  'Honda',
  'Nissan',
  'Ford',
  'Hyundai',
  'Toyota',
  'Lexus',
]

const CATEGORY_B = [
  'Haval',
  'Infiniti',
  'Changan',
  'Chrysler',
  'Dodge',
  'Lincoln',
  'Cadillac',
  'Mitsubishi',
  'Jeep',
  'Genesis',
  'Audi',
  'Mercedes-Benz',
  'BMW',
  'Porsche',
  'Land Rover',
  'Geely',
  'Jetour',
  'Volkswagen',
  'MG',
  'Suzuki',
]

const CATEGORY_C = [
  'Lucid',
  'BAIC',
  'Hongqi',
  'TATA',
  'Subaru',
  'Daihatsu',
  'Seat',
  'GWM',
  'Skoda',
  'Peugeot',
  'Dongfeng',
  'Fiat',
  'FAW',
  'JAC',
  'Ineos',
  'Lynk & Co',
  'GAC Motors',
  'BYD',
  'Omoda',
  'Renault',
  'Citroen',
  'Opel',
  'Foton',
  'JMC',
  'Jaecoo',
]

const CATEGORY_D = [
  'Aston Martin',
  'Rolls-Royce',
  'Bentley',
  'Bugatti',
  'Ferrari',
  'Maybach',
  'Lamborghini',
  'McLaren',
  'Maserati',
]

type IncomeRow = {
  employer: string
  stSaudi: string
  stNonSaudi: string
  nstSaudi: string
  nstNonSaudi: string
}

const INCOME_ROWS: IncomeRow[] = [
  {
    employer: 'حكومي / شبه حكومي',
    stSaudi: '4,000',
    stNonSaudi: '4,000',
    nstSaudi: '5,000',
    nstNonSaudi: '7,000',
  },
  {
    employer: 'عسكري',
    stSaudi: '4,000',
    stNonSaudi: '—',
    nstSaudi: '15,000',
    nstNonSaudi: '—',
  },
  {
    employer: 'متقاعد',
    stSaudi: '4,000',
    stNonSaudi: '—',
    nstSaudi: '5,000',
    nstNonSaudi: '7,000',
  },
  {
    employer: 'قطاع خاص أ',
    stSaudi: '4,000',
    stNonSaudi: '5,000',
    nstSaudi: '5,500',
    nstNonSaudi: '7,000',
  },
  {
    employer: 'قطاع خاص ب',
    stSaudi: '4,000',
    stNonSaudi: '5,000',
    nstSaudi: '5,500',
    nstNonSaudi: '7,000',
  },
  {
    employer: 'قطاع خاص ج',
    stSaudi: '4,000',
    stNonSaudi: '5,000',
    nstSaudi: '5,500',
    nstNonSaudi: '7,000',
  },
  {
    employer: 'غير معتمد',
    stSaudi: '6,000',
    stNonSaudi: '7,000',
    nstSaudi: '8,000',
    nstNonSaudi: '10,000',
  },
  {
    employer: 'نظام 50/50',
    stSaudi: '5,000',
    stNonSaudi: '—',
    nstSaudi: '5,000',
    nstNonSaudi: '—',
  },
]

type BalloonRow = {
  category: string
  st: [string, string, string]
  nst: [string, string, string]
}

const BALLOON_ROWS: BalloonRow[] = [
  { category: 'أ', st: ['50%', '45%', '45%'], nst: ['45%', '40%', '40%'] },
  { category: 'ب', st: ['45%', '40%', '40%'], nst: ['45%', '40%', '40%'] },
  { category: 'ج', st: ['40%', '35%', '35%'], nst: ['40%', '35%', '35%'] },
  { category: 'د', st: ['20%', '10%', '10%'], nst: ['10%', '10%', '10%'] },
]

function BrandList({ brands }: { brands: string[] }) {
  return (
    <ul className="rac-brands">
      {brands.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  )
}

export default function SalaryRacPolicy() {
  return (
    <section className="rac-policy" aria-label="سياسة الرواتب ومعايير التمويل">
      <div className="rac-policy-head">
        <h3>سياسة الرواتب ومعايير التمويل (RAC)</h3>
        <p>سارية فورًا اعتبارًا من 17 يونيو 2025</p>
      </div>

      <div className="rac-glossary">
        <div>
          <strong>ST</strong>
          <span>عميل محول الراتب إلى بنك الرياض</span>
        </div>
        <div>
          <strong>NST</strong>
          <span>عميل غير محول الراتب</span>
        </div>
      </div>

      <h4>1) الحد الأدنى للراتب حسب جهة العمل</h4>
      <div className="rac-table-wrap">
        <table className="rac-table">
          <thead>
            <tr>
              <th rowSpan={2}>فئة جهة العمل</th>
              <th colSpan={2}>ST — محول الراتب</th>
              <th colSpan={2}>NST — غير محول الراتب</th>
            </tr>
            <tr>
              <th>سعودي</th>
              <th>غير سعودي</th>
              <th>سعودي</th>
              <th>غير سعودي</th>
            </tr>
          </thead>
          <tbody>
            {INCOME_ROWS.map((row) => (
              <tr key={row.employer}>
                <td>{row.employer}</td>
                <td>{row.stSaudi} ر.س</td>
                <td>{row.stNonSaudi === '—' ? '—' : `${row.stNonSaudi} ر.س`}</td>
                <td>{row.nstSaudi} ر.س</td>
                <td>
                  {row.nstNonSaudi === '—' ? '—' : `${row.nstNonSaudi} ر.س`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>2) تصنيفات السيارات ونسبة الدفعة الأخيرة الافتراضية</h4>
      <div className="rac-categories">
        <article className="rac-cat">
          <header>
            <h5>فئة أ</h5>
            <p>
              ST: <strong>45%</strong> — NST: <strong>40%</strong>
            </p>
          </header>
          <BrandList brands={CATEGORY_A} />
        </article>
        <article className="rac-cat">
          <header>
            <h5>فئة ب</h5>
            <p>
              ST: <strong>40%</strong> — NST: <strong>40%</strong>
            </p>
          </header>
          <BrandList brands={CATEGORY_B} />
        </article>
        <article className="rac-cat">
          <header>
            <h5>فئة ج</h5>
            <p>
              ST: <strong>35%</strong> — NST: <strong>35%</strong>
            </p>
          </header>
          <BrandList brands={CATEGORY_C} />
        </article>
        <article className="rac-cat">
          <header>
            <h5>فئة د</h5>
            <p>
              ST: <strong>10%</strong> — NST: <strong>10%</strong>
            </p>
          </header>
          <BrandList brands={CATEGORY_D} />
        </article>
      </div>

      <h4>3) الحد الأقصى للدفعة الأخيرة حسب مدة التمويل</h4>
      <div className="rac-table-wrap">
        <table className="rac-table">
          <thead>
            <tr>
              <th rowSpan={2}>فئة السيارة</th>
              <th colSpan={3}>ST — محول الراتب</th>
              <th colSpan={3}>NST — غير محول الراتب</th>
            </tr>
            <tr>
              <th>12–23 شهر</th>
              <th>24–47 شهر</th>
              <th>48–60 شهر</th>
              <th>12–23 شهر</th>
              <th>24–47 شهر</th>
              <th>48–60 شهر</th>
            </tr>
          </thead>
          <tbody>
            {BALLOON_ROWS.map((row) => (
              <tr key={row.category}>
                <td>فئة {row.category}</td>
                {row.st.map((v, i) => (
                  <td key={`st-${row.category}-${i}`}>{v}</td>
                ))}
                {row.nst.map((v, i) => (
                  <td key={`nst-${row.category}-${i}`}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rac-conditions">
        <h4>4) شروط إضافية</h4>
        <p>
          لعملاء <strong>NST</strong> من العسكريين أو القطاع الخاص غير المعتمد:
        </p>
        <ul>
          <li>الحد الأقصى للدفعة الأخيرة: <strong>35%</strong></li>
          <li>الحد الأدنى للدفعة الأولى: <strong>10%</strong></li>
        </ul>
      </div>

      <p className="rac-footnote">
        المصدر: New RAC — سريان فوري من 17 يونيو 2025 (للاستخدام الداخلي) —{' '}
        <a href={`${import.meta.env.BASE_URL}rac-salary-policy.pdf`} target="_blank" rel="noreferrer">
          تحميل الملف الأصلي
        </a>
      </p>
    </section>
  )
}
