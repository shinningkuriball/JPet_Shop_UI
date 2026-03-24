<script setup>
import { computed, onMounted, ref } from 'vue'
import ShopHeader from '@/components/ShopHeader.vue'
import ShopNav from '@/components/ShopNav.vue'
import { getImagePath } from '@/utils/imagePath'
import { useAuthStore } from '@/stores/auth'
import { useCartBadgeStore } from '@/stores/cartBadge'
import { useCatalogStore } from '@/stores/catalog'
import { merchantOrderApi } from '@/api/merchant'

import '@/styles/legacy/common.css'
import '@/styles/legacy/logistics.css'

const auth = useAuthStore()
const cartBadge = useCartBadgeStore()
const catalog = useCatalogStore()

const shippingTab = ref('unshipped')
const unshippedList = ref([])
const inTransitList = ref([])
const historyTab = ref('cancelled')
const cancelledList = ref([])
const arrivedList = ref([])
const selectedHistoryIds = ref([])

const detailOpen = ref(false)
const detailItem = ref(null)

const activeList = computed(() =>
  shippingTab.value === 'unshipped' ? unshippedList.value : inTransitList.value,
)

const activeHistoryList = computed(() =>
  historyTab.value === 'cancelled' ? cancelledList.value : arrivedList.value,
)

const selectedHistoryCount = computed(() => selectedHistoryIds.value.length)

