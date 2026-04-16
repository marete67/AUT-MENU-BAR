<template>
  <div class="canvas-area" @click.self="store.selectBlock(null)">
    <div class="canvas-wrap">
      <!-- Tabs de formato -->
      <div class="format-tabs">
        <button
          v-for="fmt in formats"
          :key="fmt.value"
          :class="['fmt-tab', { active: store.config.formato === fmt.value }]"
          @click="store.updateConfig({ formato: fmt.value })"
        >
          {{ fmt.label }}
        </button>
      </div>

      <!-- Canvas principal -->
      <div
        ref="canvasEl"
        class="canvas-container"
        :style="{ width: CANVAS_W + 'px', height: CANVAS_H + 'px' }"
        @click.self="store.selectBlock(null)"
      >
        <!-- Fondo -->
        <div
          class="canvas-bg"
          :style="fondoStyle"
        />

        <!-- Guías del centro -->
        <div class="guide h" :style="{ top: CANVAS_H / 2 + 'px' }" />
        <div class="guide v" :style="{ left: CANVAS_W / 2 + 'px' }" />

        <!-- Bloques -->
        <TextBlock
          v-for="block in store.blocks"
          :key="block.id"
          :block="block"
          :canvas-w="CANVAS_W"
          :canvas-h="CANVAS_H"
          :scale="scale"
          :selected="store.selectedBlockId === block.id"
          @select="store.selectBlock(block.id)"
          @update="(patch) => store.updateBlock(block.id, patch)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '@/stores/editor.store.js'
import TextBlock from './TextBlock.vue'

const store = useEditorStore()
const canvasEl = ref<HTMLDivElement | null>(null)

const formats = [
  { value: 'story' as const, label: 'Story Instagram' },
  { value: 'folio' as const, label: 'A4 / Folio' },
]

const REAL_DIMS = { story: { w: 1080, h: 1920 }, folio: { w: 2480, h: 3508 } }
const DISPLAY_W = 405

const realDim = computed(() => REAL_DIMS[store.config.formato ?? 'story'])
const scale = computed(() => DISPLAY_W / realDim.value.w)
const CANVAS_W = DISPLAY_W
const CANVAS_H = computed(() => Math.round(realDim.value.h * scale.value))

const fondoStyle = computed(() => {
  if (store.config.fondo_b64) {
    return { backgroundImage: `url(data:image/jpeg;base64,${store.config.fondo_b64})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (store.config.fondo_png) {
    return { backgroundImage: `url(/assets/${store.config.fondo_png})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: '#1a2547' }
})
</script>

<style scoped>
.canvas-area {
  flex: 1; overflow: auto; background: #060d24;
  display: flex; align-items: flex-start; justify-content: center;
  padding: 28px 20px;
}
.canvas-wrap { position: relative; flex-shrink: 0; }
.format-tabs { display: flex; gap: 5px; margin-bottom: 10px; }
.fmt-tab {
  padding: 5px 14px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1); background: transparent;
  color: #6b7a99; cursor: pointer; font-size: 11px;
  font-family: 'Manrope', sans-serif; font-weight: 600; transition: all 0.15s;
}
.fmt-tab.active { background: #151e3c; color: #e8edf8; border-color: rgba(158,255,200,0.25); }
.canvas-container {
  position: relative; background: #fff; overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(158,255,200,0.08), 0 20px 60px rgba(0,0,0,0.6);
}
.canvas-bg { position: absolute; inset: 0; pointer-events: none; }
.guide { position: absolute; background: rgba(244,63,94,0.6); pointer-events: none; }
.guide.h { left: 0; right: 0; height: 1px; }
.guide.v { top: 0; bottom: 0; width: 1px; }
</style>
