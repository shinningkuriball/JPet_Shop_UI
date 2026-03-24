<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import dayjs from 'dayjs'
import { getContextPath } from '@/utils/context'
import { captchaUrl, checkUsername } from '@/api'

// 1. 引入你原本的 CSS 样式
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

// --- 基础业务状态 ---
const ctx = getContextPath()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

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

/**
 * 核心：生成天气图标（负延迟实现开屏填满）
 */
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
      delay: Math.random() * -duration, // 这里的负数 delay 保证了刷新即满屏
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
    console.warn('Weather API sync failed');
  }
}

// --- 业务逻辑 (全量还原你的版本) ---

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function getSeasonBackground(): string {
  const currentMonth = dayjs().month() + 1
  const season = getSeason(currentMonth)
  const map: Record<string, string> = {
    spring: `${ctx}/images/spring.jpg`,
    summer: `${ctx}/images/summer.jpg`,
    autumn: `${ctx}/images/autumn.jpg`,
    winter: `${ctx}/images/winter.jpg`,
  }
  return map[season] || map.spring
}

onMounted(() => {
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
  successMsg.value = ''
  if (q.u) inputUsername.value = String(q.u)
  if (q.regOk) { successMsg.value = String(q.regOk); errorMsg.value = ''; }
  if (q.regErr) { errorMsg.value = String(q.regErr); successMsg.value = ''; }
}

watch(() => route.query, applyQueryMessages)

function fadeOut(selector: string, delay = 5000) {
  const el = document.querySelector(selector) as HTMLElement
  if (!el) return
  setTimeout(() => {
    el.style.transition = 'opacity 0.5s ease-out';
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none' }, 500)
  }, delay)
}

function refreshCaptcha() { captchaSrc.value = captchaUrl() }
function openRegisterModal(e: Event) { e.preventDefault(); registerOpen.value = true; }
function closeRegisterModal() { registerOpen.value = false; usernameError.value = ''; }

/**
 * 登录提交逻辑 (包含管理员入口拦截)
 */
async function onLoginSubmit(e: Event) {
  e.preventDefault(); 
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  
  const userStr = formData.get('username') as string;
  const passStr = formData.get('password') as string;

  // --- 3. 管理员模式入口拦截 ---
  if (userStr === 'admin' && passStr === 'Admin123') {
    // 跳转到其他组员负责的管理员网页
    window.location.href = 'http://localhost:8080/admin/index'; 
    return;
  }

  // --- 普通用户登录逻辑 ---
  const body = new URLSearchParams(formData as any);
  try {
    const res = await fetch(`${ctx}/user/login`, { method: 'POST', credentials: 'include', body, redirect: 'manual' })
    if (res.status === 302 || res.type === 'opaqueredirect' || res.url.includes('/index')) {
      await auth.refresh(); router.push('/'); return;
    }
    errorMsg.value = '登录失败，请确认验证码及账号密码'; refreshCaptcha();
  } catch { errorMsg.value = '后端连接失败'; refreshCaptcha(); }
}

// --- 注册校验逻辑 (还原) ---
function validateRegister(form: any): boolean {
  let hasError = false;
  const getEl = (id: string) => document.getElementById(id) as HTMLElement;
  if (form.username.value.length < 3) { getEl('usernameError').textContent = '用户名长度至少3位'; hasError = true; } 
  else getEl('usernameError').textContent = '';
  if (!/^1[3-9]\d{9}$/.test(form.phone.value)) { getEl('phoneError').textContent = '手机号格式不正确'; hasError = true; } 
  else getEl('phoneError').textContent = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value)) { getEl('emailError').textContent = '邮箱格式不正确'; hasError = true; } 
  else getEl('emailError').textContent = '';
  if (form.password.value.length < 6) { getEl('passwordError').textContent = '密码至少6位'; hasError = true; } 
  else getEl('passwordError').textContent = '';
  if (form.confirmPassword.value !== form.password.value) { getEl('confirmPasswordError').textContent = '两次输入的密码不一致'; hasError = true; } 
  else getEl('confirmPasswordError').textContent = '';
  return !hasError;
}

