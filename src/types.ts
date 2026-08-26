export type StageId = '0' | '04' | '77' | '118' | '120'

export type DateFilter = 'today' | 'week' | 'month' | 'all'

/** حالة متابعة الطلبات الجديدة (مرحلة 0) */
export type InquiryStatus = 'new' | 'contacted' | 'documents' | 'declined'

export const INQUIRY_STATUSES: {
  id: InquiryStatus
  label: string
}[] = [
  { id: 'new', label: 'جديد' },
  { id: 'contacted', label: 'تم التواصل' },
  { id: 'documents', label: 'ارسل المستندات' },
  { id: 'declined', label: 'لايرغب' },
]

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  documents: 'ارسل المستندات',
  declined: 'لايرغب',
}

export function isInquiryStatus(value: unknown): value is InquiryStatus {
  return (
    value === 'new' ||
    value === 'contacted' ||
    value === 'documents' ||
    value === 'declined'
  )
}

export type HistoryAction =
  | 'create'
  | 'update'
  | 'move'
  | 'delete'
  | 'delete_stage'
  | 'target'
  | 'reply'

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  showroom: string
  financeAmount: number
  commission: number
  stage: StageId
  /** رقم جوال العميل */
  phone: string
  /** السيارة المطلوبة */
  carModel: string
  /** مصدر الطلب */
  source: string
  /** تاريخ آخر تواصل (YYYY-MM-DD) */
  lastContactAt: string
  /** حالة متابعة الطلبات الجديدة */
  inquiryStatus: InquiryStatus
  /**
   * توافق خلفي مع الأجهزة القديمة:
   * true عندما تكون الحالة تم التواصل أو ارسل المستندات.
   */
  replied: boolean
  /** Free-text notes about the order / customer. */
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Stage {
  id: StageId
  code: string
  title: string
  description: string
}

export interface HistoryEntry {
  id: string
  at: string
  action: HistoryAction
  orderId?: string
  orderNumber?: string
  customerName?: string
  fromStage?: StageId | null
  toStage?: StageId | null
  detail: string
}

/** Stages whose financing amounts count toward totals (not stage 0 inquiries). */
export const FINANCE_COUNT_STAGES: StageId[] = ['04', '77', '118', '120']

export function countsTowardFinance(stage: StageId): boolean {
  return FINANCE_COUNT_STAGES.includes(stage)
}

export function repliedFromInquiryStatus(status: InquiryStatus): boolean {
  return status === 'contacted' || status === 'documents'
}
