import type { Order } from './types'
import { INQUIRY_STATUS_LABELS } from './types'
import { monthLabelAr } from './months'

function csvEscape(value: string | number): string {
  const raw = String(value ?? '')
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

function stageTitle(stage: Order['stage']): string {
  const map: Record<Order['stage'], string> = {
    '0': '0 طلبات جديدة',
    '04': '04 موافقة مبدئية',
    '77': '77 عقد جاهز',
    '118': '118 تم التمويل',
    '120': '120 تم الاستلام',
  }
  return map[stage] || stage
}

/** يصدّر CSV بترميز UTF-8 BOM ليفتح بشكل صحيح في Excel */
export function exportOrdersToExcel(
  orders: Order[],
  opts: { filename: string; sheetTitle?: string },
): void {
  const headers = [
    'رقم الطلب',
    'اسم العميل',
    'رقم الجوال',
    'المعرض',
    'السيارة المطلوبة',
    'مصدر الطلب',
    'مبلغ التمويل',
    'العمولة',
    'المرحلة',
    'حالة المتابعة',
    'تاريخ آخر تواصل',
    'شهر اللوحة',
    'ملاحظات',
    'تاريخ الإنشاء',
  ]

  const rows = orders.map((o) => [
    o.orderNumber,
    o.customerName,
    o.phone,
    o.showroom,
    o.carModel,
    o.source,
    o.financeAmount,
    o.commission,
    stageTitle(o.stage),
    INQUIRY_STATUS_LABELS[o.inquiryStatus] || '',
    o.lastContactAt,
    o.boardMonth ? monthLabelAr(o.boardMonth) : '',
    o.notes,
    o.createdAt,
  ])

  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename.endsWith('.csv') ? opts.filename : `${opts.filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
