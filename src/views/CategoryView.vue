<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ShopHeader from '@/components/ShopHeader.vue'
import ShopNav from '@/components/ShopNav.vue'
import ProductDetailModal from '@/components/ProductDetailModal.vue'
import { getImagePath } from '@/utils/imagePath'
import { useCatalogStore } from '@/stores/catalog'
import { useLocalOffShelfStore } from '@/stores/offShelfLocal'
import { useRouter } from 'vue-router'
import { merchantSpuApi } from '@/api/merchant'

import '@/styles/legacy/common.css'
import '@/styles/legacy/productDetail.css'
import '@/styles/legacy/category.css'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const localOffShelf = useLocalOffShelfStore()

const selectedCategory = ref('全部')
const sortBy = ref('default')
const merchantProducts = ref([])
const remoteTotal = ref(0)
const pageNo = ref(1)
const pageSize = ref(12)
const loading = ref(false)
const usingRemote = ref(false)

const categoryButtons = computed(() => catalog.categories())
const totalPages = computed(() => Math.max(1, Math.ceil((remoteTotal.value || 0) / pageSize.value)))
const searchKeyword = computed(() => String(route.query.search || '').trim())

function getPurchaseCount(product) {
  const v = Number(product.purchaseCount ?? product.sales ?? 0)
  return Number.isFinite(v) ? v : 0
}

function getHeatScore(product) {
  const raw = product.heatScore
  if (raw !== undefined && raw !== null) {
    const v = Number(raw)
    if (Number.isFinite(v)) return v
  }
  return getPurchaseCount(product)
}

function getStockCount(product) {
  const v = Number(product.stockCount ?? product.stock ?? 0)
  return Number.isFinite(v) ? v : 0
}

function isOffShelf(product) {
  if (String(product?.status || '') === '已下架') return true
  // 接口可能把 status 刷回「已上架」，但本地下架 id 仍在；并让 computed 依赖 Pinia byId
  return localOffShelf.isRowMarkedOffShelf(product)
}

const filteredProducts = computed(() => {
  const sourceProducts = usingRemote.value ? merchantProducts.value : catalog.products
  let list =
    selectedCategory.value === '全部'
      ? [...sourceProducts]
      : sourceProducts.filter((p) => p.category === selectedCategory.value)

  if (!usingRemote.value && searchKeyword.value.length) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        (p.description && p.description.toLowerCase().includes(kw)),
    )
  }

  switch (sortBy.value) {
    case 'heat-asc':
      list.sort((a, b) => getHeatScore(a) - getHeatScore(b))
      break
    case 'heat-desc':
      list.sort((a, b) => getHeatScore(b) - getHeatScore(a))
      break
    case 'purchase-asc':
      list.sort((a, b) => getPurchaseCount(a) - getPurchaseCount(b))
      break
    case 'purchase-desc':
      list.sort((a, b) => getPurchaseCount(b) - getPurchaseCount(a))
      break
    default:
      break
  }

  // 下架商品固定放到列表最后（同组内保留当前排序）
  list.sort((a, b) => Number(isOffShelf(a)) - Number(isOffShelf(b)))

  if (!usingRemote.value) {
    const start = (pageNo.value - 1) * pageSize.value
    list = list.slice(start, start + pageSize.value)
  }

  return list
})

function selectCategory(cat) {
  selectedCategory.value = cat
  pageNo.value = 1
}

function clearFilter() {
  selectedCategory.value = '全部'
  sortBy.value = 'default'
  pageNo.value = 1
  router.replace({ path: '/category' })
}

const detailOpen = ref(false)
const detailProduct = ref(null)

function openProductDetail(p) {
  // 远程列表数据在 merchantProducts 里，必须与列表项同一引用，否则改 status 不会反映到卡片上
  if (usingRemote.value) {
    const fromMerchant = merchantProducts.value.find(
      (x) => x.id === p.id || String(x.id) === String(p.id),
    )
    if (fromMerchant) {
      detailProduct.value = fromMerchant
      detailOpen.value = true
      return
    }
  }
  const raw = catalog.getById(p.id)
  detailProduct.value = raw || p
  detailOpen.value = true
}

function mapSortParams() {
  switch (sortBy.value) {
    case 'heat-asc':
      return { sortField: 'heat', sortOrder: 'asc' }
    case 'heat-desc':
      return { sortField: 'heat', sortOrder: 'desc' }
    case 'purchase-asc':
      return { sortField: 'purchaseCount', sortOrder: 'asc' }
    case 'purchase-desc':
      return { sortField: 'purchaseCount', sortOrder: 'desc' }
    default:
      return {}
  }
}

