<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import ShopHeader from '@/components/ShopHeader.vue'
import ShopNav from '@/components/ShopNav.vue'
import { getContextPath } from '@/utils/context'
import { getImagePath } from '@/utils/imagePath'
import { useAuthStore } from '@/stores/auth'
import { useCartBadgeStore } from '@/stores/cartBadge'
import { merchantApi } from '@/api/merchant'

import '@/styles/legacy/common.css'
import '@/styles/legacy/merchant-center.css'

const ctx = getContextPath()
const auth = useAuthStore()
const cartBadge = useCartBadgeStore()

const userInfo = reactive({
  name: '',
  email: '',
  phone: '',
  registerTime: '',
  introduction: '主营宠物用品与精选服务，支持同城快速发货与售后保障。',
})

const isEditing = ref(false)
const editButtonsHtml = ref('edit')
const storeStats = reactive({
  monthRevenue: 128560,
  trendPercent: 12.6,
  rating: 4.7,
})

const trendLabel = ref('')
const trendClass = ref('')
const ratingText = ref('')
const authModalOpen = ref(false)
const authForm = reactive({
  companyName: '',
  certificateFile: null,
  certificateFileName: '',
  certificatePreviewUrl: '',
})

function loadUserInfo() {
  const saved = localStorage.getItem('userInfo')
  if (saved) {
    try {
      Object.assign(userInfo, JSON.parse(saved))
    } catch {
      /* ignore */
    }
  }
  if (auth.user?.username && !userInfo.name) {
    userInfo.name = auth.user.username
  }
}

async function loadMerchantProfile() {
  try {
    const profile = await merchantApi.getProfile()
    if (profile) {
      userInfo.name = profile.merchantName || userInfo.name
      userInfo.email = profile.email || userInfo.email
      userInfo.phone = profile.phone || userInfo.phone
      userInfo.registerTime = profile.registerTime || userInfo.registerTime
      userInfo.introduction = profile.introduction || userInfo.introduction
    }
  } catch {
    // 接口未就绪时回退本地缓存
    loadUserInfo()
  }
}

function enableEdit() {
  isEditing.value = true
  editButtonsHtml.value = 'save'
}

function cancelEdit() {
  isEditing.value = false
  editButtonsHtml.value = 'edit'
  loadUserInfo()
}

async function saveUserInfo() {
  const payload = {
    merchantName: userInfo.name,
    email: userInfo.email,
    phone: userInfo.phone,
    introduction: userInfo.introduction,
  }
  try {
    await merchantApi.updateProfile(payload)
  } catch {
    localStorage.setItem('userInfo', JSON.stringify({ ...userInfo }))
  }
  cancelEdit()
  alert('保存成功！')
}

function changeAvatar() {
  alert('头像更换功能开发中...')
}

function openOfficialAuthModal() {
  authModalOpen.value = true
}

function closeOfficialAuthModal() {
  authModalOpen.value = false
}

function onPickCertificate(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('请上传图片格式的证书文件')
    return
  }
  if (authForm.certificatePreviewUrl) {
    URL.revokeObjectURL(authForm.certificatePreviewUrl)
  }
  authForm.certificateFile = file
  authForm.certificateFileName = file.name
  authForm.certificatePreviewUrl = URL.createObjectURL(file)
}

async function submitOfficialAuth() {
  if (!authForm.companyName.trim()) {
    alert('请先填写公司名称')
    return
  }
  if (!authForm.certificateFile) {
    alert('请先上传相关证书图片')
    return
  }
  try {
    await merchantApi.submitAuth({
      companyName: authForm.companyName.trim(),
      certificate: authForm.certificateFile,
    })
    alert('提交申请成功，等待平台审核')
  } catch {
    alert('申请已暂存（演示模式），待后端接口联调后将正式提交')
  }
  closeOfficialAuthModal()
}

function menuAlert(msg) {
  alert(msg)
}

function logout() {
  if (confirm('确定要退出登录吗？')) {
    window.location.href = `${ctx}/user/logout`
  }
}

onMounted(async () => {
  await auth.refresh()
  await cartBadge.refresh()
  await loadMerchantProfile()

  try {
    const stats = await merchantApi.getStats()
    if (stats) {
      storeStats.monthRevenue = Number(stats.monthRevenue || 0)
      storeStats.trendPercent = Number(stats.trendPercent || 0)
      storeStats.rating = Number(stats.rating || 0)
    }
  } catch {
    // 忽略，使用本地默认值
  }

  if (storeStats.trendPercent >= 0) {
    trendClass.value = 'up'
    trendLabel.value = `较上月增长 ${storeStats.trendPercent.toFixed(1)}%`
  } else {
    trendClass.value = 'down'
    trendLabel.value = `较上月下降 ${Math.abs(storeStats.trendPercent).toFixed(1)}%`
  }

  if (storeStats.rating >= 4.5) ratingText.value = '好评如潮'
  else if (storeStats.rating >= 3.5) ratingText.value = '褒贬不一'
  else ratingText.value = '一般'
})

onUnmounted(() => {
  if (authForm.certificatePreviewUrl) {
    URL.revokeObjectURL(authForm.certificatePreviewUrl)
  }
})
</script>

