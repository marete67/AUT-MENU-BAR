<template>
  <div class="props-panel">
    <!-- Tipo VAR / ESTÁTICO -->
    <div class="type-toggle">
      <button :class="['type-btn', 'var', { active: block.type === 'variable' }]" @click="emit('update', { type: 'variable' })">VAR</button>
      <button :class="['type-btn', 'sta', { active: block.type === 'static' }]" @click="emit('update', { type: 'static' })">EST</button>
    </div>

    <div class="field">
      <label>Etiqueta</label>
      <input type="text" :value="block.label" placeholder="Nombre del campo" @input="emit('update', { label: ($event.target as HTMLInputElement).value })">
    </div>

    <div v-if="block.type === 'variable'" class="field">
      <label>Clave (ID en formulario)</label>
      <input type="text" :value="block.key" placeholder="ej: plato_primero" @input="emit('update', { key: ($event.target as HTMLInputElement).value })">
    </div>

    <div v-else class="field">
      <label>Contenido fijo</label>
      <textarea :value="contentStr" placeholder="Texto..." @input="emit('update', { content: ($event.target as HTMLTextAreaElement).value })" />
    </div>

    <div class="field">
      <label>Alineación</label>
      <div class="align-btns">
        <button v-for="a in alignments" :key="a.v" :class="['a-btn', { active: block.align === a.v }]" @click="emit('update', { align: a.v })">{{ a.l }}</button>
      </div>
    </div>

    <div class="row2">
      <div class="field">
        <label>Tamaño fuente</label>
        <input type="number" :value="block.font_size ?? 30" min="8" max="300" @input="emit('update', { font_size: Number(($event.target as HTMLInputElement).value) })">
      </div>
      <div class="field">
        <label>Color texto</label>
        <input type="color" :value="block.text_color ?? '#000000'" @input="emit('update', { text_color: ($event.target as HTMLInputElement).value })">
      </div>
    </div>

    <div class="field">
      <label>Fuente (Google Fonts)</label>
      <input type="text" :value="block.font_family" placeholder="Open Sans" @input="emit('update', { font_family: ($event.target as HTMLInputElement).value })">
    </div>

    <div class="row2">
      <div class="field">
        <label>Espaciado letra</label>
        <input type="number" :value="block.letter_spacing ?? 1.4" step="0.1" @input="emit('update', { letter_spacing: Number(($event.target as HTMLInputElement).value) })">
      </div>
      <div class="field">
        <label>Altura de línea</label>
        <input type="number" :value="block.line_height_factor ?? 1.4" step="0.1" @input="emit('update', { line_height_factor: Number(($event.target as HTMLInputElement).value) })">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorBlock } from '@/stores/editor.store.js'

const props = defineProps<{ block: EditorBlock }>()
const emit = defineEmits<{ update: [patch: Partial<EditorBlock>] }>()

const alignments = [
  { v: 'left' as const, l: '←' },
  { v: 'center' as const, l: '↔' },
  { v: 'right' as const, l: '→' },
]

const contentStr = computed(() => {
  const c = props.block.content
  return Array.isArray(c) ? c.join('\n') : (c ?? '')
})
</script>

<style scoped>
.props-panel { display: flex; flex-direction: column; gap: 8px; }
.type-toggle { display: flex; gap: 4px; }
.type-btn {
  flex: 1; padding: 5px; border-radius: 3px; border: 1px solid;
  cursor: pointer; font-size: 10px; font-weight: 700;
  font-family: 'Manrope', sans-serif; background: transparent;
  transition: all 0.12s;
}
.type-btn.var { border-color: rgba(129,140,248,0.4); color: #6b7a99; }
.type-btn.var.active { background: rgba(129,140,248,0.2); color: #818cf8; border-color: #818cf8; }
.type-btn.sta { border-color: rgba(245,158,11,0.4); color: #6b7a99; }
.type-btn.sta.active { background: rgba(245,158,11,0.2); color: #f59e0b; border-color: #f59e0b; }
.field { display: flex; flex-direction: column; gap: 3px; }
.field label { font-size: 11px; color: #6b7a99; }
.field input, .field textarea, .field select {
  width: 100%; background: #151e3c; border: none;
  border-bottom: 2px solid transparent; color: #e8edf8;
  padding: 6px 9px; border-radius: 4px 4px 0 0;
  font-size: 12px; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.15s;
}
.field input:focus, .field textarea:focus { border-bottom-color: #00ec9a; }
.field textarea { min-height: 50px; resize: vertical; }
.field input[type="color"] { height: 32px; padding: 2px 4px; cursor: pointer; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.align-btns { display: flex; gap: 4px; }
.a-btn {
  flex: 1; padding: 5px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1); background: #151e3c;
  color: #6b7a99; cursor: pointer; font-size: 13px; font-weight: 700;
  font-family: 'Manrope', sans-serif; transition: all 0.12s;
}
.a-btn.active { background: #00ec9a; border-color: #00ec9a; color: #060d24; }
</style>
