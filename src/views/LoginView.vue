<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import dayjs from 'dayjs'
import { getContextPath } from '@/utils/context'
import { captchaUrl, checkUsername } from '@/api'

// 引入样式
import '@/styles/legacy/common.css'
import '@/styles/legacy/login.css'

// --- 类型定义 ---
type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'snowy';

interface FloatingItem {
  id: number;
  y: number;         
  size: number;      
  opacity: number;   
  duration: number;  
  delay: number;     
  floatDuration: number;
}

// --- 基础状态 ---
const ctx = getContextPath()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// 导入四季背景图 (使用 Vite 的 assets 方式)
import springImg from '@/../public/images/spring.jpg'
import summerImg from '@/../public/images/summer.jpg'
import autumnImg from '@/../public/images/autumn.jpg'
import winterImg from '@/../public/images/winter.jpg'

const seasonImages: Record<string, string> = {
  spring: springImg,
  summer: summerImg,
  autumn: autumnImg,
  winter: winterImg,
}

const loginHeaderStyle = ref<Record<string, string>>({})
const captchaSrc = ref(captchaUrl())
const errorMsg = ref('')
const successMsg = ref('')
const inputUsername = ref('')

const registerOpen = ref(false)
const usernameError = ref('')
const isCheckingUsername = ref(false)
let usernameCheckTimeout: ReturnType<typeof setTimeout> | null = null

// --- 天气逻辑状态 ---
const currentWeather = ref<WeatherType>('cloudy')
const weatherItems = ref<FloatingItem[]>([])

function generateWeatherItems() {
  const type = currentWeather.value;
  const count = type === 'sunny' ? 12 : (type === 'cloudy' ? 18 : 22);
  const items: FloatingItem[] = [];
  for (let i = 0; i < count; i++) {
    const duration = 45 + Math.random() * 55; 
    items.push({
      id: Math.random(),
      y: 5 + Math.random() * 75,
      size: type === 'sunny' ? (100 + Math.random() * 60) : (160 + Math.random() * 100),
      opacity: (type === 'rainy' || type === 'snowy') ? (0.25 + Math.random() * 0.2) : (0.15 + Math.random() * 0.3),
      duration: duration,
      delay: Math.random() * -duration,
      floatDuration: 6 + Math.random() * 6 
    });
  }
  weatherItems.value = items;
}

function changeWeather(type: WeatherType) {
  currentWeather.value = type;
  generateWeatherItems();
}

async function initWeatherSystem() {
  generateWeatherItems();
  try {
    const response = await fetch('https://wttr.in/?format=j1');
    const data = await response.json();
    const condition = data.current_condition[0].weatherDesc[0].value.toLowerCase();
    let newType: WeatherType = 'cloudy';
    if (condition.includes('sun') || condition.includes('clear')) newType = 'sunny';
    else if (condition.includes('rain') || condition.includes('shower')) newType = 'rainy';
    else if (condition.includes('snow')) newType = 'snowy';
    changeWeather(newType);
  } catch (e) {
    console.warn('Weather API failed, fallback to cloudy');
  }
}

function getLoginSuccessTarget() {
  const raw = route.query.redirect
  if (typeof raw === 'string' && raw.startsWith('/')) return raw
  return '/index'
}

async function checkLoggedIn(): Promise<boolean> {
  try {
    const r = await fetch(`${ctx}/user/info`, { credentials: 'include' })
    const info = await r.json()
    return Boolean(info?.success && info.user)
  } catch { return false }
}

