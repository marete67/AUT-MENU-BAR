<template>
  <div>
    <div class="section-header">
      <h2 class="section-title">Links públicos</h2>
      <button class="btn-accent" :disabled="links.length >= 3" @click="handleCreate">
        + Nuevo link
      </button>
    </div>
    <p class="hint">Máximo 3 links por cuenta. Cada link tiene una URL pública para compartir tu menú.</p>

    <div v-if="loading" class="loading">Cargando...</div>
    <div v-else-if="!links.length" class="empty">No tienes links públicos todavía.</div>
    <div v-else class="links-list">
      <div v-for="link in links" :key="link.id" class="link-card">
        <div class="link-info">
          <span class="link-name">{{ link.name }}</span>
          <a :href="`/p/${link.slug}`" target="_blank" class="link-url">
            /p/{{ link.slug }}
          </a>
          <span v-if="link.last_published_at" class="link-date">
            Publicado {{ formatDate(link.last_published_at) }}
          </span>
          <span v-else class="link-date dim">Sin publicar</span>
        </div>
        <div class="link-actions">
          <button class="btn-small" @click="handleRename(link)">Renombrar</button>
          <button class="btn-small btn-danger" @click="handleDelete(link.id)">Eliminar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { linksApi } from '@/api/index.js'
import type { LinkResponse } from '@menu-bar/shared'

const links = ref<LinkResponse[]>([])
const loading = ref(false)

async function fetchLinks() {
  loading.value = true
  try { links.value = await linksApi.list() }
  finally { loading.value = false }
}

onMounted(fetchLinks)

async function handleCreate() {
  const name = prompt('Nombre del link:')?.trim()
  if (!name) return
  await linksApi.create({ name })
  await fetchLinks()
}

async function handleRename(link: LinkResponse) {
  const name = prompt('Nuevo nombre:', link.name)?.trim()
  if (!name || name === link.name) return
  await linksApi.update(link.id, { name })
  await fetchLinks()
}

async function handleDelete(id: number) {
  if (!confirm('¿Eliminar este link público?')) return
  await linksApi.delete(id)
  await fetchLinks()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.section-title { font-size: 18px; font-weight: 700; font-family: 'Manrope', sans-serif; margin: 0; }
.hint { font-size: 12px; color: #6b7a99; margin-bottom: 24px; }
.btn-accent { padding: 8px 16px; border-radius: 6px; border: none; background: linear-gradient(135deg, #00ec9a, #9effc8); color: #060d24; font-weight: 700; font-family: 'Manrope', sans-serif; font-size: 13px; cursor: pointer; }
.btn-accent:disabled { opacity: 0.4; cursor: not-allowed; }
.loading, .empty { color: #6b7a99; padding: 40px 0; text-align: center; }
.links-list { display: flex; flex-direction: column; gap: 12px; }
.link-card { background: #0f1834; border-radius: 10px; padding: 16px 20px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 16px; }
.link-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.link-name { font-size: 15px; font-weight: 600; font-family: 'Manrope', sans-serif; }
.link-url { font-size: 12px; color: #9effc8; text-decoration: none; }
.link-url:hover { text-decoration: underline; }
.link-date { font-size: 11px; color: #6b7a99; }
.link-actions { display: flex; gap: 8px; }
.btn-small { padding: 6px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #e8edf8; cursor: pointer; font-size: 12px; font-family: 'Manrope', sans-serif; font-weight: 600; }
.btn-danger { border-color: rgba(215,56,59,0.3); color: #d7383b; }
</style>
