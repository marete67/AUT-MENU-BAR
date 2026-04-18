import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TemplateConfig, Block } from '@menu-bar/shared'
import { templatesApi } from '@/api/index.js'

export interface EditorBlock extends Block {
  id: string
}

export const useEditorStore = defineStore('editor', () => {
  const templateId = ref<number | null>(null)
  const templateName = ref('')
  const config = ref<TemplateConfig>({
    formato: 'story',
    blocks: [],
  })
  const blocks = ref<EditorBlock[]>([])
  const selectedBlockId = ref<string | null>(null)
  const saving = ref(false)
  const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const dirty = ref(false)

  const selectedBlock = computed(() =>
    blocks.value.find((b) => b.id === selectedBlockId.value) ?? null,
  )

  function loadTemplate(id: number, name: string, cfg: TemplateConfig) {
    templateId.value = id
    templateName.value = name
    config.value = cfg
    blocks.value = cfg.blocks.map((b, i) => ({
      ...b,
      id: `block-${i}-${Date.now()}`,
    }))
    dirty.value = false
    saveStatus.value = 'idle'
  }

  function addBlock(type: 'variable' | 'static') {
    const newBlock: EditorBlock = {
      id: `block-${Date.now()}`,
      type,
      label: type === 'variable' ? 'Nueva variable' : 'Texto fijo',
      key: type === 'variable' ? `campo_${blocks.value.length + 1}` : undefined,
      content: type === 'static' ? 'Texto' : undefined,
      x: 50,
      y: 100 + blocks.value.length * 60,
      w: 300,
      align: 'center',
      font_size: 30,
    }
    blocks.value.push(newBlock)
    selectedBlockId.value = newBlock.id
    dirty.value = true
  }

  function updateBlock(id: string, patch: Partial<EditorBlock>) {
    const idx = blocks.value.findIndex((b) => b.id === id)
    if (idx === -1) return
    blocks.value[idx] = { ...blocks.value[idx]!, ...patch }
    dirty.value = true
  }

  function deleteBlock(id: string) {
    blocks.value = blocks.value.filter((b) => b.id !== id)
    if (selectedBlockId.value === id) selectedBlockId.value = null
    dirty.value = true
  }

  function selectBlock(id: string | null) {
    selectedBlockId.value = id
  }

  function updateConfig(patch: Partial<TemplateConfig>) {
    config.value = { ...config.value, ...patch }
    dirty.value = true
  }

  function toRenderConfig() {
    return {
      ...config.value,
      output_format: 'png' as const,
      blocks: blocks.value.map(({ id: _id, ...b }) => b),
    }
  }

  async function save() {
    if (!templateId.value) return
    saving.value = true
    saveStatus.value = 'saving'
    try {
      await templatesApi.update(templateId.value, {
        name: templateName.value,
        config: toRenderConfig(),
      })
      dirty.value = false
      saveStatus.value = 'saved'
      setTimeout(() => { saveStatus.value = 'idle' }, 2000)
    } catch {
      saveStatus.value = 'error'
    } finally {
      saving.value = false
    }
  }

  return {
    templateId, templateName, config, blocks, selectedBlockId, selectedBlock,
    saving, saveStatus, dirty,
    loadTemplate, addBlock, updateBlock, deleteBlock, selectBlock, updateConfig,
    toRenderConfig, save,
  }
})
