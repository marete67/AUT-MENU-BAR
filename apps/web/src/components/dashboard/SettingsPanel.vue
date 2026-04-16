<template>
  <div class="settings-wrap">

    <!-- LINKS PÚBLICOS -->
    <section class="settings-section">
      <div class="section-header">
        <div>
          <h3 class="section-title">Links públicos</h3>
          <p class="section-sub">Cada link tiene una URL pública para compartir tu menú.</p>
        </div>
        <button
          class="btn-accent"
          :disabled="links.length >= maxLinks || linksLoading"
          @click="handleCreateLink"
        >
          + Nuevo link
        </button>
      </div>

      <p class="hint">
        {{ links.length }} / {{ maxLinks }} links usados
      </p>

      <div v-if="linksLoading" class="loading">Cargando...</div>
      <div v-else-if="!links.length" class="empty">No tienes links públicos todavía.</div>
      <div v-else class="links-list">
        <div v-for="link in links" :key="link.id" class="link-card">
          <div class="link-info">
            <span class="link-name">{{ link.name }}</span>
            <a :href="`/p/${link.slug}`" target="_blank" class="link-url">/p/{{ link.slug }}</a>
            <span v-if="link.last_published_at" class="link-date">
              Publicado {{ formatDate(link.last_published_at) }}
            </span>
            <span v-else class="link-date dim">Sin publicar</span>
          </div>
          <div class="link-actions">
            <button class="btn-small" @click="handleRenameLink(link)">Renombrar</button>
            <button class="btn-small btn-danger" @click="handleDeleteLink(link.id)">Eliminar</button>
          </div>
        </div>
      </div>
    </section>

    <div class="divider" />

    <!-- LÍMITE DE LINKS -->
    <section class="settings-section">
      <h3 class="section-title">Límite de links por cuenta</h3>
      <p class="section-sub">Número máximo de links públicos que puede tener esta cuenta (1–20).</p>

      <div class="field-row">
        <input
          v-model.number="maxLinksInput"
          type="number"
          min="1"
          max="20"
          class="input-number"
          :disabled="settingsSaving"
        />
        <button
          class="btn-save"
          :disabled="settingsSaving || maxLinksInput === maxLinks"
          @click="handleSaveMaxLinks"
        >
          {{ settingsSaving ? 'Guardando…' : 'Guardar' }}
        </button>
        <span v-if="settingsSaved" class="saved-badge">✓ Guardado</span>
      </div>
    </section>

    <div class="divider" />

    <!-- CAMBIAR CONTRASEÑA -->
    <section class="settings-section">
      <h3 class="section-title">Contraseña</h3>
      <p class="section-sub">Cambia tu contraseña de acceso.</p>

      <form class="password-form" @submit.prevent="handleChangePassword">
        <input
          v-model="pwForm.current"
          type="password"
          placeholder="Contraseña actual"
          class="input-text"
          autocomplete="current-password"
        />
        <input
          v-model="pwForm.newPassword"
          type="password"
          placeholder="Nueva contraseña (mín. 8 caracteres)"
          class="input-text"
          autocomplete="new-password"
        />
        <input
          v-model="pwForm.confirm"
          type="password"
          placeholder="Confirmar nueva contraseña"
          class="input-text"
          autocomplete="new-password"
        />
        <div v-if="pwError" class="error-msg">{{ pwError }}</div>
        <div v-if="pwSuccess" class="success-msg">✓ Contraseña actualizada</div>
        <button type="submit" class="btn-save" :disabled="pwSaving">
          {{ pwSaving ? 'Guardando…' : 'Cambiar contraseña' }}
        </button>
      </form>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { linksApi, settingsApi, authApi } from '@/api/index.js'
import type { LinkResponse } from '@menu-bar/shared'

// ===== LINKS =====
const links = ref<LinkResponse[]>([])
const linksLoading = ref(false)

async function fetchLinks() {
  linksLoading.value = true
  try { links.value = await linksApi.list() }
  finally { linksLoading.value = false }
}

async function handleCreateLink() {
  const name = prompt('Nombre del link:')?.trim()
  if (!name) return
  await linksApi.create({ name })
  await fetchLinks()
}

async function handleRenameLink(link: LinkResponse) {
  const name = prompt('Nuevo nombre:', link.name)?.trim()
  if (!name || name === link.name) return
  await linksApi.update(link.id, { name })
  await fetchLinks()
}

