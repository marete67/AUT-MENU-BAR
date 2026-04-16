<template>
  <div class="composer">

    <!-- CABECERA -->
    <div class="composer-header">
      <div>
        <h2 class="section-title">Compositor de menú</h2>
        <p class="section-sub">Añade plantillas y define cuántas páginas quieres de cada una</p>
      </div>
      <button class="btn-accent" @click="showPicker = true">+ Agregar plantilla</button>
    </div>

    <!-- ESTADO VACÍO -->
    <div v-if="!items.length" class="empty-state">
      <div class="empty-icon">☰</div>
      <p class="empty-title">Empieza componiendo tu menú</p>
      <p class="empty-sub">Pulsa «Agregar plantilla» para añadir una de tus plantillas guardadas</p>
      <button class="btn-accent" @click="showPicker = true">+ Agregar plantilla</button>
    </div>

    <!-- LISTA DE PLANTILLAS AÑADIDAS -->
    <div v-else>
      <div class="items-list">
        <div v-for="(item, idx) in items" :key="item.templateId" class="item-row">
          <div class="item-order">{{ idx + 1 }}</div>
          <div class="item-name">{{ item.name }}</div>
          <div class="item-pages">
            <label class="pages-label">Páginas</label>
            <div class="pages-control">
              <button class="pages-btn" :disabled="item.pages <= 1" @click="item.pages--">−</button>
              <input
                v-model.number="item.pages"
                type="number"
                min="1"
                max="50"
                class="pages-input"
              />
              <button class="pages-btn" :disabled="item.pages >= 50" @click="item.pages++">+</button>
            </div>
          </div>
          <button class="btn-remove" @click="removeItem(idx)" title="Quitar">✕</button>
        </div>
      </div>

      <!-- RESUMEN Y ACCIONES -->
      <div class="actions-bar">
        <span class="total-count">
          Total: <strong>{{ totalPages }} {{ totalPages === 1 ? 'página' : 'páginas' }}</strong>
        </span>
        <div class="action-btns">
          <button class="btn-secondary" :disabled="!!generating" @click="handleExport">
            <span v-if="generating === 'export'">Generando…</span>
            <span v-else>Exportar ZIP</span>
          </button>
          <button class="btn-accent" :disabled="!!generating" @click="showLinkPicker = true">
            Publicar en link
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: SELECTOR DE PLANTILLA -->
    <Teleport to="body">
      <div v-if="showPicker" class="overlay" @click.self="showPicker = false">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Selecciona una plantilla</h3>
            <button class="modal-close" @click="showPicker = false">✕</button>
          </div>

          <div v-if="templatesStore.loading" class="modal-loading">Cargando…</div>
          <div v-else-if="!templatesStore.templates.length" class="modal-empty">
            No tienes plantillas guardadas todavía.
            <br />Ve a <strong>Mis plantillas</strong> para crear una.
          </div>
          <div v-else class="picker-grid">
            <button
              v-for="tpl in templatesStore.templates"
              :key="tpl.id"
              class="picker-card"
              :class="{ added: isAdded(tpl.id) }"
              @click="addTemplate(tpl)"
            >
              <span class="picker-name">{{ tpl.name }}</span>
              <span v-if="isAdded(tpl.id)" class="picker-tag">Añadida</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- MODAL: SELECTOR DE LINK PÚBLICO -->
    <Teleport to="body">
      <div v-if="showLinkPicker" class="overlay" @click.self="showLinkPicker = false">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">¿En qué link quieres publicar?</h3>
            <button class="modal-close" @click="showLinkPicker = false">✕</button>
          </div>

          <div v-if="linksLoading" class="modal-loading">Cargando…</div>
          <div v-else-if="!links.length" class="modal-empty">
            No tienes links públicos. Créalos en <strong>Ajustes</strong>.
          </div>
          <div v-else class="link-picker-list">
            <button
              v-for="link in links"
              :key="link.id"
              class="link-picker-row"
              :disabled="generating === 'publish'"
              @click="handlePublish(link.id)"
            >
              <div class="lp-info">
                <span class="lp-name">{{ link.name }}</span>
                <span class="lp-slug">/p/{{ link.slug }}</span>
              </div>
              <span v-if="generating === 'publish' && publishingLinkId === link.id" class="lp-status">
                Publicando…
              </span>
              <span v-else class="lp-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTemplatesStore } from '@/stores/templates.store.js'
