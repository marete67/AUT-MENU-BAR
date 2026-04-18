<template>
  <div
    class="text-block"
    :class="{ selected, 'is-static': block.type === 'static' }"
    :style="blockStyle"
    @mousedown.stop="onMouseDown"
    @click.stop="emit('select')"
  >
    <div class="band">
      <span class="type-badge" :class="block.type">
        {{ block.type === 'variable' ? 'VAR' : 'EST' }}
      </span>
      <span class="block-lbl">{{ block.label ?? block.key ?? '—' }}</span>
      <span class="block-prev">{{ preview }}</span>
    </div>
    <!-- Handle de resize horizontal -->
    <div class="resize-handle" @mousedown.stop="onResizeDown" />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
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

// ===== DRAG =====
let dragStart: { mouseX: number; mouseY: number; blockX: number; blockY: number } | null = null

function onMouseDown(e: MouseEvent) {
  emit('select')
  dragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    blockX: props.block.x,
    blockY: props.block.y,
  }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragStart) return
  const dx = (e.clientX - dragStart.mouseX) / props.scale
  const dy = (e.clientY - dragStart.mouseY) / props.scale
  emit('update', {
    x: Math.max(0, dragStart.blockX + dx),
    y: Math.max(0, dragStart.blockY + dy),
  })
}

function onDragEnd() {
  dragStart = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

// ===== RESIZE =====
let resizeStart: { mouseX: number; blockW: number } | null = null

function onResizeDown(e: MouseEvent) {
  resizeStart = { mouseX: e.clientX, blockW: props.block.w }
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e: MouseEvent) {
  if (!resizeStart) return
  const dx = (e.clientX - resizeStart.mouseX) / props.scale
  emit('update', { w: Math.max(50, resizeStart.blockW + dx) })
}

function onResizeEnd() {
  resizeStart = null
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
})
</script>

<style scoped>
.text-block {
  position: absolute; cursor: move; user-select: none;
  min-width: 50px; min-height: 22px;
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
}
.is-static .resize-handle {
  background: rgba(245,158,11,0.15);
  border-color: rgba(245,158,11,0.3);
}
</style>
