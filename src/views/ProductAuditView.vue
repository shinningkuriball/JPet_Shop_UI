<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ShopHeader from '@/components/ShopHeader.vue'
import ShopNav from '@/components/ShopNav.vue'
import { getImagePath } from '@/utils/imagePath'
import { useAuthStore } from '@/stores/auth'
import { useCartBadgeStore } from '@/stores/cartBadge'
import { useCatalogStore } from '@/stores/catalog'
import { merchantProductAuditApi } from '@/api/merchant'

import '@/styles/legacy/common.css'
import '@/styles/legacy/product-audit.css'

const auth = useAuthStore()
const cartBadge = useCartBadgeStore()
const catalog = useCatalogStore()

const pendingProducts = ref([])
const selectedPendingId = ref(null)
const previewSpec = ref('500g')
const createMode = ref(false)
const editingProductId = ref(null)
const attrInput = ref('')
const archivedTab = ref('off-shelf')
const offShelfProducts = ref([])
const failedProducts = ref([])
const uploadPreviewUrl = ref('')
const draftForm = ref({
  image: null,
  imageName: '',
  name: '',
  price: '',
  description: '',
  stock: 0,
  attributes: [],
})

const selectedPending = computed(() => {
  if (!pendingProducts.value.length) return null
  return (
    pendingProducts.value.find((x) => x.id === selectedPendingId.value) || pendingProducts.value[0] || null
  )
})

const reviewStats = computed(() => {
  const inReview = pendingProducts.value.length
  const approved = 0
  return { approved, inReview }
})

function selectPending(id) {
  createMode.value = false
  selectedPendingId.value = id
  const p = pendingProducts.value.find((x) => x.id === id)
  previewSpec.value = p?.specifications?.[0] || '500g'
}

function addStockDelta(delta) {
  const p = selectedPending.value
  if (!p) return
  p.stock = Math.max(0, Number(p.stock || 0) + delta)
}

function editCurrentPendingProduct() {
  const p = selectedPending.value
  if (!p) return
  createMode.value = true
  editingProductId.value = p.id
  if (uploadPreviewUrl.value) {
    URL.revokeObjectURL(uploadPreviewUrl.value)
    uploadPreviewUrl.value = ''
  }
  draftForm.value = {
    image: p.image || null,
    imageName: p.image ? '当前商品图片' : '',
    name: p.name || '',
    price: p.price ? String(p.price) : '',
    description: p.description || '',
    stock: Number(p.stock || 0),
    attributes: p.specifications ? [...p.specifications] : [],
  }
  attrInput.value = ''
}

async function withdrawCurrentRequest() {
  const p = selectedPending.value
  if (!p) return
  try {
    await merchantProductAuditApi.withdraw(p.id)
  } catch {
    alert('撤回失败，请稍后重试')
    return
  }
  const idx = pendingProducts.value.findIndex((x) => x.id === p.id)
  if (idx < 0) return
  pendingProducts.value.splice(idx, 1)
  failedProducts.value.unshift({
    ...p,
    status: 'failed',
    reason: '取消审核',
    submittedAt: '刚刚',
  })
  if (pendingProducts.value.length) {
    selectPending(pendingProducts.value[0].id)
  } else {
    selectedPendingId.value = null
  }
}

function openCreatePanel() {
  createMode.value = true
  editingProductId.value = null
  if (uploadPreviewUrl.value) {
    URL.revokeObjectURL(uploadPreviewUrl.value)
    uploadPreviewUrl.value = ''
  }
  const p = selectedPending.value
  draftForm.value = {
    image: null,
    imageName: '',
    name: p?.name || '',
    price: p?.price ? String(p.price) : '',
    description: '',
    stock: p?.stock || 0,
    attributes: [],
  }
  attrInput.value = ''
}

function onPickLocalImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }
  if (uploadPreviewUrl.value) URL.revokeObjectURL(uploadPreviewUrl.value)
  uploadPreviewUrl.value = URL.createObjectURL(file)
  draftForm.value.image = file
  draftForm.value.imageName = file.name
}

function addDraftAttribute() {
  const v = attrInput.value.trim()
  if (!v) return
  if (!draftForm.value.attributes.includes(v)) {
    draftForm.value.attributes.push(v)
  }
  attrInput.value = ''
}