<template>
  <div class="App">
    <ShopHeader />
    <ShopNav active="profile" />

    <div class="user-box">
      <div class="user-header">
        <h2 class="user-header-text">个人中心</h2>
        <div id="editButtons">
          <template v-if="editButtonsHtml === 'edit'">
            <button type="button" class="user-header-btn-edit" @click="enableEdit">编辑资料</button>
          </template>
          <template v-else>
            <button type="button" class="user-header-btn-save" @click="saveUserInfo">保存</button>
            <button type="button" class="user-header-btn-cancel" @click="cancelEdit">取消</button>
          </template>
        </div>
      </div>

      <div class="user-content">
        <div class="user-avatar-section">
          <img :src="getImagePath('images/logo192.png')" alt="用户头像" class="user-avatar" id="userAvatar" />
          <button type="button" class="official-badge-btn" @click="openOfficialAuthModal">
            <span>✔</span>
            <span>官方旗舰店认证</span>
          </button>
          <button
            v-show="isEditing"
            id="changeAvatarBtn"
            type="button"
            class="change-avatar-btn"
            @click="changeAvatar"
          >
            更换头像
          </button>
        </div>

        <div id="userInfoForm" class="user-info">
          <div class="user-info-item">
            <label>用户名：</label>
            <span v-show="!isEditing" id="userName" class="user-info-name">{{ userInfo.name }}</span>
            <input v-show="isEditing" id="userNameInput" v-model="userInfo.name" type="text" />
          </div>
          <div class="user-info-item">
            <label>邮箱：</label>
            <span v-show="!isEditing" id="userEmail" class="user-info-email">{{ userInfo.email }}</span>
            <input v-show="isEditing" id="userEmailInput" v-model="userInfo.email" type="email" />
          </div>
          <div class="user-info-item">
            <label>手机号：</label>
            <span v-show="!isEditing" id="userPhone" class="user-info-phone">{{ userInfo.phone }}</span>
            <input v-show="isEditing" id="userPhoneInput" v-model="userInfo.phone" type="tel" />
          </div>
          <div class="user-info-item">
            <label>注册时间：</label>
            <span id="registerTime" class="user-info-register-time">{{ userInfo.registerTime }}</span>
          </div>
          <div class="user-info-item full-width">
            <label>商家介绍：</label>
            <div class="merchant-intro-box">
              <span v-show="!isEditing" id="userIntro" class="user-info-personal-introduction">{{
                userInfo.introduction
              }}</span>
              <textarea
                v-show="isEditing"
                id="userIntroInput"
                v-model="userInfo.introduction"
                rows="3"
              />
            </div>
          </div>

          <div class="store-metric-grid">
            <article class="store-metric-card">
              <h4>本月营业额</h4>
              <p class="metric-main">¥{{ storeStats.monthRevenue.toLocaleString('zh-CN') }}</p>
              <p class="metric-sub" :class="trendClass">{{ trendLabel }}</p>
            </article>
            <article class="store-metric-card">
              <h4>商店整体评价</h4>
              <p class="metric-main">★ {{ storeStats.rating.toFixed(1) }}</p>
              <p class="metric-sub">{{ ratingText }}</p>
            </article>
          </div>
        </div>
      </div>

      <div class="user-menu">
        <h3>商家服务</h3>
        <div class="menu-items">
          <div class="menu-item" @click="menuAlert('商品管理功能开发中...')">
            <span>🛍️</span>
            <span>商品管理</span>
          </div>
          <div class="menu-item" @click="menuAlert('订单发货功能开发中...')">
            <span>📦</span>
            <span>订单发货</span>
          </div>
          <div class="menu-item" @click="menuAlert('售后管理功能开发中...')">
            <span>🧾</span>
            <span>售后管理</span>
          </div>
          <div class="menu-item" @click="menuAlert('库存预警功能开发中...')">
            <span>📊</span>
            <span>库存预警</span>
          </div>
          <div class="menu-item" @click="menuAlert('营销活动功能开发中...')">
            <span>🎯</span>
            <span>营销活动</span>
          </div>
          <div class="menu-item" @click="menuAlert('店铺设置功能开发中...')">
            <span>⚙️</span>
            <span>店铺设置</span>
          </div>
          <div class="menu-item" @click="menuAlert('商家客服功能开发中...')">
            <span>💬</span>
            <span>商家客服</span>
          </div>
        </div>
      </div>

      <div class="user-footer">
        <button type="button" class="user-footer-btn-logout" @click="logout">退出登录</button>
      </div>
    </div>

    <div v-if="authModalOpen" class="auth-modal-overlay" @click="closeOfficialAuthModal">
      <div class="auth-modal" @click.stop>
        <button type="button" class="auth-modal-close" @click="closeOfficialAuthModal">✕</button>
        <h3>官方旗舰店认证申请</h3>

        <div class="auth-form-item">
          <label for="companyNameInput">公司名称</label>
          <input
            id="companyNameInput"
            v-model="authForm.companyName"
            type="text"
            placeholder="请输入公司全称"
          />
        </div>

        <div class="auth-form-item">
          <label>相关证书图片</label>
          <label class="auth-upload-btn">
            选择本地图片
            <input type="file" accept="image/*" @change="onPickCertificate" />
          </label>
          <p class="auth-upload-name">{{ authForm.certificateFileName || '尚未选择证书图片' }}</p>
          <img
            v-if="authForm.certificatePreviewUrl"
            :src="authForm.certificatePreviewUrl"
            alt="证书预览"
            class="auth-certificate-preview"
          />
        </div>

        <button type="button" class="auth-submit-btn" @click="submitOfficialAuth">提交申请</button>
      </div>
    </div>
  </div>
</template>