function maskName(name) {
  if (!name) return '***'
  return `${name[0]}**`
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return '***'
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function openDetail(item) {
  detailItem.value = item
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailItem.value = null
}

function toggleHistorySelect(id, checked) {
  if (checked) {
    if (!selectedHistoryIds.value.includes(id)) selectedHistoryIds.value.push(id)
    return
  }
  selectedHistoryIds.value = selectedHistoryIds.value.filter((x) => x !== id)
}

function clearInvalidSelections() {
  const validIds = new Set(activeHistoryList.value.map((x) => Number(x.id)))
  selectedHistoryIds.value = selectedHistoryIds.value.filter((id) => validIds.has(id))
}

function switchHistoryTab(tab) {
  historyTab.value = tab
  clearInvalidSelections()
}

function deleteSelectedHistory() {
  if (!selectedHistoryIds.value.length) return
  const ids = new Set(selectedHistoryIds.value)
  if (historyTab.value === 'cancelled') {
    cancelledList.value = cancelledList.value.filter((x) => !ids.has(Number(x.id)))
  } else {
    arrivedList.value = arrivedList.value.filter((x) => !ids.has(Number(x.id)))
  }
  selectedHistoryIds.value = []
}

function onHistoryCheckboxChange(id, event) {
  toggleHistorySelect(id, event.target.checked)
}

function initMockLogisticsData() {
  const source = catalog.products.slice(0, 8)
  unshippedList.value = source.slice(0, 4).map((p, idx) => ({
    id: p.id,
    name: p.name,
    image: p.image,
    amount: Number(p.price || 0),
    destination: ['上海市 浦东新区', '广州市 天河区', '杭州市 西湖区', '武汉市 洪山区'][idx % 4],
    receiverName: ['王女士', '李先生', '陈先生', '赵女士'][idx % 4],
    receiverPhone: ['13800138000', '13911112222', '13722223333', '13633334444'][idx % 4],
    address: ['XX路88号', 'YY大道66号', 'ZZ街道9号', 'AA社区5栋'][idx % 4],
    createdAt: `2026-03-2${idx + 1} 1${idx}:3${idx}`,
  }))

  inTransitList.value = source.slice(4, 8).map((p, idx) => ({
    id: p.id,
    name: p.name,
    image: p.image,
    amount: Number(p.price || 0),
    trackingNo: `YD${Date.now().toString().slice(-6)}${idx}`,
    destination: ['北京市 朝阳区', '成都市 高新区', '南京市 鼓楼区', '西安市 雁塔区'][idx % 4],
    receiverName: ['孙女士', '周先生', '吴先生', '郑女士'][idx % 4],
    receiverPhone: ['13544445555', '13455556666', '13366667777', '13277778888'][idx % 4],
    currentNode: ['上海分拨中心', '杭州转运中心', '郑州分拨中心', '西安转运中心'][idx % 4],
    progress: ['已揽收', '运输中', '到达中转站', '派送中'][idx % 4],
    mapX: [20, 42, 58, 74][idx % 4],
    mapY: [64, 56, 42, 28][idx % 4],
    updatedAt: `2026-03-2${idx + 3} 1${idx}:1${idx}`,
  }))

  cancelledList.value = source.slice(0, 3).map((p, idx) => ({
    id: Number(`${p.id}1${idx}`),
    name: p.name,
    image: p.image,
    reason: idx % 2 === 0 ? '用户取消订单' : '库存不足自动取消',
    finishedAt: `2026-03-1${idx + 1} 1${idx}:2${idx}`,
  }))

  arrivedList.value = source.slice(3, 6).map((p, idx) => ({
    id: Number(`${p.id}2${idx}`),
    name: p.name,
    image: p.image,
    receiver: ['王**', '李**', '周**'][idx % 3],
    finishedAt: `2026-03-2${idx + 1} 0${idx}:3${idx}`,
  }))
}

onMounted(async () => {
  await catalog.loadAll()
  await auth.refresh()
  await cartBadge.refresh()
  try {
    const unshippedRes = await merchantOrderApi.list({ status: '待发货' })
    const inTransitRes = await merchantOrderApi.list({ status: '已发货' })
    const cancelledRes = await merchantOrderApi.listHistory({ status: '已取消' })
    const arrivedRes = await merchantOrderApi.listHistory({ status: '已完成' })
    unshippedList.value = unshippedRes.list
    inTransitList.value = inTransitRes.list
    cancelledList.value = cancelledRes.list
    arrivedList.value = arrivedRes.list
    if (
      !unshippedList.value.length &&
      !inTransitList.value.length &&
      !cancelledList.value.length &&
      !arrivedList.value.length
    ) {
      initMockLogisticsData()
    }
  } catch {
    initMockLogisticsData()
  }
})
</script>

<template>
  <div class="App">
    <ShopHeader />
    <ShopNav active="cart" />

    <div class="logistics-page">
      <section class="logistics-main-module">
        <div class="module-head">
          <h2>✅ 完成交易产品</h2>
          <div class="mini-tabs">
            <button
              type="button"
              class="mini-tab-btn"
              :class="{ active: shippingTab === 'unshipped' }"
              @click="shippingTab = 'unshipped'"
            >
              未寄出商品
            </button>
            <button
              type="button"
              class="mini-tab-btn"
              :class="{ active: shippingTab === 'in-transit' }"
              @click="shippingTab = 'in-transit'"
            >
              在途商品
            </button>
          </div>
        </div>

        <div class="shipping-grid">
          <div v-if="!activeList.length" class="empty-tip">暂无相关商品</div>
          <div v-for="item in activeList" v-else :key="`${shippingTab}-${item.id}`" class="ship-card" @click="openDetail(item)">
            <img :src="getImagePath(item.image)" :alt="item.name" class="ship-image" />
            <div class="ship-info">
              <h3>{{ item.name }}</h3>
              <p>目的地：{{ item.destination }}</p>
              <p v-if="shippingTab === 'unshipped'">待发货时间：{{ item.createdAt }}</p>
              <p v-else>当前节点：{{ item.currentNode }}</p>
              <div class="ship-price">¥{{ item.amount.toFixed(2) }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="logistics-history-module">
        <div class="module-head">
          <h2>📚 取消/已到达产品</h2>
          <div class="mini-tabs">
            <button
              type="button"
              class="mini-tab-btn"
              :class="{ active: historyTab === 'cancelled' }"
              @click="switchHistoryTab('cancelled')"
            >
              已取消
            </button>
            <button
              type="button"
              class="mini-tab-btn"
              :class="{ active: historyTab === 'arrived' }"
              @click="switchHistoryTab('arrived')"
            >
              已到达
            </button>
          </div>
        </div>

        <div class="history-body">
          <div class="history-list">
            <div v-if="!activeHistoryList.length" class="empty-tip">暂无相关记录</div>
            <label v-for="item in activeHistoryList" v-else :key="`h-${item.id}`" class="history-item">
              <input
                type="checkbox"
                class="history-checkbox"
                :checked="selectedHistoryIds.includes(item.id)"
                @change="onHistoryCheckboxChange(item.id, $event)"
              />
              <img :src="getImagePath(item.image)" :alt="item.name" class="history-image" />
              <div class="history-info">
                <h4>{{ item.name }}</h4>
                <p v-if="historyTab === 'cancelled'">取消原因：{{ item.reason }}</p>
                <p v-else>签收人：{{ item.receiver }}</p>
                <p>完成时间：{{ item.finishedAt }}</p>
              </div>
            </label>
          </div>

          <aside class="history-side">
            <div class="side-count">已勾选：{{ selectedHistoryCount }} 件</div>
            <button
              type="button"
              class="history-delete-btn"
              :disabled="selectedHistoryCount === 0"
              @click="deleteSelectedHistory"
            >
              删除
            </button>
          </aside>
        </div>
      </section>
    </div>

    <div v-if="detailOpen && detailItem" class="logistics-detail-overlay" @click="closeDetail">
      <div class="logistics-detail-modal" @click.stop>
        <button type="button" class="detail-close-btn" @click="closeDetail">✕</button>
        <h3>{{ shippingTab === 'unshipped' ? '未寄出商品详情' : '在途商品物流详情' }}</h3>

        <template v-if="shippingTab === 'unshipped'">
          <div class="detail-basic">
            <img :src="getImagePath(detailItem.image)" :alt="detailItem.name" />
            <div>
              <p><strong>商品：</strong>{{ detailItem.name }}</p>
              <p><strong>目的地：</strong>{{ detailItem.destination }}</p>
              <p><strong>收件人：</strong>{{ maskName(detailItem.receiverName) }}</p>
              <p><strong>联系方式：</strong>{{ maskPhone(detailItem.receiverPhone) }}</p>
              <p><strong>详细地址：</strong>{{ detailItem.address }}</p>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="logistics-map">
            <div class="map-grid"></div>
            <div class="route-line"></div>
            <div class="package-marker" :style="{ left: `${detailItem.mapX}%`, top: `${detailItem.mapY}%` }">📦</div>
            <div class="start-marker">仓库</div>
            <div class="end-marker">目的地</div>
          </div>
          <div class="detail-transport">
            <p><strong>运单号：</strong>{{ detailItem.trackingNo }}</p>
            <p><strong>物流状态：</strong>{{ detailItem.progress }}</p>
            <p><strong>当前节点：</strong>{{ detailItem.currentNode }}</p>
            <p><strong>最新时间：</strong>{{ detailItem.updatedAt }}</p>
            <p><strong>收件人：</strong>{{ maskName(detailItem.receiverName) }}（{{ maskPhone(detailItem.receiverPhone) }}）</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