function removeDraftAttribute(idx) {
  draftForm.value.attributes.splice(idx, 1)
}

async function submitNewProductReview() {
  if (!draftForm.value.image) {
    alert('请先从本地选择商品图片')
    return
  }
  if (!draftForm.value.name.trim()) {
    alert('请先输入商品名称')
    return
  }
  if (!draftForm.value.price || Number(draftForm.value.price) <= 0) {
    alert('请先输入有效价格')
    return
  }
  const imageForList =
    uploadPreviewUrl.value || (typeof draftForm.value.image === 'string' ? draftForm.value.image : '')

  if (editingProductId.value !== null) {
    const editingId = editingProductId.value
    let updatedFromApi = null
    try {
      updatedFromApi = await merchantProductAuditApi.update(editingId, {
        name: draftForm.value.name.trim(),
        price: Number(draftForm.value.price),
        stock: Number(draftForm.value.stock || 0),
        description: draftForm.value.description.trim(),
        specifications: [...draftForm.value.attributes],
      })
    } catch {
      alert('修改提交失败，请稍后重试')
      return
    }
    const idx = pendingProducts.value.findIndex((x) => x.id === editingProductId.value)
    if (idx >= 0) {
      pendingProducts.value[idx] = {
        ...pendingProducts.value[idx],
        ...(updatedFromApi || {}),
        name: draftForm.value.name.trim(),
        price: Number(draftForm.value.price),
        stock: Number(draftForm.value.stock || 0),
        description: draftForm.value.description.trim(),
        specifications: draftForm.value.attributes.length
          ? [...draftForm.value.attributes]
          : pendingProducts.value[idx].specifications,
        image: imageForList || pendingProducts.value[idx].image,
        status: 'reviewing',
        submittedAt: '刚刚',
      }
      selectedPendingId.value = pendingProducts.value[idx].id
    }
    createMode.value = false
    editingProductId.value = null
    alert('修改已提交，商品已重新进入审核队列')
    return
  }

  let createdFromApi = null
  try {
    createdFromApi = await merchantProductAuditApi.create({
      name: draftForm.value.name.trim(),
      price: Number(draftForm.value.price),
      stock: Number(draftForm.value.stock || 0),
      description: draftForm.value.description.trim(),
      status: '待审核',
      specifications: draftForm.value.attributes.length ? [...draftForm.value.attributes] : ['500g'],
    })
  } catch {
    alert('提交审核失败，请稍后重试')
    return
  }

  const newItemId = Date.now()
  pendingProducts.value.unshift({
    ...(createdFromApi || {}),
    id: createdFromApi?.id ?? newItemId,
    name: draftForm.value.name.trim(),
    price: Number(draftForm.value.price),
    stock: Number(draftForm.value.stock || 0),
    sales: 0,
    description: draftForm.value.description.trim() || '新商品待审核',
    image: imageForList || 'images/default-product.png',
    category: '新品',
    status: 'reviewing',
    submittedBy: '当前运营',
    submittedAt: '刚刚',
    specifications: draftForm.value.attributes.length ? [...draftForm.value.attributes] : ['500g'],
  })
  selectedPendingId.value = createdFromApi?.id ?? newItemId
  createMode.value = false
  alert('新商品已提交审核（草稿演示）')
}

function initMockAuditData() {
  const source = catalog.products.slice(0, 8)
  pendingProducts.value = source.map((p, idx) => ({
    ...p,
    status: idx % 5 === 0 ? 'reviewing' : 'pending',
    submittedBy: idx % 2 === 0 ? '运营小王' : '商家中心',
    submittedAt: `2026-03-2${(idx % 5) + 1} 1${idx}:2${idx}`,
    specifications:
      p.specifications && p.specifications.length ? p.specifications : ['500g', '1kg', '2kg', '5kg'],
  }))
  if (pendingProducts.value.length) {
    selectPending(pendingProducts.value[0].id)
  }
  offShelfProducts.value = source.slice(0, 3).map((p, idx) => ({
    ...p,
    reason: idx % 2 === 0 ? '库存清理中，暂时下架' : '商品策略调整，下架优化',
  }))
  failedProducts.value = source.slice(3, 6).map((p, idx) => ({
    ...p,
    reason: idx % 2 === 0 ? '图片信息不完整，请补全主图' : '属性字段不规范，请重新填写',
  }))
}

