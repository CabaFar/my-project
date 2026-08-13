export type StageId = '0' | '04' | '77' | '118' | '120'

export type DateFilter = 'today' | 'week' | 'month' | 'all'

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
  /** Whether the salesperson has replied to the customer (mainly for stage 0 inquiries). */
  replied: boolean
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
