<template>
  <div class="login-wrap">
    <div class="card">
      <div class="logo"><span>[</span> MENU BAR <span>]</span></div>

      <form @submit.prevent="handleLogin">
        <div class="field">
          <label for="username">Usuario</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            autocomplete="username"
            placeholder="usuario"
            :disabled="loading"
            required
          >
        </div>

        <div class="field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="loading"
            required
          >
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

        <button type="submit" :disabled="loading" class="btn-primary">
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store.js'
import { authApi } from '@/api/index.js'
import { ApiError } from '@/api/client.js'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = ref({ username: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true

  try {
    const data = await authApi.login(form.value)
    auth.setAuth(data.token, data.username)
    const redirect = (route.query['redirect'] as string) ?? '/dashboard'
    await router.push(redirect)
  } catch (err) {
    errorMsg.value = err instanceof ApiError ? err.message : 'Error al conectar'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg, #060d24);
  padding: 16px;
}

.card {
  width: 100%;
  max-width: 380px;
  padding: 40px;
  background: #0f1834;
  border-radius: 12px;
  box-shadow: 0 0 0 1px rgba(158, 255, 200, 0.07), 0 32px 64px rgba(0, 0, 0, 0.5);
}

.logo {
  font-family: 'Manrope', sans-serif;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 32px;
  color: #e8edf8;
}
.logo span { color: #9effc8; }

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}
.field label {
  font-size: 11px;
  color: #6b7a99;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family: 'Manrope', sans-serif;
  font-weight: 600;
}
.field input {
  background: #151e3c;
  border: none;
  border-bottom: 2px solid transparent;
  color: #e8edf8;
  padding: 10px 12px;
  border-radius: 4px 4px 0 0;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  outline: none;
  transition: border-color 0.15s;
}
.field input:focus { border-bottom-color: #00ec9a; }
.field input:disabled { opacity: 0.6; cursor: not-allowed; }

.error-msg {
  font-size: 12px;
  color: #d7383b;
  text-align: center;
  margin-bottom: 8px;
}

.btn-primary {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  background: linear-gradient(135deg, #00ec9a, #9effc8);
  color: #060d24;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  font-family: 'Manrope', sans-serif;
  letter-spacing: 0.05em;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(0, 236, 154, 0.2);
  transition: opacity 0.15s, box-shadow 0.15s;
}
.btn-primary:hover { opacity: 0.9; box-shadow: 0 0 32px rgba(0, 236, 154, 0.35); }
.btn-primary:disabled { background: #151e3c; color: #6b7a99; box-shadow: none; cursor: not-allowed; }

@media (max-width: 480px) {
  .card {
    padding: 32px 24px;
    border-radius: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-shadow: none;
  }
}
</style>
