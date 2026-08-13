import type { Stage } from './types'

export const STAGES: Stage[] = [
  {
    id: '0',
    code: '0',
    title: 'طلبات جديدة',
    description: 'طلبات مبدئية واستفسارات — لا تُحتسب مبالغ التمويل حتى النقل لمرحلة 04',
  },
  {
    id: '04',
    code: '04',
    title: 'موافقة مبدئية',
    description: 'تم الحصول على الموافقة المبدئية للتمويل',
  },
  {
    id: '77',
    code: '77',
    title: 'عقد جاهز',
    description: 'العقد جاهز للتوقيع والإتمام',
  },
  {
    id: '118',
    code: '118',
    title: 'تم التمويل',
    description: 'اكتمل التمويل وصُرف المبلغ',
  },
  {
    id: '120',
    code: '120',
    title: 'تم الاستلام',
    description: 'تم استلام العميل / إتمام التسليم',
  },
]