async function onRegisterSubmit(e: Event) {
  e.preventDefault(); const form = e.target as HTMLFormElement;
  if (!validateRegister(form)) return;
  const body = new URLSearchParams(new FormData(form) as any)
  try {
    const res = await fetch(`${ctx}/user/register`, { method: 'POST', credentials: 'include', body })
    const url = new URL(res.url)
    if (url.searchParams.has('regOk')) {
      successMsg.value = url.searchParams.get('regOk') || '注册成功';
      await auth.refresh();
      if (auth.user) setTimeout(() => router.push('/'), 1200);
    } else { errorMsg.value = url.searchParams.get('regErr') || '注册异常'; }
    registerOpen.value = false;
  } catch { errorMsg.value = "请求超时" }
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
      
      <!-- 天气图标背景层 (置于最底层) -->
      <div class="weather-backdrop" :class="`weather-${currentWeather}`">
        <div 
          v-for="item in weatherItems" 
          :key="item.id" 
          class="weather-wrapper"
          :style="{
            top: item.y + '%',
            animationDuration: item.duration + 's',
            animationDelay: item.delay + 's'
          }"
        >
          <!-- 1. 晴天图标 (带有旋转) -->
          <svg v-if="currentWeather === 'sunny'" class="weather-icon sun-spin" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="18" fill="white" />
            <g stroke="white" stroke-width="4" stroke-linecap="round">
              <line x1="50" y1="15" x2="50" y2="25" /><line x1="50" y1="75" x2="50" y2="85" />
              <line x1="15" y1="50" x2="25" y2="50" /><line x1="75" y1="50" x2="85" y2="50" />
              <line x1="25" y1="25" x2="32" y2="32" /><line x1="68" y1="68" x2="75" y2="75" />
              <line x1="75" y1="25" x2="68" y2="32" /><line x1="32" y1="68" x2="25" y2="75" />
            </g>
          </svg>

          <!-- 2. 下雨图标 (雨云) -->
          <svg v-else-if="currentWeather === 'rainy'" class="weather-icon" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 85">
            <path fill="white" d="M20,50 a12,12 0 0,1 12,-12 a18,18 0 0,1 30,-5 a12,12 0 0,1 25,5 a12,12 0 0,1 5,15 Z" />
            <g stroke="white" stroke-width="3" stroke-linecap="round">
              <line x1="42" y1="65" x2="38" y2="75" class="rain-drop-anim" />
              <line x1="55" y1="65" x2="51" y2="75" class="rain-drop-anim" style="animation-delay: 0.2s" />
              <line x1="68" y1="65" x2="64" y2="75" class="rain-drop-anim" style="animation-delay: 0.4s" />
            </g>
          </svg>

          <!-- 3. 下雪图标 (雪云) -->
          <svg v-else-if="currentWeather === 'snowy'" class="weather-icon" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 85">
            <path fill="white" d="M20,50 a12,12 0 0,1 12,-12 a18,18 0 0,1 30,-5 a12,12 0 0,1 25,5 a12,12 0 0,1 5,15 Z" />
            <g fill="white">
              <circle cx="42" cy="72" r="2.5" class="snow-shake-anim" />
              <circle cx="55" cy="75" r="2.5" class="snow-shake-anim" style="animation-delay: 0.3s" />
              <circle cx="68" cy="72" r="2.5" class="snow-shake-anim" style="animation-delay: 0.6s" />
            </g>
          </svg>

          <!-- 4. 多云图标 (纯云朵) -->
          <svg v-else class="weather-icon" :style="{ width: item.size+'px', opacity: item.opacity, animationDuration: item.floatDuration+'s' }" viewBox="0 0 100 60">
            <path fill="white" d="M10,48 a12,12 0 0,1 12,-12 a18,18 0 0,1 30,-5 a12,12 0 0,1 25,5 a12,12 0 0,1 5,15 Z" />
          </svg>
        </div>
      </div>

      <!-- --- 登录表单：完全还原 UI 结构 --- -->
      <form class="login-form" @submit="onLoginSubmit">
        <h1 class="login-form-text">用户登录界面</h1>
        <div v-if="errorMsg" class="error-message-box">{{ errorMsg }}</div>
        <div v-if="successMsg" class="success-message-box">{{ successMsg }}</div>
        <div class="login-group">
          <label class="login-form-label">账号</label>
          <input v-model="inputUsername" class="login-form-input" type="text" name="username" placeholder="请输入账号" required />
        </div>
        <div class="login-group">
          <label class="login-form-label">密码</label>
          <input class="login-form-input" type="password" name="password" placeholder="请输入密码" required />
        </div>
        <div class="login-group captcha-group">
          <label class="login-form-label">验证码</label>
          <div class="captcha-container">
            <input class="login-form-input captcha-input" type="text" name="captcha" placeholder="请输入验证码" maxlength="4" required />
            <img :src="captchaSrc" alt="验证码" class="captcha-image" @click="refreshCaptcha" />
          </div>
        </div>
        <button class="login-form-button" type="submit">登录</button>
        <a class="login-form-link" href="#" @click="openRegisterModal">没有账号？点击注册</a>
      </form>

      <!-- 预览控制条 (UI极简，用于演示) -->
      <div class="weather-debug-panel">
        <button @click="changeWeather('sunny')" :class="{active: currentWeather === 'sunny'}">☀️</button>
        <button @click="changeWeather('cloudy')" :class="{active: currentWeather === 'cloudy'}">☁️</button>
        <button @click="changeWeather('rainy')" :class="{active: currentWeather === 'rainy'}">🌧️</button>
        <button @click="changeWeather('snowy')" :class="{active: currentWeather === 'snowy'}">❄️</button>
      </div>
    </div>

    <!-- --- 注册对话框：全量还原 --- -->
    <div v-show="registerOpen" class="register-overlay" style="display: flex" @click="closeRegisterModal">
      <div class="register-content" @click.stop>
        <div class="register-header">
          <h2 class="register-title">用户注册</h2>
          <button type="button" class="register-close" @click="closeRegisterModal">×</button>
        </div>
        <form id="registerForm" class="register-form" @submit="onRegisterSubmit">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input class="form-input" type="text" name="username" placeholder="请输入用户名" required minlength="3" @input="onRegisterUsernameInput" />
            <span id="usernameError" class="error-message">{{ usernameError }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input class="form-input" type="tel" name="phone" placeholder="请输入手机号" required />
            <span id="phoneError" class="error-message"></span>
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input class="form-input" type="email" name="email" placeholder="请输入邮箱" required />
            <span id="emailError" class="error-message"></span>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input class="form-input" type="password" name="password" placeholder="请输入密码" required />
            <span id="passwordError" class="error-message"></span>
          </div>
          <div class="form-group">
            <label class="form-label">确认密码</label>
            <input class="form-input" type="password" name="confirmPassword" placeholder="请输入确认密码" required />
            <span id="confirmPasswordError" class="error-message"></span>
          </div>
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
/* 核心布局保障 */
#loginHeader { position: relative; width: 100vw; height: 100vh; overflow: hidden; }

/* 天气层背景：z-index 置于表单下方 */
.weather-backdrop { position: absolute; inset: 0; pointer-events: none; z-index: 1; }

/* 图标漂移动画 */
.weather-wrapper {
  position: absolute;
  left: 0;
  will-change: transform;
  animation: svg-move-action linear infinite;
}

/* 图标浮动细节 */
.weather-icon {
  filter: drop-shadow(0 15px 25px rgba(0,0,0,0.08));
  animation: svg-bob-action ease-in-out infinite alternate;
}

.sun-spin { animation: svg-bob-action ease-in-out infinite alternate, spin-action 20s linear infinite; }

.rain-drop-anim { animation: rain-fall-action 0.8s linear infinite; }
@keyframes rain-fall-action {
  0% { transform: translate(4px, -4px); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translate(-4px, 12px); opacity: 0; }
}

.snow-shake-anim { animation: snow-shake-action 1.5s ease-in-out infinite alternate; }
@keyframes snow-shake-action {
  from { transform: translateX(-3px) translateY(0); }
  to { transform: translateX(3px) translateY(8px); }
}

/* 轨道动画 */
@keyframes svg-move-action {
  from { transform: translateX(-500px); }
  to { transform: translateX(calc(100vw + 500px)); }
}
@keyframes svg-bob-action {
  from { transform: translateY(-30px); }
  to { transform: translateY(30px); }
}
@keyframes spin-action {
  from { transform: translateY(-30px) rotate(0deg); }
  to { transform: translateY(30px) rotate(360deg); }
}

/* 预览切换小条 */
.weather-debug-panel {
  position: absolute; bottom: 20px; right: 20px; z-index: 100;
  display: flex; gap: 8px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 20px;
}
.weather-debug-panel button { background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.4; transition: 0.3s; color: white; }
.weather-debug-panel button.active { opacity: 1; transform: scale(1.2); }

/* 保证表单在天气层上面 */
.login-form { position: relative; z-index: 10; }
</style>