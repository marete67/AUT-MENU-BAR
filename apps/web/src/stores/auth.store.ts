import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const username = ref<string | null>(localStorage.getItem('username'))

  const isAuthenticated = computed(() => token.value !== null)

  function setAuth(newToken: string, newUsername: string) {
    token.value = newToken
    username.value = newUsername
    localStorage.setItem('token', newToken)
    localStorage.setItem('username', newUsername)
  }

  function logout() {
    token.value = null
    username.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('username')
  }

  return { token, username, isAuthenticated, setAuth, logout }
})
