<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ShopHeader from '@/components/ShopHeader.vue'
import ShopNav from '@/components/ShopNav.vue'
import ProductDetailModal from '@/components/ProductDetailModal.vue'
import { getImagePath } from '@/utils/imagePath'
import { getContextPath } from '@/utils/context'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useCartBadgeStore } from '@/stores/cartBadge'

import '@/styles/legacy/common.css'
import '@/styles/legacy/productDetail.css'
import '@/styles/legacy/index.css'

const ctx = getContextPath()
const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()
const cartBadge = useCartBadgeStore()

const bannerData = [
  {
    image: getImagePath('images/沙发小猫.jpg'),
    title: '温暖陪伴，舒适生活',
    subtitle: '给毛孩子一个温馨的家',
  },
  {
    image: getImagePath('images/草地小狗.jpg'),
    title: '自由奔跑，快乐成长',
    subtitle: '让爱宠享受健康快乐每一天',
  },
  {
    image: getImagePath('images/yL1CSVRwjzJExhRPqQt0nw3c3bf89dd6ed5b79d3ddfd7e5634345a.jpg'),
    title: '优质宠物用品专家',
    subtitle: '为爱宠精选每一件好物',
  },
]

const currentBannerIndex = ref(0)
const bannerTitle = computed(() => bannerData[currentBannerIndex.value].title)
const bannerSubtitle = computed(() => bannerData[currentBannerIndex.value].subtitle)
const bannerImage = computed(() => bannerData[currentBannerIndex.value].image)

let bannerTimer = null

function prevBanner() {
  currentBannerIndex.value =
    (currentBannerIndex.value - 1 + bannerData.length) % bannerData.length
}

function nextBanner() {
  currentBannerIndex.value = (currentBannerIndex.value + 1) % bannerData.length
}

function gotoBanner(i) {
  currentBannerIndex.value = i
}

function startBannerAutoPlay() {
  if (bannerTimer) clearInterval(bannerTimer)
  bannerTimer = setInterval(nextBanner, 3000)
}

const buyerReviewSeeds = [
  {
    user: '铲屎官小王',
    rating: 5,
  },
  {
    user: '狗狗的麻麻',
    rating: 5,
  },
  {
    user: '猫奴小李',
    rating: 4,
  },
  {
    user: '铲屎官小张',
    rating: 5,
  },
  {
    user: '喵主子守护者',
    rating: 4,
  },
]

function buildReviewContent(product, index) {
  const templates = [
    `买了“${product.name}”后使用感受很好，做工和细节都很到位，家里毛孩子很喜欢。`,
    `“${product.name}”到货后立刻试用了，质量和页面描述一致，性价比不错。`,
    `这款“${product.name}”比我预期更实用，日常照顾宠物更省心。`,
    `“${product.name}”外观和实用性都在线，连续用了几天体验很稳定。`,
    `对“${product.name}”整体满意，材质和手感都不错，推荐给养宠朋友。`,
  ]
  return templates[index % templates.length]
}

const hotProducts = computed(() => catalog.products.slice(0, 4))
const hotProductsWithMetrics = computed(() =>
  hotProducts.value.map((product, index) => {
    const purchaseCount = Number(product.sales || 0)
    const stockCount = Number(product.stock || 0)
    const heatScore = Math.max(1, Math.round(purchaseCount / 20) + (index < 2 ? 2 : 1))
    return { ...product, purchaseCount, stockCount, heatScore }
  }),
)

const buyerReviews = computed(() =>
  hotProductsWithMetrics.value.map((product, index) => {
    const seed = buyerReviewSeeds[index % buyerReviewSeeds.length]
    return {
      ...seed,
      content: buildReviewContent(product, index),
      productName: product.name,
      productImage: product.image,
    }
  }),
)

const detailOpen = ref(false)
const detailProduct = ref(null)

function openProductDetail(product) {
  detailProduct.value = product
  detailOpen.value = true
}

function closeProductDetail() {
  detailOpen.value = false
}

const buyerChatRows = computed(() =>
  [
    {
      type: 'official',
      name: '官方管理员',
      avatar: '🏢',
      role: '官方',
      lastMessage: '订单异常、违规举报、平台规则可联系官方处理',
      unread: 1,
    },
    ...buyerReviews.value.map((review, index) => ({
      type: 'buyer',
      name: review.user,
      avatar: ['🧑', '👩', '👨', '🧕', '👱'][index % 5],
      role: '买家',
      lastMessage: `关于“${review.productName}”的评价与咨询`,
      unread: index < 2 ? 1 : 0,
    })),
  ],
)

function getStoreNameByCategory(category) {
  const storeMap = {
    猫咪用品: '喵星人专卖店',
    狗狗用品: '汪星人生活馆',
    饮食用品: '宠物营养中心',
    出行用品: '宠物出行专家',
    狗狗: '宠物之家',
  }
  return storeMap[category] || '宠物用品店'
}

