<template>
  <div>
    <h2 class="section-title">Envíos programados</h2>

    <div class="tabs">
      <button :class="['tab', { active: subtab === 'email' }]" @click="subtab = 'email'">Email</button>
      <button :class="['tab', { active: subtab === 'ig' }]" @click="subtab = 'ig'">Instagram</button>
    </div>

    <!-- EMAILS -->
    <div v-if="subtab === 'email'">
      <div v-if="loadingEmails" class="loading">Cargando...</div>
      <div v-else-if="!emails.length" class="empty">No hay emails programados.</div>
      <div v-else class="list">
        <div v-for="item in emails" :key="item.id" class="item">
          <div class="item-info">
            <span class="item-name">{{ item.template_name || '—' }}</span>
            <span class="item-sub">Para: {{ item.email_to }}</span>
            <span class="item-sub">{{ formatDate(item.send_at) }}</span>
          </div>
          <div class="item-actions">
            <span :class="['badge', item.status]">{{ item.status }}</span>
            <button v-if="item.status === 'pending'" class="btn-small btn-danger" @click="cancelEmail(item.id)">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- INSTAGRAM -->
    <div v-else>
      <div v-if="loadingIg" class="loading">Cargando...</div>
      <div v-else-if="!igPosts.length" class="empty">No hay publicaciones programadas.</div>
      <div v-else class="list">
        <div v-for="item in igPosts" :key="item.id" class="item">
          <div class="item-info">
            <span class="item-name">{{ item.template_name || '—' }}</span>
            <span class="item-sub">{{ formatDate(item.scheduled_at) }}</span>
          </div>
          <div class="item-actions">
            <span :class="['badge', item.status]">{{ item.status }}</span>
            <button v-if="item.status === 'pending'" class="btn-small btn-danger" @click="cancelIg(item.id)">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { distributeApi } from '@/api/index.js'
import type { ScheduledEmailResponse, ScheduledIgResponse } from '@menu-bar/shared'

const subtab = ref<'email' | 'ig'>('email')
const emails = ref<ScheduledEmailResponse[]>([])
const igPosts = ref<ScheduledIgResponse[]>([])
const loadingEmails = ref(false)
const loadingIg = ref(false)

async function fetchEmails() {
  loadingEmails.value = true
  try { emails.value = await distributeApi.getScheduledEmails() }
  finally { loadingEmails.value = false }
}

async function fetchIg() {
  loadingIg.value = true
  try { igPosts.value = await distributeApi.getScheduledIg() }
  finally { loadingIg.value = false }
}

onMounted(() => { fetchEmails(); fetchIg() })

async function cancelEmail(id: number) {
  if (!confirm('¿Cancelar este envío?')) return
  await distributeApi.deleteScheduledEmail(id)
  await fetchEmails()
}

async function cancelIg(id: number) {
  if (!confirm('¿Cancelar esta publicación?')) return
  await distributeApi.deleteScheduledIg(id)
  await fetchIg()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.section-title { font-size: 18px; font-weight: 700; font-family: 'Manrope', sans-serif; margin: 0 0 16px; }
.tabs { display: flex; gap: 4px; margin-bottom: 24px; }
.tab { padding: 7px 16px; border-radius: 6px; border: none; background: transparent; color: #6b7a99; cursor: pointer; font-size: 13px; font-family: 'Manrope', sans-serif; font-weight: 600; transition: all 0.15s; }
.tab.active { background: #151e3c; color: #e8edf8; }
.list { display: flex; flex-direction: column; gap: 10px; }
.item { background: #0f1834; border-radius: 8px; padding: 14px 16px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 16px; }
.item-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.item-name { font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; }
.item-sub { font-size: 11px; color: #6b7a99; }
.item-actions { display: flex; align-items: center; gap: 8px; }
.badge { font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 3px; font-family: 'Manrope', sans-serif; text-transform: uppercase; }
.badge.pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
.badge.sent, .badge.published { background: rgba(158,255,200,0.12); color: #9effc8; }
.badge.failed { background: rgba(215,56,59,0.12); color: #d7383b; }
.btn-small { padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #e8edf8; cursor: pointer; font-size: 11px; font-family: 'Manrope', sans-serif; font-weight: 600; }
.btn-danger { border-color: rgba(215,56,59,0.3); color: #d7383b; }
.loading, .empty { color: #6b7a99; text-align: center; padding: 40px 0; }
</style>