async function loadRemoteProducts() {
  loading.value = true
  try {
    const pageData = await merchantSpuApi.list({
      page: pageNo.value,
      size: pageSize.value,
      keyword: searchKeyword.value || undefined,
      category: selectedCategory.value === '全部' ? undefined : selectedCategory.value,
      ...mapSortParams(),
    })
    usingRemote.value = true
    remoteTotal.value = pageData.total
    merchantProducts.value = pageData.list.map((item) => ({
      ...item,
      category: item.tags?.[0] || '全部',
      image: item.image,
      price: item.minPrice ?? item.price,
      stock: item.skus?.reduce((sum, sku) => sum + Number(sku.stock || 0), 0),
      purchaseCount: item.purchaseCount ?? 0,
      heatScore: item.heatScore ?? item.purchaseCount ?? 0,
      specifications: item.skus?.map((sku) =>
        Object.entries(sku.attributes || {})
          .map(([k, v]) => `${k}:${v}`)
          .join('/'),
      ),
    }))
    localOffShelf.applyToProducts(merchantProducts.value)
  } catch {
    usingRemote.value = false
    merchantProducts.value = []
    const localList = selectedCategory.value === '全部'
      ? catalog.products
      : catalog.products.filter((p) => p.category === selectedCategory.value)
    remoteTotal.value = localList.length
  } finally {
    loading.value = false
  }
}

function prevPage() {
  if (pageNo.value <= 1) return
  pageNo.value -= 1
}

function nextPage() {
  if (pageNo.value >= totalPages.value) return
  pageNo.value += 1
}

onMounted(async () => {
  await catalog.loadAll()
  await loadRemoteProducts()
})

watch(
  [() => route.query.search, selectedCategory, sortBy, pageNo, pageSize],
  async () => {
    await loadRemoteProducts()
  },
)

watch(pageSize, () => {
  pageNo.value = 1
})
</script>

<template>
  <div class="App">
    <ShopHeader />
    <ShopNav active="category" />

    <div class="kinds-ui-box">
      <div class="head-tag-box">
        <div class="category-tags">
          <span class="head-tag-text">商品分类：</span>
          <div id="categoryButtons">
            <button
              v-for="(cat, index) in categoryButtons"
              :key="cat"
              type="button"
              class="category-btn"
              :class="{ active: selectedCategory === cat }"
              :style="{ '--index': index }"
              @click="selectCategory(cat)"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <div class="selected-filters">
          <span class="head-tag-text">当前筛选：</span>
          <span id="selectedCategory" class="head-tag-text-selected">{{ selectedCategory }}</span>
          <button
            v-show="selectedCategory !== '全部'"
            id="clearFilterBtn"
            type="button"
            class="head-tag-btn-clear"
            @click="clearFilter"
          >
            清空筛选
          </button>
        </div>
      </div>

      <div class="filter-select-box">
        <span class="filter-select-text">排序方式：</span>
        <select id="sortSelect" v-model="sortBy" class="filter-select-select">
          <option value="default">默认排序</option>
          <option value="heat-asc">按热度递增</option>
          <option value="heat-desc">按热度递减</option>
          <option value="purchase-asc">按购买量递增</option>
          <option value="purchase-desc">按购买量递减</option>
        </select>
      </div>

      <div id="productList" class="kinds-list-box">
        <div v-if="loading" class="no-products">商品加载中...</div>
        <div v-else-if="!filteredProducts.length" class="no-products">暂无商品</div>
        <div
          v-for="product in filteredProducts"
          v-else
          :key="product.id"
          class="kinds-item"
          :class="{ 'kinds-item-off-shelf': isOffShelf(product) }"
        >
          <img
            :src="getImagePath(product.image)"
            :alt="product.name"
            style="cursor: pointer"
            @click="openProductDetail(product)"
          />
          <div class="kinds-item-info">
            <h4 class="kinds-item-name" style="cursor: pointer" @click="openProductDetail(product)">
              {{ product.name }}
            </h4>
            <p class="kinds-item-description">{{ product.description }}</p>
            <div class="kinds-item-metrics">
              <span>购买人数：{{ getPurchaseCount(product) }}</span>
              <span>热度：{{ getHeatScore(product) }}</span>
              <span>库存：{{ getStockCount(product) }}</span>
            </div>
            <div class="kinds-item-footer">
              <span class="kinds-item-price">¥{{ Number(product.price || 0).toFixed(0) }}</span>
              <span v-if="isOffShelf(product)" class="kinds-item-status-tag">已下架</span>
            </div>
          </div>
        </div>
      </div>

      <div class="kinds-pagination">
        <button type="button" class="page-btn" :disabled="pageNo <= 1" @click="prevPage">上一页</button>
        <span class="page-text">第 {{ pageNo }} / {{ totalPages }} 页（共 {{ remoteTotal }} 条）</span>
        <button type="button" class="page-btn" :disabled="pageNo >= totalPages" @click="nextPage">下一页</button>
        <select v-model.number="pageSize" class="page-size-select">
          <option :value="8">8条/页</option>
          <option :value="12">12条/页</option>
          <option :value="16">16条/页</option>
        </select>
      </div>
    </div>

    <ProductDetailModal v-model="detailOpen" :product="detailProduct" />
  </div>
</template>
