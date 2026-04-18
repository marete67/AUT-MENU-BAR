<template>
  <aside class="sidebar" :class="{ 'sheet-open': store.mobileSheetOpen }">
    <!-- SECCIÓN: FONDO -->
    <div class="sec" data-section="fondo" :class="{ 'section-active': store.mobileSection === 'fondo' }">
      <div class="sec-title">Fondo</div>
      <div class="field">
        <input type="file" accept="image/*" @change="onFondoChange">
        <div v-if="store.config.fondo_b64 || store.config.fondo_png" class="upload-ok">
          <span>✓ Fondo cargado</span>
        </div>
      </div>
      <label class="row-check">
        <input
          type="checkbox"
          :checked="store.config.fondo_locked"
          @change="store.updateConfig({ fondo_locked: ($event.target as HTMLInputElement).checked })"
        >
        Bloquear fondo en plantilla
      </label>
    </div>

    <!-- SECCIÓN: BLOQUES -->
    <div class="sec" data-section="bloques" :class="{ 'section-active': store.mobileSection === 'bloques' }">
      <div class="sec-title">Bloques de texto</div>
      <div class="block-list">
        <div
          v-for="block in store.blocks"
          :key="block.id"
          class="block-item"
          :class="{ selected: store.selectedBlockId === block.id, 'is-static': block.type === 'static' }"
          @click="store.selectBlock(block.id)"
        >
          <span class="bi-badge" :class="block.type">{{ block.type === 'variable' ? 'VAR' : 'EST' }}</span>
          <span class="bi-label">{{ block.label ?? block.key ?? '—' }}</span>
          <button class="bi-del" @click.stop="store.deleteBlock(block.id)">×</button>
        </div>
      </div>
      <div class="add-btns">
        <button class="add-btn var" @click="store.addBlock('variable')">+ Variable</button>
        <button class="add-btn sta" @click="store.addBlock('static')">+ Estático</button>
      </div>
    </div>

    <!-- SECCIÓN: PROPIEDADES -->
    <div class="sec" data-section="props" :class="{ 'section-active': store.mobileSection === 'props' }">
      <div class="sec-title">Propiedades</div>
      <template v-if="store.selectedBlock">
        <BlockPropsPanel :block="store.selectedBlock" @update="(p) => store.updateBlock(store.selectedBlock!.id, p)" />
      </template>
      <p v-else class="no-selection">Selecciona un bloque en el canvas</p>
    </div>

    <!-- SECCIÓN: PREVISUALIZACIÓN -->
    <div class="sec" data-section="preview" :class="{ 'section-active': store.mobileSection === 'preview' }">
      <div class="sec-title">Previsualización</div>
      <button class="btn-preview" :disabled="previewing" @click="handlePreview">
        {{ previewing ? 'Generando...' : 'Renderizar preview' }}
      </button>
      <p v-if="previewError" class="prev-status err">{{ previewError }}</p>
      <img v-if="previewUrl" :src="previewUrl" alt="Preview" class="prev-img">
      <a v-if="previewUrl" :href="previewUrl" download="menu-preview.png" class="prev-dl">
        ↓ Descargar
      </a>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '@/stores/editor.store.js'
import { renderApi } from '@/api/index.js'
import BlockPropsPanel from './BlockPropsPanel.vue'

const store = useEditorStore()
const previewing = ref(false)
const previewUrl = ref<string | null>(null)
const previewError = ref('')

async function onFondoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result as string
    const b64 = result.split(',')[1] ?? ''
    store.updateConfig({ fondo_b64: b64, fondo_png: undefined })
  }
  reader.readAsDataURL(file)
}

async function handlePreview() {
  previewing.value = true
  previewError.value = ''
  try {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = await renderApi.render(store.toRenderConfig())
  } catch (err) {
    previewError.value = err instanceof Error ? err.message : 'Error de render'
  } finally {
    previewing.value = false
  }
}
</script>