function getStoreAvatar(category) {
  const avatarMap = {
    猫咪用品: '🐱',
    狗狗用品: '🐶',
    饮食用品: '🍖',
    出行用品: '✈️',
    狗狗: '🏠',
  }
  return avatarMap[category] || '🏪'
}

function openChat(type, name) {
  sessionStorage.setItem('chatType', type)
  sessionStorage.setItem('chatName', name)
  router.push('/chat')
}

const searchInput = ref('')
const suggestions = ref([])
const suggestionsVisible = ref(false)
let searchTimeout = null

function hideSuggestions() {
  suggestionsVisible.value = false
}

function searchProductsForAutocomplete(keyword) {
  if (!keyword?.trim()) {
    hideSuggestions()
    return
  }
  fetch(`${ctx}/api/products?keyword=${encodeURIComponent(keyword.trim())}`, {
    credentials: 'include',
  })
    .then((r) => r.json())
    .then((result) => {
      if (result.code === 200 && result.data) {
        suggestions.value = result.data.slice(0, 10)
        suggestionsVisible.value = true
      } else hideSuggestions()
    })
    .catch(() => hideSuggestions())
}

function onSearchInput() {
  const keyword = searchInput.value.trim()
  clearTimeout(searchTimeout)
  if (!keyword) {
    hideSuggestions()
    return
  }
  searchTimeout = setTimeout(() => searchProductsForAutocomplete(keyword), 300)
}

function highlightKeyword(text, keyword) {
  if (!keyword) return text
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

function selectSuggestion(product) {
  hideSuggestions()
  openProductDetail(product)
}

function performSearch() {
  const keyword = searchInput.value.trim()
  hideSuggestions()
  if (!keyword) {
    alert('请输入搜索关键词')
    return
  }
  router.push({ path: '/category', query: { search: keyword } })
}

function onDocClick(e) {
  const el = e.target
  if (!el.closest?.('.search-box-wrapper')) hideSuggestions()
}

const tooltip = ref(null)
const tooltipStyle = ref({})
let tooltipTimeout = null

function showProductTooltip(event, product) {
  clearTimeout(tooltipTimeout)
  tooltip.value = product
  tooltipStyle.value = { left: `${event.pageX + 20}px`, top: `${event.pageY + 20}px` }
}

function hideProductTooltip() {
  tooltipTimeout = setTimeout(() => {
    tooltip.value = null
  }, 200)
}

function onTooltipEnter() {
  clearTimeout(tooltipTimeout)
}

const friendWrapper = ref(null)

onMounted(async () => {
  document.addEventListener('click', onDocClick)
  await catalog.loadAll()
  startBannerAutoPlay()
  await auth.refresh()
  await cartBadge.refresh()

  const wrapper = friendWrapper.value
  const scroller = wrapper?.querySelector?.('#friendPostsScroller')
  if (wrapper && scroller) {
    const posts = Array.from(scroller.children)
    if (posts.length) {
      posts.forEach((post) => scroller.appendChild(post.cloneNode(true)))
    }
    let isPaused = false
    let touchTimeoutId = null
    const pause = () => {
      if (isPaused) return
      scroller.style.animationPlayState = 'paused'
      isPaused = true
    }
    const resume = () => {
      if (!isPaused) return
      scroller.style.animationPlayState = 'running'
      isPaused = false
    }
    wrapper.addEventListener('mouseenter', pause)
    wrapper.addEventListener('mouseleave', resume)
    wrapper.addEventListener(
      'touchstart',
      () => {
        pause()
        if (touchTimeoutId) clearTimeout(touchTimeoutId)
      },
      { passive: true },
    )
    wrapper.addEventListener('touchend', () => {
      if (touchTimeoutId) clearTimeout(touchTimeoutId)
      touchTimeoutId = setTimeout(resume, 1200)
    })
  }
})

watch(
  () => auth.user,
  () => {
    cartBadge.refresh()
  },
)

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  if (bannerTimer) clearInterval(bannerTimer)
})
</script>

