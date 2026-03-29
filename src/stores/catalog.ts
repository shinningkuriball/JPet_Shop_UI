import { ref } from 'vue'
import { defineStore } from 'pinia'
import { productApi } from '@/api'
import { useLocalOffShelfStore } from '@/stores/offShelfLocal'

export const useCatalogStore = defineStore('catalog', () => {
  const products = ref([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    try {
      const list = await productApi.list()
      products.value = Array.isArray(list) ? list : []
    } catch {
      products.value = []
    } finally {
      loading.value = false
    }
    useLocalOffShelfStore().applyToProducts(products.value)
    return products.value
  }

  function getById(id) {
    if (id == null) return undefined
    const sid = String(id)
    return products.value.find(
      (p) => p.id === id || String(p.id) === sid || String(p.spuId ?? '') === sid,
    )
  }

  function categories() {
    const cats = ['全部']
    products.value.forEach((product) => {
      if (product.category && !cats.includes(product.category)) {
        cats.push(product.category)
      }
    })
    return cats
  }

  return { products, loading, loadAll, getById, categories }
})
