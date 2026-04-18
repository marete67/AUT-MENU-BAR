<template>
  <div class="editor">
    <!-- HEADER -->
    <header class="editor-header">
      <div class="logo"><span>[</span> EDITOR <span>]</span></div>
      <input
        v-model="store.templateName"
        type="text"
        class="tpl-name-input"
        placeholder="Nombre de la plantilla..."
        maxlength="80"
        @input="store.dirty = true"
      >
      <div class="header-right">
        <span class="save-status" :class="store.saveStatus">
          {{ saveStatusText }}
        </span>
        <button class="hdr-btn" @click="router.push('/dashboard')">← Volver</button>
        <button class="hdr-btn save-btn" :disabled="store.saving" @click="store.save()">
          Guardar
        </button>
      </div>
    </header>

    <main class="editor-main">
      <!-- CANVAS -->
      <EditorCanvas />

      <!-- SIDEBAR -->
      <EditorSidebar />
    </main>

    <!-- BOTTOM NAV (solo móvil) -->
    <nav class="bottom-nav">
      <button class="bn-tab" :class="{ active: store.mobileSection === 'fondo' && store.mobileSheetOpen }" @click="store.toggleMobileSection('fondo')">
        <span class="bn-icon">🖼</span>
        <span class="bn-label">Fondo</span>
      </button>
      <button class="bn-tab" :class="{ active: store.mobileSection === 'bloques' && store.mobileSheetOpen }" @click="store.toggleMobileSection('bloques')">
        <span class="bn-icon">☰</span>
        <span class="bn-label">Bloques</span>
      </button>
      <button class="bn-tab" :class="{ active: store.mobileSection === 'props' && store.mobileSheetOpen }" @click="store.toggleMobileSection('props')">
        <span class="bn-icon">✏️</span>
        <span class="bn-label">Props</span>
      </button>
      <button class="bn-tab" :class="{ active: store.mobileSection === 'preview' && store.mobileSheetOpen }" @click="store.toggleMobileSection('preview')">
        <span class="bn-icon">👁</span>
        <span class="bn-label">Preview</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useEditorStore } from '@/stores/editor.store.js'
import { templatesApi } from '@/api/index.js'
import EditorCanvas from '@/components/editor/EditorCanvas.vue'
import EditorSidebar from '@/components/editor/EditorSidebar.vue'

const router = useRouter()
const route = useRoute()
const store = useEditorStore()

const saveStatusText = computed(() => {
  switch (store.saveStatus) {
    case 'saving': return 'Guardando...'
    case 'saved': return '✓ Guardado'
    case 'error': return '✗ Error al guardar'
    default: return store.dirty ? 'Sin guardar' : ''
  }
})

onMounted(async () => {
  const id = Number(route.params['id'])

  if (!id) {
    try {
      const emptyConfig = { formato: 'story' as const, blocks: [] }
      const result = await templatesApi.create({ name: 'Nueva plantilla', config: emptyConfig })
      store.loadTemplate(result.id, result.name, emptyConfig)
      router.replace(`/editor/${result.id}`)
    } catch {
      router.push('/dashboard')
    }
    return
  }

  try {
    const tpl = await templatesApi.get(id)
    store.loadTemplate(tpl.id, tpl.name, tpl.config)
  } catch {
    router.push('/dashboard')
  }
})
</script>

<style scoped>
.editor { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #060d24; color: #e8edf8; }

.editor-header {
  height: 48px; padding: 0 16px;
  background: #0f1834;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.logo { font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 700; white-space: nowrap; }
.logo span { color: #9effc8; }

.tpl-name-input {
  flex: 1; max-width: 280px;
  background: #151e3c; border: none; border-bottom: 2px solid transparent;
  color: #e8edf8; padding: 5px 10px; border-radius: 4px 4px 0 0;
  font-size: 13px; font-family: 'Manrope', sans-serif; font-weight: 600;
  outline: none; transition: border-color 0.15s;
}
.tpl-name-input:focus { border-bottom-color: #00ec9a; }

.header-right { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.save-status { font-size: 11px; min-width: 80px; text-align: right; color: #6b7a99; }
.save-status.saved { color: #00ec9a; }
.save-status.error { color: #d7383b; }

.hdr-btn {
  padding: 5px 12px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1); background: transparent;
  color: #6b7a99; cursor: pointer; font-size: 11px;
  font-family: 'Manrope', sans-serif; font-weight: 600;
  letter-spacing: 0.05em; transition: all 0.15s;
}
.hdr-btn:hover { color: #e8edf8; border-color: rgba(255,255,255,0.25); }
.save-btn {
  background: linear-gradient(135deg, #00ec9a, #9effc8);
  color: #060d24; border-color: transparent; font-weight: 700;
}
.save-btn:disabled { background: #1a2547; color: #6b7a99; cursor: not-allowed; }

.editor-main { display: flex; flex: 1; overflow: hidden; }

/* BOTTOM NAV */
.bottom-nav {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; height: 56px;
  background: #0f1834; border-top: 1px solid rgba(255,255,255,0.08);
  z-index: 101; align-items: stretch;
}
.bn-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; background: transparent; border: none; color: #6b7a99; cursor: pointer;
  font-family: 'Inter', sans-serif; padding: 0; position: relative; transition: color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.bn-tab.active { color: #00ec9a; }
.bn-tab.active::after {
  content: ''; position: absolute; top: 0; left: 20%; right: 20%;
  height: 2px; background: #00ec9a; border-radius: 0 0 2px 2px;
}
.bn-icon { font-size: 20px; line-height: 1; }
.bn-label { font-size: 10px; font-weight: 600; font-family: 'Manrope', sans-serif; letter-spacing: 0.04em; }

/* MOBILE */
@media (max-width: 768px) {
  .editor { height: 100dvh; overflow: hidden; }

  .editor-header {
    height: auto; flex-wrap: wrap; padding: 8px 12px; gap: 6px; align-items: center;
  }
  .logo { font-size: 12px; }
  .tpl-name-input { order: 10; flex: 1 1 100%; max-width: none; }
  .header-right { gap: 4px; }
  .save-status { display: none; }
  .hdr-btn { padding: 5px 10px; font-size: 11px; }

  .bottom-nav { display: flex; }
}
</style>