async function handleDeleteLink(id: number) {
  if (!confirm('¿Eliminar este link público?')) return
  await linksApi.delete(id)
  await fetchLinks()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ===== SETTINGS (maxPublicLinks) =====
const maxLinks = ref(3)
const maxLinksInput = ref(3)
const settingsSaving = ref(false)
const settingsSaved = ref(false)

async function fetchSettings() {
  const s = await settingsApi.get()
  maxLinks.value = s.maxPublicLinks
  maxLinksInput.value = s.maxPublicLinks
}

async function handleSaveMaxLinks() {
  settingsSaving.value = true
  settingsSaved.value = false
  try {
    await settingsApi.update({ maxPublicLinks: maxLinksInput.value })
    maxLinks.value = maxLinksInput.value
    settingsSaved.value = true
    setTimeout(() => { settingsSaved.value = false }, 2500)
  } finally {
    settingsSaving.value = false
  }
}

// ===== CHANGE PASSWORD =====
const pwForm = ref({ current: '', newPassword: '', confirm: '' })
const pwSaving = ref(false)
const pwError = ref('')
const pwSuccess = ref(false)

async function handleChangePassword() {
  pwError.value = ''
  pwSuccess.value = false

  if (pwForm.value.newPassword.length < 8) {
    pwError.value = 'La nueva contraseña debe tener al menos 8 caracteres'
    return
  }
  if (pwForm.value.newPassword !== pwForm.value.confirm) {
    pwError.value = 'Las contraseñas no coinciden'
    return
  }

  pwSaving.value = true
  try {
    await authApi.changePassword({ current: pwForm.value.current, newPassword: pwForm.value.newPassword })
    pwSuccess.value = true
    pwForm.value = { current: '', newPassword: '', confirm: '' }
    setTimeout(() => { pwSuccess.value = false }, 3000)
  } catch (err) {
    pwError.value = err instanceof Error ? err.message : 'Error al cambiar la contraseña'
  } finally {
    pwSaving.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchLinks(), fetchSettings()])
})
</script>

<style scoped>
.settings-wrap { display: flex; flex-direction: column; gap: 0; max-width: 680px; }

.settings-section { padding: 28px 0; }

.section-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  margin-bottom: 16px;
}
.section-title { font-size: 15px; font-weight: 700; font-family: 'Manrope', sans-serif; margin: 0 0 4px; }
.section-sub { font-size: 12px; color: #6b7a99; margin: 0; }

.hint { font-size: 12px; color: #6b7a99; margin: 0 0 16px; }

.divider { height: 1px; background: rgba(255,255,255,0.05); }

.btn-accent {
  padding: 8px 16px; border-radius: 6px; border: none;
  background: linear-gradient(135deg, #00ec9a, #9effc8);
  color: #060d24; font-weight: 700; font-family: 'Manrope', sans-serif;
  font-size: 13px; cursor: pointer; transition: opacity 0.15s; white-space: nowrap; flex-shrink: 0;
}
.btn-accent:hover:not(:disabled) { opacity: 0.9; }
.btn-accent:disabled { opacity: 0.4; cursor: not-allowed; }

.links-list { display: flex; flex-direction: column; gap: 10px; }
.link-card {
  background: #0f1834; border-radius: 8px; padding: 14px 16px;
  border: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.link-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.link-name { font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; }
.link-url { font-size: 12px; color: #9effc8; text-decoration: none; }
.link-url:hover { text-decoration: underline; }
.link-date { font-size: 11px; color: #6b7a99; }
.link-date.dim { opacity: 0.5; }
.link-actions { display: flex; gap: 8px; flex-shrink: 0; }

.btn-small {
  padding: 6px 12px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1); background: transparent;
  color: #e8edf8; cursor: pointer; font-size: 12px;
  font-family: 'Manrope', sans-serif; font-weight: 600;
  transition: all 0.15s;
}
.btn-small:hover { background: rgba(255,255,255,0.06); }
.btn-danger { border-color: rgba(215,56,59,0.3); color: #d7383b; }
.btn-danger:hover { background: rgba(215,56,59,0.1); }

.field-row { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.input-number {
  width: 80px; padding: 8px 12px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1); background: #0f1834;
  color: #e8edf8; font-size: 14px; font-family: 'Manrope', sans-serif;
  outline: none;
}
.input-number:focus { border-color: rgba(158,255,200,0.4); }
.input-number:disabled { opacity: 0.5; }

.btn-save {
  padding: 8px 16px; border-radius: 6px; border: none;
  background: rgba(158,255,200,0.1); color: #9effc8;
  font-weight: 700; font-family: 'Manrope', sans-serif; font-size: 13px;
  cursor: pointer; transition: all 0.15s; border: 1px solid rgba(158,255,200,0.2);
}
.btn-save:hover:not(:disabled) { background: rgba(158,255,200,0.2); }
.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

.saved-badge { font-size: 12px; color: #9effc8; font-weight: 600; }

.password-form { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.input-text {
  padding: 9px 12px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1); background: #0f1834;
  color: #e8edf8; font-size: 14px; font-family: 'Manrope', sans-serif;
  outline: none;
}
.input-text:focus { border-color: rgba(158,255,200,0.4); }

.error-msg { font-size: 13px; color: #d7383b; }
.success-msg { font-size: 13px; color: #9effc8; }

.loading, .empty { font-size: 13px; color: #6b7a99; padding: 20px 0; }
</style>