<style scoped>
.sidebar {
  width: 280px; flex-shrink: 0;
  background: #0f1834; overflow-y: auto;
  display: flex; flex-direction: column;
  border-left: 1px solid rgba(255,255,255,0.04);
}
.sec {
  padding: 13px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  display: flex; flex-direction: column; gap: 8px;
}
.sec-title {
  font-family: 'Manrope', sans-serif; font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em; color: #00ec9a;
}
.field { display: flex; flex-direction: column; gap: 3px; }
.field label { font-size: 11px; color: #6b7a99; }
.field input[type="file"] {
  font-size: 11px; color: #6b7a99; background: #151e3c;
  border: 1.5px dashed rgba(158,255,200,0.2); padding: 7px 9px;
  border-radius: 4px; width: 100%; cursor: pointer;
}
.upload-ok { font-size: 11px; color: #00ec9a; padding: 4px 0; }
.row-check { display: flex; align-items: center; gap: 7px; font-size: 11px; color: #6b7a99; cursor: pointer; }
.row-check input { accent-color: #00ec9a; }

.block-list { display: flex; flex-direction: column; gap: 4px; }
.block-item {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px;
  border-radius: 4px; background: #151e3c; cursor: pointer;
  border: 1px solid transparent; transition: background 0.1s;
}
.block-item:hover { background: #1a2547; }
.block-item.selected { border-color: rgba(129,140,248,0.5); }
.block-item.is-static.selected { border-color: rgba(245,158,11,0.5); }
.bi-badge { font-size: 8px; font-weight: 700; font-family: 'Manrope', sans-serif; padding: 2px 5px; border-radius: 2px; flex-shrink: 0; }
.bi-badge.variable { background: rgba(129,140,248,0.2); color: #818cf8; }
.bi-badge.static { background: rgba(245,158,11,0.2); color: #f59e0b; }
.bi-label { font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bi-del { font-size: 14px; color: #6b7a99; cursor: pointer; padding: 0 2px; line-height: 1; background: none; border: none; }
.bi-del:hover { color: #d7383b; }

.add-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.add-btn {
  padding: 7px; border-radius: 4px; cursor: pointer; font-size: 11px;
  font-weight: 600; font-family: 'Manrope', sans-serif; text-align: center;
  background: transparent; border: 1.5px dashed; transition: all 0.15s;
}
.add-btn.var { border-color: rgba(129,140,248,0.4); color: #818cf8; }
.add-btn.var:hover { background: rgba(129,140,248,0.1); }
.add-btn.sta { border-color: rgba(245,158,11,0.4); color: #f59e0b; }
.add-btn.sta:hover { background: rgba(245,158,11,0.1); }

.no-selection { font-size: 11px; color: #6b7a99; text-align: center; padding: 8px 0; }

.btn-preview {
  background: #151e3c; color: #6b7a99;
  border: 1px solid rgba(255,255,255,0.1); padding: 9px;
  border-radius: 4px; font-size: 12px; font-weight: 600;
  font-family: 'Manrope', sans-serif; cursor: pointer; width: 100%;
  transition: all 0.15s;
}
.btn-preview:hover { color: #e8edf8; border-color: rgba(255,255,255,0.25); }
.btn-preview:disabled { opacity: 0.5; cursor: not-allowed; }
.prev-status.err { font-size: 11px; color: #d7383b; }
.prev-img { width: 100%; border-radius: 4px; margin-top: 4px; }
.prev-dl { display: block; text-align: center; font-size: 11px; color: #00ec9a; text-decoration: none; padding: 4px; font-family: 'Manrope', sans-serif; }

/* MOBILE: bottom sheet */
@media (max-width: 768px) {
  .sidebar {
    position: fixed; bottom: 56px; left: 0; right: 0;
    width: 100% !important; flex-shrink: 0;
    max-height: 58vh;
    background: #0f1834;
    border-top: 1px solid rgba(255,255,255,0.1);
    border-left: none;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 32px rgba(0,0,0,0.55);
    transform: translateY(100%);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    z-index: 100; overflow-y: auto; -webkit-overflow-scrolling: touch;
  }
  .sidebar::before {
    content: ''; display: block; width: 36px; height: 4px;
    background: rgba(255,255,255,0.18); border-radius: 2px;
    margin: 10px auto 4px; flex-shrink: 0;
  }
  .sidebar.sheet-open { transform: translateY(0); }

  /* En móvil, cada sección oculta; solo muestra la activa */
  .sec { display: none; }
  .sec.section-active { display: flex; }
}
</style>
