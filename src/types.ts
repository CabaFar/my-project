export type StageId = '04' | '77' | '118' | '120'

export type DateFilter = 'today' | 'week' | 'month' | 'all'

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