const archivedList = computed(() =>
  archivedTab.value === 'off-shelf' ? offShelfProducts.value : failedProducts.value,
)

function reopenProduct(product) {
  const idx = offShelfProducts.value.findIndex((x) => x.id === product.id)
  if (idx >= 0) {
    offShelfProducts.value.splice(idx, 1)
  }
}

function resubmitFailedProduct(product) {
  const idx = failedProducts.value.findIndex((x) => x.id === product.id)
  if (idx >= 0) {
    failedProducts.value.splice(idx, 1)
    pendingProducts.value.unshift({
      ...product,
      status: 'reviewing',
      submittedAt: '刚刚',
      reason: '',
    })
  }
}

function primaryArchivedAction(product) {
  if (archivedTab.value === 'failed') {
    resubmitFailedProduct(product)
    return
  }
  reopenProduct(product)
}

function removeArchivedProduct(product) {
  const idx = archivedList.value.findIndex((x) => x.id === product.id)
  if (idx >= 0) archivedList.value.splice(idx, 1)
}

onMounted(async () => {
  await catalog.loadAll()
  await auth.refresh()
  await cartBadge.refresh()
  try {
    const pendingRes = await merchantProductAuditApi.listPending()
    const offShelfRes = await merchantProductAuditApi.listOffShelf()
    const failedRes = await merchantProductAuditApi.listRejected()
    pendingProducts.value = pendingRes.list
    offShelfProducts.value = offShelfRes.list
    failedProducts.value = failedRes.list
    if (!pendingProducts.value.length && !offShelfProducts.value.length && !failedProducts.value.length) {
      initMockAuditData()
    } else if (pendingProducts.value.length) {
      selectPending(pendingProducts.value[0].id)
    }
  } catch {
    initMockAuditData()
  }
})

onUnmounted(() => {
  if (uploadPreviewUrl.value) URL.revokeObjectURL(uploadPreviewUrl.value)
})
</script>