<template>
  <div class="App">
    <ShopHeader floating-pets />
    <ShopNav active="index" />

    <div class="user-info-bar">
      <span class="welcome-text">欢迎，{{ auth.welcomeUsername }}</span>
      <a class="logout-btn" :href="ctx + '/user/logout'">退出登录</a>
    </div>

    <div class="search-bar-container">
      <div class="search-box-wrapper">
        <input
          id="productSearchInput"
          v-model="searchInput"
          type="text"
          class="search-input"
          placeholder="搜索商品名称..."
          autocomplete="off"
          @input="onSearchInput"
          @keydown.enter.prevent="performSearch"
          @keydown.esc="hideSuggestions"
        />
        <button type="button" class="search-button" @click="performSearch">🔍</button>
        <div
          v-show="suggestionsVisible"
          id="searchSuggestions"
          class="search-suggestions"
        >
          <div v-if="!suggestions.length" class="no-suggestions">未找到相关商品</div>
          <div
            v-for="p in suggestions"
            v-else
            :key="p.id"
            class="search-suggestion-item"
            @click="selectSuggestion(p)"
          >
            <img :src="getImagePath(p.image)" :alt="p.name" class="suggestion-image" />
            <div class="suggestion-info">
              <div class="suggestion-name" v-html="highlightKeyword(p.name, searchInput.trim())" />
              <div class="suggestion-price">¥{{ Number(p.price).toFixed(2) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="shop-head-box">
      <div class="banner-title">
        <h2 id="bannerTitle">{{ bannerTitle }}</h2>
        <p id="bannerSubtitle" class="banner-subtitle">{{ bannerSubtitle }}</p>
      </div>
      <img id="bannerImage" :src="bannerImage" alt="轮播图" class="banner-image" />
      <button type="button" class="banner-btn-left" @click="prevBanner">‹</button>
      <button type="button" class="banner-btn-right" @click="nextBanner">›</button>
      <div id="bannerIndicators" class="banner-indicators">
        <span
          v-for="(_, i) in bannerData"
          :key="i"
          class="indicator"
          :class="{ active: i === currentBannerIndex }"
          @click="gotoBanner(i)"
        />
      </div>
    </div>

    <div class="shop-main-ui">
      <div ref="friendWrapper" class="left-pyq-box">
        <h3>📝 商品用户评价</h3>
        <div id="friendPostsWrapper" class="friend-posts-wrapper">
          <div id="friendPostsScroller" class="friend-posts-scroller">
            <div v-for="(review, idx) in buyerReviews" :key="idx" class="friend-post review-item">
              <img
                :src="getImagePath(review.productImage)"
                :alt="review.productName"
                class="friend-product-image"
              />
              <div class="friend-header">
                <img :src="getImagePath('images/logo192.png')" alt="" class="friend-avatar" />
                <span class="friend-name">{{ review.user }}</span>
              </div>
              <div class="review-product">商品：{{ review.productName }}</div>
              <div class="review-rating">评分：{{ '★'.repeat(review.rating) }}</div>
              <p class="friend-message">{{ review.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="center-goods-box">
        <h3>🔥 热销宠物用品</h3>
        <div id="productGrid" class="goods-grid">
          <div v-if="!hotProducts.length" class="no-products">暂无商品</div>
          <div
            v-for="product in hotProductsWithMetrics"
            v-else
            :key="product.id"
            class="goods-item"
            @mouseenter="showProductTooltip($event, product)"
            @mouseleave="hideProductTooltip"
            @click="openProductDetail(product)"
          >
            <img
              :src="getImagePath(product.image)"
              :alt="product.name"
              style="cursor: pointer"
              @click="openProductDetail(product)"
            />
            <h4 style="cursor: pointer" @click="openProductDetail(product)">{{ product.name }}</h4>
            <p class="goods-description">{{ product.description }}</p>
            <div class="goods-metrics">
              <span>购买人数：{{ product.purchaseCount }}</span>
              <span>热度：{{ product.heatScore }}</span>
              <span>库存：{{ product.stockCount }}</span>
            </div>
            <div class="goods-footer">
              <span class="goods-price">¥{{ product.price }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="right-customer-service-message-box">
        <h3>💬 联系买家列表</h3>
        <div class="service-list">
          <div
            v-for="s in buyerChatRows"
            :key="s.name"
            class="service-item"
            @click="openChat(s.type, s.name)"
          >
            <div class="service-avatar">
              <span class="avatar-icon">{{ s.avatar }}</span>
            </div>
            <div class="service-info">
              <div class="service-name">
                {{ s.name }}
                <span class="service-role">{{ s.role }}</span>
              </div>
              <div class="service-last-message">{{ s.lastMessage }}</div>
            </div>
            <div class="service-badge" v-if="s.unread">
              <span class="unread-count">{{ s.unread }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ProductDetailModal v-model="detailOpen" :product="detailProduct" @close="closeProductDetail" />

    <div
      v-if="tooltip"
      id="productTooltip"
      class="product-tooltip"
      :style="tooltipStyle"
      @mouseenter="onTooltipEnter"
      @mouseleave="hideProductTooltip"
    >
      <div class="tooltip-header">
        <h3>{{ tooltip.name }}</h3>
        <span class="tooltip-price">¥{{ Number(tooltip.price).toFixed(2) }}</span>
      </div>
      <div class="tooltip-content">
        <p class="tooltip-description">{{ tooltip.description || '暂无描述' }}</p>
        <div class="tooltip-specs">
          <span v-if="tooltip.category">类别：{{ tooltip.category }}</span>
          <span v-if="tooltip.stock !== undefined">库存：{{ tooltip.stock }}</span>
          <span v-if="tooltip.sales !== undefined">已售：{{ tooltip.sales }}</span>
        </div>
      </div>
      <div class="tooltip-footer">
        <button type="button" class="tooltip-btn" @click="openProductDetail(tooltip)">查看详情</button>
      </div>
    </div>
  </div>
</template>
