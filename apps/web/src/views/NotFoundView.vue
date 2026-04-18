<template>
  <div class="not-found">
    <div class="logo"><span>[</span> MENU BAR <span>]</span></div>
    <h1>404</h1>
    <p>Página no encontrada</p>
    <RouterLink to="/dashboard" class="btn">Ir al dashboard</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #060d24;
  color: #e8edf8;
  font-family: 'Inter', sans-serif;
}
.logo { font-family: 'Manrope', sans-serif; font-size: 14px; font-weight: 700; }
.logo span { color: #9effc8; }
h1 { font-size: 72px; font-weight: 700; margin: 0; color: #1a2547; }
p { color: #6b7a99; margin: 0; }
.btn {
  margin-top: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #00ec9a, #9effc8);
  color: #060d24;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 700;
  font-family: 'Manrope', sans-serif;
  font-size: 13px;
}
</style>