<template>
  <div class="App">
    <ShopHeader />
    <ShopNav active="medical" />

    <div class="audit-page">
      <div class="audit-layout">
        <section class="audit-left">
          <div class="audit-stat-row">
            <span>待审核：{{ reviewStats.inReview }}</span>
            <span>已通过：{{ reviewStats.approved }}</span>
          </div>
          <div class="audit-list">
            <div
              v-for="item in pendingProducts"
              :key="item.id"
              class="audit-item"
              :class="{ active: selectedPending?.id === item.id }"
              @click="selectPending(item.id)"
            >
              <div class="audit-item-title">{{ item.name }}</div>
              <div class="audit-item-meta">
                <span>提交人：{{ item.submittedBy }}</span>
                <span>{{ item.submittedAt }}</span>
              </div>
              <div class="audit-item-status">{{ item.status }}</div>
            </div>
          </div>
          <div class="audit-actions">
            <button type="button" class="btn-primary" @click="openCreatePanel">上传新商品</button>
          </div>
        </section>

        <section class="audit-right" v-if="createMode">
          <div class="preview-phone">
            <div class="upload-image-box">
              <span class="upload-label">上传图片</span>
              <label class="local-upload-btn">
                从本地选择图片
                <input type="file" accept="image/*" @change="onPickLocalImage" />
              </label>
              <div class="upload-file-name">{{ draftForm.imageName || '尚未选择图片' }}</div>
              <img v-if="uploadPreviewUrl" :src="uploadPreviewUrl" alt="预览图" class="upload-preview-image" />
              <img
                v-else-if="typeof draftForm.image === 'string' && draftForm.image"
                :src="getImagePath(draftForm.image)"
                alt="当前商品图"
                class="upload-preview-image"
              />
            </div>
            <div class="create-form">
              <label class="form-label" for="newProductName">商品名称</label>
              <input id="newProductName" v-model="draftForm.name" type="text" placeholder="请输入商品名称" />
              <label class="form-label" for="newProductPrice">商品价格（元）</label>
              <input id="newProductPrice" v-model="draftForm.price" type="number" min="0" placeholder="请输入商品价格" />
              <label class="form-label" for="newProductStock">初始库存（件）</label>
              <input
                id="newProductStock"
                v-model.number="draftForm.stock"
                type="number"
                min="0"
                placeholder="请输入初始库存"
              />
              <label class="form-label" for="newProductDesc">商品描述</label>
              <textarea
                id="newProductDesc"
                v-model="draftForm.description"
                rows="4"
                placeholder="请输入商品描述"
              />
            </div>
            <div class="attr-editor">
              <div class="attr-title">添加属性</div>
              <div class="attr-input-row">
                <input
                  v-model="attrInput"
                  type="text"
                  placeholder="请输入属性值（如：无谷配方、5kg装、进口粮）"
                />
                <button type="button" @click="addDraftAttribute">添加</button>
              </div>
              <div class="attr-list">
                <span
                  v-for="(attr, idx) in draftForm.attributes"
                  :key="attr + idx"
                  class="attr-chip"
                  @click="removeDraftAttribute(idx)"
                >
                  {{ attr }} ×
                </span>
              </div>
            </div>
            <button type="button" class="submit-review-btn" @click="submitNewProductReview">提交审核</button>
          </div>
        </section>
        <section class="audit-right" v-else-if="selectedPending">
          <div class="preview-phone">
            <div class="preview-image-wrap">
              <img :src="getImagePath(selectedPending.image)" :alt="selectedPending.name" class="preview-image" />
            </div>
            <div class="preview-info">
              <h3>{{ selectedPending.name }}</h3>
              <p>{{ selectedPending.description || '暂无描述' }}</p>
              <div class="preview-price">¥{{ Number(selectedPending.price || 0).toFixed(2) }}</div>
            </div>
            <div class="preview-specs">
              <button
                v-for="sp in selectedPending.specifications"
                :key="sp"
                type="button"
                class="spec-chip"
                :class="{ active: previewSpec === sp }"
                @click="previewSpec = sp"
              >
                {{ sp }}
              </button>
            </div>
            <div class="preview-stock">
              <span>库存情况</span>
              <div class="stock-ctrl">
                <button type="button" @click="addStockDelta(-1)">-</button>
                <strong>{{ selectedPending.stock || 0 }}</strong>
                <button type="button" @click="addStockDelta(1)">+</button>
              </div>
            </div>
            <div class="pending-detail-actions">
              <button type="button" class="edit-info-btn" @click="editCurrentPendingProduct">
                修改相关信息
              </button>
              <button type="button" class="withdraw-btn" @click="withdrawCurrentRequest">撤回请求</button>
            </div>
          </div>
        </section>
        <section class="audit-right" v-else>
          <div class="preview-empty">暂无审核商品</div>
        </section>
      </div>

      <section class="archived-panel">
        <div class="archived-head">
          <h3>📦 已下架 / 审核失败产品</h3>
          <div class="archived-tabs">
            <button
              type="button"
              class="archived-tab-btn"
              :class="{ active: archivedTab === 'off-shelf' }"
              @click="archivedTab = 'off-shelf'"
            >
              已下架
            </button>
            <button
              type="button"
              class="archived-tab-btn"
              :class="{ active: archivedTab === 'failed' }"
              @click="archivedTab = 'failed'"
            >
              审核失败
            </button>
          </div>
        </div>

        <div class="archived-list">
          <div v-if="!archivedList.length" class="archived-empty">暂无数据</div>
          <div v-for="item in archivedList" v-else :key="`${archivedTab}-${item.id}`" class="archived-item">
            <div class="archived-main">
              <img :src="getImagePath(item.image)" :alt="item.name" class="archived-image" />
              <div class="archived-info">
                <div class="archived-title-row">
                  <h4>{{ item.name }}</h4>
                  <span class="archived-badge" :class="archivedTab === 'failed' ? 'failed' : 'off-shelf'">
                    {{ archivedTab === 'failed' ? '审核失败' : '已下架' }}
                  </span>
                </div>
                <p>{{ item.reason }}</p>
              </div>
            </div>
            <div class="archived-actions">
              <button type="button" class="reopen-btn" @click="primaryArchivedAction(item)">
                {{ archivedTab === 'failed' ? '重新提交审核' : '重新上架' }}
              </button>
              <button type="button" class="delete-btn" @click="removeArchivedProduct(item)">删除</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