import { templatesApi, linksApi, exportApi } from '@/api/index.js'
import type { TemplateListItem, LinkResponse, RenderPage } from '@menu-bar/shared'

const templatesStore = useTemplatesStore()

// ===== ITEMS DEL COMPOSITOR =====
interface ComposerItem {
  templateId: number
  name: string
  pages: number
}

const items = ref<ComposerItem[]>([])
const totalPages = computed(() => items.value.reduce((sum, i) => sum + i.pages, 0))

function isAdded(id: number) {
  return items.value.some((i) => i.templateId === id)
}

function addTemplate(tpl: TemplateListItem) {
  if (isAdded(tpl.id)) return
  items.value.push({ templateId: tpl.id, name: tpl.name, pages: 1 })
  showPicker.value = false
}

function removeItem(idx: number) {
  items.value.splice(idx, 1)
}

// ===== MODAL PICKER =====
const showPicker = ref(false)

// ===== LINKS =====
const links = ref<LinkResponse[]>([])
const linksLoading = ref(false)
const showLinkPicker = ref(false)
const publishingLinkId = ref<number | null>(null)

async function fetchLinks() {
  linksLoading.value = true
  try { links.value = await linksApi.list() }
  finally { linksLoading.value = false }
}

// ===== GENERACIÓN =====
const generating = ref<false | 'export' | 'publish'>(false)

async function buildPages(): Promise<RenderPage[]> {
  const pages: RenderPage[] = []
  for (const item of items.value) {
    const tpl = await templatesApi.get(item.templateId)
    for (let i = 0; i < item.pages; i++) {
      pages.push({
        ...tpl.config,
        output_format: 'png',
        file_name: `${tpl.name.replace(/\s+/g, '_')}_${i + 1}`,
      } as RenderPage)
    }
  }
  return pages
}

async function handleExport() {
  generating.value = 'export'
  try {
    const pages = await buildPages()
    await exportApi.export({ pages, format: 'zip' }, 'menu.zip')
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Error al exportar')
  } finally {
    generating.value = false
  }
}

async function handlePublish(linkId: number) {
  generating.value = 'publish'
  publishingLinkId.value = linkId
  try {
    const pages = await buildPages()
    const { url } = await linksApi.publish(linkId, pages)
    showLinkPicker.value = false
    alert(`✅ Publicado correctamente\n${url}`)
    await fetchLinks()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Error al publicar')
  } finally {
    generating.value = false
    publishingLinkId.value = null
  }
}

onMounted(async () => {
  await Promise.all([
    templatesStore.fetchTemplates(),
    fetchLinks(),
  ])
})
</script>

<style scoped>
.composer { display: flex; flex-direction: column; gap: 0; }

.composer-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 32px;
}
.section-title { font-size: 18px; font-weight: 700; font-family: 'Manrope', sans-serif; margin: 0 0 4px; }
.section-sub { font-size: 13px; color: #6b7a99; margin: 0; }

/* EMPTY */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 0; gap: 12px; text-align: center;
}
.empty-icon { font-size: 40px; opacity: 0.2; }
.empty-title { font-size: 16px; font-weight: 600; font-family: 'Manrope', sans-serif; margin: 0; }
.empty-sub { font-size: 13px; color: #6b7a99; margin: 0; max-width: 340px; }

/* ITEMS */
.items-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }

.item-row {
  display: flex; align-items: center; gap: 16px;
  background: #0f1834; border-radius: 8px; padding: 14px 16px;
  border: 1px solid rgba(255,255,255,0.05);
}
.item-order {
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(158,255,200,0.08); color: #9effc8;
  font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.item-name { flex: 1; font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; }

.item-pages { display: flex; align-items: center; gap: 10px; }
.pages-label { font-size: 12px; color: #6b7a99; font-family: 'Manrope', sans-serif; }
.pages-control { display: flex; align-items: center; gap: 6px; }
.pages-btn {
  width: 28px; height: 28px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1); background: transparent;
  color: #e8edf8; cursor: pointer; font-size: 16px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.pages-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); }
.pages-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pages-input {
  width: 48px; text-align: center; padding: 4px;
  border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);
  background: #060d24; color: #e8edf8;
  font-size: 14px; font-family: 'Manrope', sans-serif; outline: none;
}
.btn-remove {
  width: 28px; height: 28px; border-radius: 4px; border: none;
  background: transparent; color: #6b7a99; cursor: pointer; font-size: 14px;
  transition: color 0.15s; flex-shrink: 0;
}
.btn-remove:hover { color: #d7383b; }

/* ACTIONS BAR */
.actions-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.05);
}
.total-count { font-size: 13px; color: #6b7a99; font-family: 'Manrope', sans-serif; }
.total-count strong { color: #e8edf8; }
.action-btns { display: flex; gap: 10px; }

/* BUTTONS */
.btn-accent {
  padding: 8px 18px; border-radius: 6px; border: none;
  background: linear-gradient(135deg, #00ec9a, #9effc8);
  color: #060d24; font-weight: 700; font-family: 'Manrope', sans-serif;
  font-size: 13px; cursor: pointer; transition: opacity 0.15s;
}
.btn-accent:hover:not(:disabled) { opacity: 0.9; }
.btn-accent:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-secondary {
  padding: 8px 18px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.12); background: transparent;
  color: #e8edf8; font-weight: 600; font-family: 'Manrope', sans-serif;
  font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.05); }
.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

/* OVERLAY / MODAL */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 500; padding: 24px;
}
.modal {
  background: #0f1834; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  width: 100%; max-width: 520px; max-height: 70vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.modal-title { font-size: 15px; font-weight: 700; font-family: 'Manrope', sans-serif; margin: 0; }
.modal-close {
  background: none; border: none; color: #6b7a99; cursor: pointer;
  font-size: 16px; padding: 4px; transition: color 0.15s;
}
.modal-close:hover { color: #e8edf8; }
.modal-loading, .modal-empty {
  padding: 40px 24px; text-align: center; color: #6b7a99; font-size: 13px;
}

/* TEMPLATE PICKER */
.picker-grid {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 24px; overflow-y: auto;
}
.picker-card {
  width: 100%; padding: 14px 16px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.07); background: #060d24;
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; text-align: left; transition: border-color 0.15s, background 0.15s;
}
.picker-card:hover:not(.added) { border-color: rgba(158,255,200,0.3); background: rgba(158,255,200,0.04); }
.picker-card.added { opacity: 0.45; cursor: default; }
.picker-name { font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; color: #e8edf8; }
.picker-tag { font-size: 11px; color: #9effc8; font-weight: 700; font-family: 'Manrope', sans-serif; }

/* LINK PICKER */
.link-picker-list { display: flex; flex-direction: column; gap: 0; overflow-y: auto; }
.link-picker-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border: none; background: transparent;
  border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;
  transition: background 0.15s; width: 100%; text-align: left;
}
.link-picker-row:last-child { border-bottom: none; }
.link-picker-row:hover:not(:disabled) { background: rgba(255,255,255,0.04); }
.link-picker-row:disabled { opacity: 0.5; cursor: not-allowed; }
.lp-info { display: flex; flex-direction: column; gap: 3px; }
.lp-name { font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; color: #e8edf8; }
.lp-slug { font-size: 12px; color: #9effc8; }
.lp-status { font-size: 12px; color: #6b7a99; }
.lp-arrow { color: #6b7a99; font-size: 16px; transition: color 0.15s; }
.link-picker-row:hover .lp-arrow { color: #9effc8; }
</style>
