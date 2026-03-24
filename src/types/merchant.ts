export interface MerchantProfile {
  id?: number
  merchantName: string
  email?: string
  phone?: string
  registerTime?: string
  introduction: string
  avatarUrl?: string
  verifiedName?: string
  tags?: string[]
}

export interface MerchantStats {
  monthRevenue: number
  trendPercent: number
  rating: number
}

export interface MerchantProfilePayload {
  merchantName: string
  introduction: string
  email?: string
  phone?: string
  tags?: string[]
}

export interface MerchantAuthPayload {
  companyName: string
  certificate: File
}

export interface MerchantOrder {
  id: number | string
  name: string
  image?: string
  amount?: number
  destination?: string
  receiverName?: string
  receiverPhone?: string
  address?: string
  createdAt?: string
  trackingNo?: string
  currentNode?: string
  progress?: string
  mapX?: number
  mapY?: number
  updatedAt?: string
  reason?: string
  receiver?: string
  finishedAt?: string
}

export interface MerchantProductItem {
  id: number | string
  name: string
  image?: string
  price?: number
  stock?: number
  description?: string
  status?: string
  submittedBy?: string
  submittedAt?: string
  specifications?: string[]
  reason?: string
}

export interface PageQuery {
  page?: number
  size?: number
  keyword?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
}

export interface MerchantSku {
  id?: number | string
  skuCode?: string
  image?: string
  price: number
  stock: number
  status: '可售卖' | '不可售卖'
  attributes: Record<string, string>
}

export interface MerchantSpu {
  id?: number | string
  name: string
  description?: string
  image?: string
  status: '草稿' | '待审核' | '已上架' | '已下架' | '已拒绝'
  rejectReason?: string
  tags?: string[]
  category?: string
  minPrice?: number
  price?: number
  stock?: number
  purchaseCount?: number
  heatScore?: number
  attributes?: string[]
  specifications?: string[]
  skus?: MerchantSku[]
}

export interface MerchantSpuListQuery extends PageQuery {
  category?: string
  status?: string
  tag?: string
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}
