import http from './http'
import type {
  MerchantAuthPayload,
  MerchantOrder,
  MerchantProductItem,
  MerchantProfile,
  MerchantProfilePayload,
  MerchantSpuListQuery,
  MerchantSpu,
  MerchantStats,
  PageQuery,
  PageResult,
} from '@/types/merchant'

function unwrap<T = unknown>(response: any): T {
  const data = response?.data
  if (data && typeof data === 'object' && 'data' in data) {
    return data.data as T
  }
  return data as T
}

function unwrapPage<T = unknown>(response: any): PageResult<T> {
  const raw = unwrap<any>(response)
  if (Array.isArray(raw)) {
    return {
      list: raw as T[],
      total: raw.length,
      page: 1,
      size: raw.length || 10,
    }
  }
  const list = Array.isArray(raw?.list) ? raw.list : []
  return {
    list,
    total: Number(raw?.total ?? list.length ?? 0),
    page: Number(raw?.page ?? 1),
    size: Number(raw?.size ?? 10),
  }
}

export const merchantApi = {
  getProfile() {
    return http.get('/api/merchant/profile').then((res) => unwrap<MerchantProfile>(res))
  },
  updateProfile(payload: MerchantProfilePayload) {
    return http.put('/api/merchant/profile', payload).then((res) => unwrap<MerchantProfile>(res))
  },
  getStats() {
    return http.get('/api/merchant/stats').then((res) => unwrap<MerchantStats>(res))
  },
  submitAuth(payload: MerchantAuthPayload) {
    const form = new FormData()
    form.append('companyName', payload.companyName)
    form.append('certificate', payload.certificate)
    return http.post('/api/merchant/auth/apply', form).then((res) => unwrap(res))
  },
}

export const merchantOrderApi = {
  list(params: PageQuery & Record<string, any> = {}) {
    return http.get('/api/merchant/orders', { params }).then((res) => unwrapPage<MerchantOrder>(res))
  },
  listHistory(params: PageQuery & Record<string, any> = {}) {
    return http.get('/api/merchant/orders/history', { params }).then((res) => unwrapPage<MerchantOrder>(res))
  },
}

export const merchantProductAuditApi = {
  listPending(params: PageQuery & Record<string, any> = {}) {
    return http.get('/api/merchant/products/pending', { params }).then((res) => unwrapPage<MerchantProductItem>(res))
  },
  listOffShelf() {
    return http.get('/api/merchant/products/off-shelf').then((res) => unwrapPage<MerchantProductItem>(res))
  },
  listRejected() {
    return http.get('/api/merchant/products/rejected').then((res) => unwrapPage<MerchantProductItem>(res))
  },
  create(payload: Record<string, any>) {
    return http.post('/api/merchant/products', payload).then((res) => unwrap<MerchantProductItem>(res))
  },
  update(id: string | number, payload: Record<string, any>) {
    return http.put(`/api/merchant/products/${id}`, payload).then((res) => unwrap<MerchantProductItem>(res))
  },
  withdraw(id: string | number) {
    return http.post(`/api/merchant/products/${id}/withdraw`).then((res) => unwrap(res))
  },
}

export const merchantSpuApi = {
  list(params: MerchantSpuListQuery = {}) {
    return http.get('/api/merchant/spu', { params }).then((res) => unwrapPage<MerchantSpu>(res))
  },
  getById(id: string | number) {
    return http.get(`/api/merchant/spu/${id}`).then((res) => unwrap<MerchantSpu>(res))
  },
  create(payload: MerchantSpu) {
    return http.post('/api/merchant/spu', payload).then((res) => unwrap<MerchantSpu>(res))
  },
  update(id: string | number, payload: Partial<MerchantSpu>) {
    return http.put(`/api/merchant/spu/${id}`, payload).then((res) => unwrap<MerchantSpu>(res))
  },
  remove(id: string | number) {
    return http.delete(`/api/merchant/spu/${id}`).then((res) => unwrap(res))
  },
}