function getSeason(month: number) {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function getSeasonBackground(): string {
  const currentMonth = dayjs().month() + 1
  const season = getSeason(currentMonth)
  return seasonImages[season] || seasonImages.spring
}

onMounted(async () => {
  await auth.refresh()
  if (auth.user) {
    router.replace('/index')
    return
  }
  
  loginHeaderStyle.value = { backgroundImage: `url(${getSeasonBackground()})` }
  initWeatherSystem();
  applyQueryMessages();
  setTimeout(() => {
    if (errorMsg.value) fadeOut('.error-message-box')
    if (successMsg.value) fadeOut('.success-message-box', 3000)
  }, 100)
})

function applyQueryMessages() {
  const q = route.query
  errorMsg.value = q.err ? String(q.err) : ''
  successMsg.value = q.regOk ? String(q.regOk) : ''
  if (q.u) inputUsername.value = String(q.u)
}
watch(() => route.query, applyQueryMessages)

function fadeOut(selector: string, delay = 5000) {
  const el = document.querySelector(selector) as HTMLElement
  if (!el) return
  setTimeout(() => {
    el.style.transition = 'opacity 0.5s ease-out'; el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none' }, 500)
  }, delay)
}

function refreshCaptcha() { captchaSrc.value = captchaUrl() }
function openRegisterModal(e: Event) { e.preventDefault(); registerOpen.value = true; }
function closeRegisterModal() { registerOpen.value = false; usernameError.value = ''; }

/** 会话已建立后必须先刷新 Pinia，否则路由守卫仍认为未登录会把 /index 打回 /login */
async function navigateAfterLoginSuccess() {
  await auth.refresh()
  
  // 根据用户角色跳转
  if (auth.isAdmin) {
    // 管理员跳转到管理后台
    await router.replace('/admin/dashboard')
  } else {
    // 普通用户跳转到首页或原目标页面
    await router.replace(getLoginSuccessTarget())
  }
}

async function onLoginSubmit(e: Event) {
  e.preventDefault(); 
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  
  const userStr = formData.get('username') as string;
  const passStr = formData.get('password') as string;

  const body = new URLSearchParams(formData as any);
  try {
    const res = await fetch(`${ctx}/user/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'manual',
    })

    // 无论后端返回什么，优先以会话是否建立为准
    if (await checkLoggedIn()) {
      await navigateAfterLoginSuccess()
      return
    }

    const loc = res.headers.get('Location') || ''
    if (loc.includes('/login?')) {
      const params = new URLSearchParams(loc.split('?')[1] || '');
      const err = params.get('err');
      
      // 分类错误信息
      if (err) {
        const errStr = decodeURIComponent(err.replace(/\+/g, ' '))
        if (errStr.includes('验证码')) {
          errorMsg.value = '验证码错误，请重新输入（点击图片可刷新）'
        } else if (errStr.includes('账号') || errStr.includes('不存在')) {
          errorMsg.value = '账号不存在，请先注册或使用其他账号'
        } else if (errStr.includes('密码')) {
          errorMsg.value = '密码错误，请重新输入（默认 admin 密码为 Admin123）'
        } else {
          errorMsg.value = errStr
        }
      } else {
        errorMsg.value = '登录失败：请检查账号密码和验证码'
      }
      
      inputUsername.value = userStr;
      refreshCaptcha(); 
      return;
    }

    // Vite 开发代理有时会把 302 变成 200（带 HTML），此时根据会话判断是否已登录
    if (res.status === 200 || res.status === 0 || res.type === 'opaqueredirect') {
      if (await checkLoggedIn()) {
        await navigateAfterLoginSuccess()
        return
      }
    }

    errorMsg.value = '登录失败：请确认验证码与图片完全一致（点击图片可刷新），账号密码正确。默认 admin 密码为 Admin123。'
    refreshCaptcha();
  } catch (err) {
    const detail = err instanceof Error ? `（${err.message}）` : '';
    errorMsg.value = `网络错误：请确认后端服务已启动。${detail}`;
    refreshCaptcha();
  }
}

function validateRegister(form: any): boolean {
  let hasError = false;
  const getEl = (id: string) => document.getElementById(id) as HTMLElement;
  
  // 用户名验证
  if (form.username.value.length < 3) { 
    getEl('usernameError').textContent = '用户名长度至少 3 位'; 
    hasError = true; 
  } else { 
    getEl('usernameError').textContent = ''; 
  }
  
  // 手机号验证
  if (!/^1[3-9]\d{9}$/.test(form.phone.value)) { 
    getEl('phoneError').textContent = '手机号格式不正确'; 
    hasError = true; 
  } else { 
    getEl('phoneError').textContent = ''; 
  }
  
  // 邮箱验证
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value)) { 
    getEl('emailError').textContent = '邮箱格式不正确'; 
    hasError = true; 
  } else { 
    getEl('emailError').textContent = ''; 
  }
  
  // 密码复杂度验证
  const password = form.password.value;
  if (password.length < 6) { 
    getEl('passwordError').textContent = '密码长度至少 6 位'; 
    hasError = true; 
  } else if (!/(?=.*[a-z])/.test(password)) {
    getEl('passwordError').textContent = '密码必须包含小写字母';
    hasError = true;
  } else if (!/(?=.*[A-Z])/.test(password)) {
    getEl('passwordError').textContent = '密码必须包含大写字母';
    hasError = true;
  } else if (!/(?=.*\d)/.test(password)) {
    getEl('passwordError').textContent = '密码必须包含数字';
    hasError = true;
  } else { 
    getEl('passwordError').textContent = ''; 
  }
  
  // 确认密码验证
  if (form.confirmPassword.value !== form.password.value) { 
    getEl('confirmPasswordError').textContent = '两次输入的密码不一致'; 
    hasError = true; 
  } else { 
    getEl('confirmPasswordError').textContent = ''; 
  }
  
  return !hasError;
}

async function onRegisterSubmit(e: Event) {
  e.preventDefault(); 
  const form = e.target as HTMLFormElement;
  if (!validateRegister(form)) return;
  
  const body = new URLSearchParams(new FormData(form) as any)
  try {
    const res = await fetch(`${ctx}/user/register`, { method: 'POST', credentials: 'include', body })
    const url = new URL(res.url)
    if (url.searchParams.has('regOk')) {
      successMsg.value = url.searchParams.get('regOk') || '注册成功';
      await auth.refresh();
      if (auth.user) setTimeout(() => router.push('/'), 1200);
    } else { 
      errorMsg.value = url.searchParams.get('regErr') || '注册异常'; 
    }
    registerOpen.value = false;
    form.reset();  // 注册成功后重置表单
  } catch { 
    errorMsg.value = "请求超时" 
  }
}

async function onRegisterUsernameInput(e: any) {
  const u = e.target.value.trim()
  if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout)
  if (u.length < 3) { usernameError.value = ''; return; }
  usernameCheckTimeout = setTimeout(async () => {
    isCheckingUsername.value = true;
    try {
      const data = await checkUsername(u); usernameError.value = data.exists ? data.message : '✓ ' + data.message
    } finally { isCheckingUsername.value = false }
  }, 500)
}
</script>

<template>
  <div class="App">
    <div id="loginHeader" class="App-header" :style="loginHeaderStyle">
      
      <!-- 天气图标层 -->
      <div class="weather-backdrop" :class="`weather-${currentWeather}`">
        <div v-for="item in weatherItems" :key="item.id" class="weather-wrapper"
          :style="{ top: item.y + '%', animationDuration: item.duration + 's', animationDelay: item.delay + 's' }">
          
          <!-- 晴天 (旋转太阳) -->
          <svg v-if="currentWeather === 'sunny'" class="weather-icon sun-spin" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="20" fill="#FFD700" />
            <g stroke="#FFA500" stroke-width="5" stroke-linecap="round">
              <line x1="50" y1="12" x2="50" y2="28" /><line x1="50" y1="72" x2="50" y2="88" />
              <line x1="12" y1="50" x2="28" y2="50" /><line x1="72" y1="50" x2="88" y2="50" />
              <line x1="22" y1="22" x2="33" y2="33" /><line x1="67" y1="67" x2="78" y2="78" />
              <line x1="78" y1="22" x2="67" y2="33" /><line x1="33" y1="67" x2="22" y2="78" />
            </g>
          </svg>

          <!-- 下雨 (雨云) -->
          <svg v-else-if="currentWeather === 'rainy'" class="weather-icon" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 85">
            <path fill="#6B9AC4" d="M20,50 a12,12 0 0,1 12,-12 a18,18 0 0,1 30,-5 a12,12 0 0,1 25,5 a12,12 0 0,1 5,15 Z" />
            <g stroke="#4A90E2" stroke-width="4" stroke-linecap="round">
              <line x1="42" y1="65" x2="38" y2="75" class="rain-drop-anim" />
              <line x1="55" y1="65" x2="51" y2="75" class="rain-drop-anim" style="animation-delay: 0.2s" />
              <line x1="68" y1="65" x2="64" y2="75" class="rain-drop-anim" style="animation-delay: 0.4s" />
            </g>
          </svg>

          <!-- 下雪 (雪云) -->
          <svg v-else-if="currentWeather === 'snowy'" class="weather-icon" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 85">
            <path fill="#D3D3D3" d="M20,50 a12,12 0 0,1 12,-12 a18,18 0 0,1 30,-5 a12,12 0 0,1 25,5 a12,12 0 0,1 5,15 Z" />
            <circle cx="42" cy="72" r="3" fill="#E8F4F8" class="snow-shake-anim" />
            <circle cx="55" cy="75" r="3" fill="#E8F4F8" class="snow-shake-anim" style="animation-delay: 0.3s" />
            <circle cx="68" cy="72" r="3" fill="#E8F4F8" class="snow-shake-anim" style="animation-delay: 0.6s" />
          </svg>

          <!-- 多云 (云朵) -->
          <svg v-else class="weather-icon" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 60">
            <path fill="#F5F5F5" d="M10,48 a12,12 0 0,1 12,-12 a18,18 0 0,1 30,-5 a12,12 0 0,1 25,5 a12,12 0 0,1 5,15 Z" />
          </svg>
        </div>
      </div>

      <form class="login-form" @submit="onLoginSubmit">
        <h1 class="login-form-text">用户登录</h1>
        <div v-if="errorMsg" class="error-message-box">{{ errorMsg }}</div>
        <div v-if="successMsg" class="success-message-box">{{ successMsg }}</div>
        <div class="login-group">
          <label class="login-form-label">
            <svg class="label-icon" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span class="label-text">账号</span>
          </label>
          <input 
            v-model="inputUsername" 
            class="login-form-input" 
            :class="{ 'input-error': !!errorMsg }"
            type="text" 
            name="username" 
            placeholder="请输入账号" 
            required 
          />
        </div>
        <div class="login-group">
          <label class="login-form-label">
            <svg class="label-icon" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            <span class="label-text">密码</span>
          </label>
          <input 
            class="login-form-input" 
            :class="{ 'input-error': !!errorMsg }"
            type="password" 
            name="password" 
            placeholder="请输入密码" 
            required 
          />
        </div>
        <div class="login-group captcha-group">
          <label class="login-form-label">
            <svg class="label-icon" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm-1 14H5c-.55 0-1-.45-1-1V8l8 5 8-5v9c0 .55-.45 1-1 1zm-5-4.86L11.56 15H8v-2h2.44L12.88 11H17v2h-2.12l-2.88 3.14z"/>
            </svg>
            <span class="label-text">验证码</span>
          </label>
          <div class="captcha-container">
            <input 
              class="login-form-input captcha-input" 
              :class="{ 'input-error': !!errorMsg }"
              type="text" 
              name="captcha" 
              placeholder="请输入验证码" 
              maxlength="4" 
              required 
              @input="(e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
              }"
            />
            <img :src="captchaSrc" alt="验证码" class="captcha-image" @click="refreshCaptcha" />
          </div>
        </div>
        <button class="login-form-button" type="submit">登录</button>
        <a class="login-form-link" href="#" @click="openRegisterModal">没有账号？点击注册</a>
      </form>

      <!-- 调试控制条 -->
      <div class="weather-debug-panel">
        <button @click="changeWeather('sunny')" :class="{active: currentWeather === 'sunny'}">☀️</button>
        <button @click="changeWeather('cloudy')" :class="{active: currentWeather === 'cloudy'}">☁️</button>
        <button @click="changeWeather('rainy')" :class="{active: currentWeather === 'rainy'}">🌧️</button>
        <button @click="changeWeather('snowy')" :class="{active: currentWeather === 'snowy'}">❄️</button>
      </div>
    </div>

    <div v-show="registerOpen" class="register-overlay" style="display: flex" @click="closeRegisterModal">
      <div class="register-content" @click.stop>
        <div class="register-header">
          <h2 class="register-title">用户注册</h2>
          <button type="button" class="register-close" @click="closeRegisterModal">×</button>
        </div>
        <form id="registerForm" class="register-form" @submit="onRegisterSubmit">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input class="form-input" name="username" required minlength="3" @input="onRegisterUsernameInput" />
            <span id="usernameError" class="error-message">{{ usernameError }}</span>
          </div>
          <div class="form-group"><label class="form-label">手机号</label><input class="form-input" name="phone" required type="tel"/> <span id="phoneError" class="error-message"></span></div>
          <div class="form-group"><label class="form-label">邮箱</label><input class="form-input" name="email" required type="email"/> <span id="emailError" class="error-message"></span></div>
          <div class="form-group"><label class="form-label">密码</label><input class="form-input" name="password" required type="password"/> <span id="passwordError" class="error-message"></span></div>
          <div class="form-group"><label class="form-label">确认密码</label><input class="form-input" name="confirmPassword" required type="password"/> <span id="confirmPasswordError" class="error-message"></span></div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="closeRegisterModal">取消</button>
            <button type="submit" class="btn-submit">注册</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 所有样式已移至 login.css */
</style>
