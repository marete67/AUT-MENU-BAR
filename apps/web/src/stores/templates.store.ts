import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TemplateListItem, TemplateResponse, TemplateConfig } from '@menu-bar/shared'
import { templatesApi } from '@/api/index.js'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<TemplateListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTemplates() {
    loading.value = true
    error.value = null
    try {
      templates.value = await templatesApi.list()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al cargar plantillas'
    } finally {
      loading.value = false
    }
  }

  async function deleteTemplate(id: number) {
    await templatesApi.delete(id)
    templates.value = templates.value.filter((t) => t.id !== id)
  }

  async function createTemplate(name: string, config?: TemplateConfig): Promise<number> {
    const result = await templatesApi.create({
      name,
      config: config ?? { formato: 'story', blocks: [] },
    })
    await fetchTemplates()
    return result.id
  }

  return { templates, loading, error, fetchTemplates, deleteTemplate, createTemplate }
})
