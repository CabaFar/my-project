export type StageId = '04' | '77' | '118' | '120'

export type DateFilter = 'today' | 'week' | 'month' | 'all'

export type HistoryAction =
  | 'create'
  | 'update'
  | 'move'
  | 'delete'
  | 'delete_stage'
  | 'target'

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  showroom: string
  financeAmount: number
  commission: number
  stage: StageId
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
