import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchUserInfo } from '@/api'

// 用户类型定义
export interface User {
  id: number
  username: string
  role: 'USER' | 'ADMIN'
  email?: string
  phone?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loaded = ref(false)
  
  // Token 刷新相关
  const tokenRefreshTimer = ref<number | null>(null)
  const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000 // 每 5 分钟检查一次
  const TOKEN_EXPIRY_THRESHOLD = 10 * 60 * 1000 // token 剩余 10 分钟时刷新

  const loggedIn = computed(() => Boolean(user.value?.id))
  const welcomeUsername = computed(() => user.value?.username || '用户')
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  /**
   * 检查 token 是否需要刷新
   * 通过尝试访问需要认证的接口来检测 token 状态
   */
  async function checkAndRefreshToken() {
    try {
      // 使用 /user/info 接口检测 token 是否有效
      const response = await fetch('/user/info', {
        method: 'GET',
        credentials: 'include'
      })
      
      // 如果响应是 401 或 403，说明 token 已过期
      if (response.status === 401 || response.status === 403) {
        console.warn('Token expired, attempting to refresh...')
        // 尝试刷新 token（调用后端的 refresh 接口）
        await refreshToken()
      }
    } catch (error) {
      console.error('Token check failed:', error)
    }
  }

  /**
   * 刷新 token
   * 调用后端的 token 刷新接口
   */
  async function refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/user/refresh', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        console.log('Token refreshed successfully')
        // 刷新成功后，重新获取用户信息
        await refresh()
        return true
      } else {
        console.warn('Token refresh failed, clearing session')
        // 刷新失败，清除本地会话
        clear()
        return false
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }

  /**
   * 启动定时 token 检查
   */
  function startTokenRefreshTimer() {
    // 清除之前的定时器
    if (tokenRefreshTimer.value) {
      clearInterval(tokenRefreshTimer.value)
    }
    
    // 启动新的定时器
    tokenRefreshTimer.value = window.setInterval(() => {
      if (loggedIn.value) {
        checkAndRefreshToken()
      }
    }, TOKEN_CHECK_INTERVAL)
    
    console.log('Token refresh timer started')
  }

  /**
   * 停止定时 token 检查
   */
  function stopTokenRefreshTimer() {
    if (tokenRefreshTimer.value) {
      clearInterval(tokenRefreshTimer.value)
      tokenRefreshTimer.value = null
      console.log('Token refresh timer stopped')
    }
  }

  async function refresh() {
    try {
      const data = await fetchUserInfo()
      if (data?.success && data.user) {
        user.value = { 
          id: data.user.id, 
          username: data.user.username || '',
          role: data.user.role || 'USER',
          email: data.user.email,
          phone: data.user.phone
        }
        // 登录成功后启动 token 刷新定时器
        startTokenRefreshTimer()
      } else {
        user.value = null
        // 未登录时停止定时器
        stopTokenRefreshTimer()
      }
    } catch {
      user.value = null
      stopTokenRefreshTimer()
    } finally {
      loaded.value = true
    }
    syncWindowUser()
    return user.value
  }

  async function logout() {
    try {
      // 调用后端登出 API
      await fetch('/user/logout', { 
        method: 'POST',
        credentials: 'include'
      })
    } catch (e) {
      console.error('Logout error:', e)
    } finally {
      // 停止 token 刷新定时器
      stopTokenRefreshTimer()
      user.value = null
      localStorage.removeItem('rememberMe')
      syncWindowUser()
    }
  }

  function clear() {
    // 停止 token 刷新定时器
    stopTokenRefreshTimer()
    user.value = null
    syncWindowUser()
  }

  function syncWindowUser() {
    if (typeof window !== 'undefined') {
      window.currentUser = user.value
    }
  }

  return {
    user,
    loaded,
    loggedIn,
    welcomeUsername,
    isAdmin,
    refresh,
    logout,
    clear,
    syncWindowUser,
    checkAndRefreshToken,
    refreshToken,
  }
})
