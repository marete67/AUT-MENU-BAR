<template>
  <div
    class="text-block"
    :class="{ selected, 'is-static': block.type === 'static' }"
    :style="blockStyle"
    @pointerdown.stop="onPointerDown"
    @click.stop
  >
    <div class="band">
      <span class="type-badge" :class="block.type">
        {{ block.type === 'variable' ? 'VAR' : 'EST' }}
      </span>
      <span class="block-lbl">{{ block.label ?? block.key ?? '—' }}</span>
      <span class="block-prev">{{ preview }}</span>
    </div>
    <!-- Handle de resize horizontal -->
    <div class="resize-handle" @pointerdown.stop="onResizeDown" />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { EditorBlock } from '@/stores/editor.store.js'

const props = defineProps<{
  block: EditorBlock
  canvasW: number
  canvasH: number
  scale: number
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
  update: [patch: Partial<EditorBlock>]
}>()

const blockStyle = computed(() => ({
  left: `${props.block.x * props.scale}px`,
  top: `${props.block.y * props.scale}px`,
  width: `${props.block.w * props.scale}px`,
}))

const preview = computed(() => {
  const c = props.block.content
  if (!c) return ''
  return Array.isArray(c) ? c.join(' / ') : String(c).split('\n')[0] ?? ''
})

// ===== DRAG (pointer events — mouse + touch) =====
let dragEl: Element | null = null
let dragStart: { x: number; y: number; blockX: number; blockY: number; moved: boolean } | null = null

function onPointerDown(e: PointerEvent) {
  emit('select')
  dragEl = e.currentTarget as Element
  dragEl.setPointerCapture(e.pointerId)
  dragStart = {
    x: e.clientX,
    y: e.clientY,
    blockX: props.block.x,
    blockY: props.block.y,
    moved: false,
  }
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!dragStart) return
  const dx = (e.clientX - dragStart.x) / props.scale
  const dy = (e.clientY - dragStart.y) / props.scale
  if (!dragStart.moved && (Math.abs(e.clientX - dragStart.x) > 3 || Math.abs(e.clientY - dragStart.y) > 3)) {
    dragStart.moved = true
  }
  emit('update', {
    x: Math.max(0, Math.min(dragStart.blockX + dx, (props.canvasW / props.scale) - props.block.w)),
    y: Math.max(0, dragStart.blockY + dy),
  })
}

function onPointerUp() {
  dragStart = null
  dragEl = null
}

// ===== RESIZE (pointer events) =====
let resizeEl: Element | null = null
let resizeStart: { x: number; blockW: number } | null = null

function onResizeDown(e: PointerEvent) {
  resizeEl = e.currentTarget as Element
  resizeEl.setPointerCapture(e.pointerId)
  resizeStart = { x: e.clientX, blockW: props.block.w }
  e.preventDefault()
}

function onResizeMove(e: PointerEvent) {
  if (!resizeStart) return
  const dx = (e.clientX - resizeStart.x) / props.scale
  emit('update', { w: Math.max(50, resizeStart.blockW + dx) })
}

function onResizeUp() {
  resizeStart = null
  resizeEl = null
}

// Registrar en window para capturar fuera del elemento
const isMounted = ref(true)

function globalPointerMove(e: PointerEvent) {
  if (dragStart) onPointerMove(e)
  if (resizeStart) onResizeMove(e)
}

function globalPointerUp(e: PointerEvent) {
  if (dragStart) onPointerUp()
  if (resizeStart) onResizeUp()
}

window.addEventListener('pointermove', globalPointerMove)
window.addEventListener('pointerup', globalPointerUp)

onUnmounted(() => {
  isMounted.value = false
  window.removeEventListener('pointermove', globalPointerMove)
  window.removeEventListener('pointerup', globalPointerUp)
})
</script>

<style scoped>
.text-block {
  position: absolute; cursor: move; user-select: none;
  min-width: 50px; min-height: 22px;
  touch-action: none;
}
.band {
  min-height: 22px; border-radius: 2px;
  display: flex; align-items: center; padding: 0 6px; gap: 3px;
  background: rgba(129,140,248,0.12);
  border: 1.5px dashed rgba(129,140,248,0.35);
  transition: filter 0.1s;
}
.text-block.is-static .band {
  background: rgba(245,158,11,0.1);
  border-color: rgba(245,158,11,0.4);
}
.text-block.selected .band { border-style: solid; filter: brightness(1.3); }
.text-block:hover .band { filter: brightness(1.2); }

.type-badge {
  font-size: 7px; font-weight: 700; font-family: 'Manrope', sans-serif;
  letter-spacing: 0.08em; padding: 1px 3px; border-radius: 2px; flex-shrink: 0;
}
.type-badge.variable { background: rgba(129,140,248,0.25); color: #818cf8; }
.type-badge.static { background: rgba(245,158,11,0.25); color: #f59e0b; }

.block-lbl {
  font-size: 8px; font-weight: 700; font-family: 'Manrope', sans-serif;
  text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap;
  flex-shrink: 0; color: #818cf8; pointer-events: none;
}
.is-static .block-lbl { color: #f59e0b; }

.block-prev {
  font-size: 9px; color: rgba(0,0,0,0.45); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  pointer-events: none; text-align: right;
}

.resize-handle {
  position: absolute; right: 0; top: 0; bottom: 0; width: 6px;
  cursor: ew-resize;
  background: rgba(129,140,248,0.15);
  border-left: 1px solid rgba(129,140,248,0.3);
  border-radius: 0 2px 2px 0;
  touch-action: none;
}
.is-static .resize-handle {
  background: rgba(245,158,11,0.15);
  border-color: rgba(245,158,11,0.3);
}

/* Resize handle más ancho en móvil para facilitar el toque */
@media (max-width: 768px) {
  .resize-handle { width: 22px; }
}
</style>
