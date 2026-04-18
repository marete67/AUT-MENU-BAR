<template>
  <div class="app" @click="onAppClick">

    <!-- HEADER -->
    <header>
      <div class="logo"><span>[</span> MENU BAR <span>]</span></div>
      <button class="hdr-icon-btn" title="Ajustes" @click.stop="openSettings">⚙</button>
      <button class="hdr-icon-btn" title="Salir" @click="handleLogout">⏻</button>
    </header>

    <!-- TAB BAR -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'generar' }" @click="switchTab('generar')">Generar</button>
      <button class="tab-btn" :class="{ active: activeTab === 'plantillas' }" @click="switchTab('plantillas')">Plantillas</button>
    </div>

    <!-- ===== GENERAR ===== -->
    <div v-show="activeTab === 'generar'">
      <!-- Step bar -->
      <div class="step-bar">
        <div class="step-item" :class="{ active: genStep === 1 }">
          <div class="step-num">1</div>
          <div class="step-label">Páginas</div>
        </div>
        <div class="step-sep"></div>
        <div class="step-item" :class="{ active: genStep === 2 }">
          <div class="step-num">2</div>
          <div class="step-label">Distribuir</div>
        </div>
      </div>

      <!-- STEP 1 -->
      <div v-show="genStep === 1" id="gen-step1">
        <div v-if="!genPages.length" class="gen-empty">
          <strong>Sin páginas</strong>
          <p>Añade las plantillas que quieres generar.<br>Cada una será una página del PDF o un JPG individual.</p>
          <button class="btn green" @click="openPicker">+ Añadir plantilla</button>
        </div>
        <div v-else>
          <div class="gen-pages">
            <div v-for="(pg, idx) in genPages" :key="idx" class="gen-page-card">
              <div class="gen-page-header">
                <div class="gen-page-num">{{ idx + 1 }}</div>
                <div class="gen-page-name">{{ pg.name }}</div>
                <button class="gen-page-remove" @click="removePage(idx)">×</button>
              </div>
              <div class="gen-divider"></div>
              <div class="gen-section-label">Formato</div>
              <div class="fmt-tabs">
                <button
                  v-for="fmt in ['story', 'folio']"
                  :key="fmt"
                  class="fmt-tab"
                  :class="{ active: pg.selectedFormat === fmt }"
                  :disabled="!getAvailableFormats(pg.config).includes(fmt)"
                  @click="pg.selectedFormat = fmt as any; pg.fondo_b64 = null"
                >{{ fmt === 'story' ? 'Story (1080×1920)' : 'A4 (2480×3508)' }}</button>
              </div>
              <!-- Fondo -->
              <template v-if="!getFmtConfig(pg.config, pg.selectedFormat).fondo_locked || !getFmtConfig(pg.config, pg.selectedFormat).fondo_b64">
                <div class="gen-section-label" style="margin-top:10px">Fondo</div>
                <input type="file" accept="image/*" @change="e => onFondoChange(e as InputEvent, idx)">
              </template>
              <!-- Campos variables -->
              <template v-if="getVarBlocks(pg.config, pg.selectedFormat).length">
                <div class="gen-section-label" style="margin-top:10px">Campos</div>
                <div v-for="b in getVarBlocks(pg.config, pg.selectedFormat)" :key="b.key || b.label" class="gen-field">
                  <label>{{ b.label }}</label>
                  <textarea v-if="b.multiline" :placeholder="(b.label ?? '') + '...'" v-model="pg.fieldValues[b.key ?? '']"></textarea>
                  <input v-else type="text" :placeholder="(b.label ?? '') + '...'" v-model="pg.fieldValues[b.key ?? '']">
                </div>
              </template>
            </div>
          </div>
          <div style="margin-top:14px">
            <button class="btn-dashed" @click="openPicker">+ Añadir otra plantilla</button>
          </div>
        </div>
      </div>

      <!-- STEP 2 -->
      <div v-show="genStep === 2" id="gen-step2">
        <button class="btn-back-step" @click="genStep = 1">← Volver a páginas</button>
        <div class="step2-summary">
          <div style="font-size:22px">✅</div>
          <div class="step2-summary-text">
            <strong>{{ genPages.length }} página{{ genPages.length !== 1 ? 's' : '' }} configurada{{ genPages.length !== 1 ? 's' : '' }}</strong>
            <span>Elige cómo distribuirlas</span>
          </div>
        </div>

        <!-- Descargar -->
        <div class="dist-section">
          <div class="dist-header" :class="{ open: openDist === 'download' }" @click="toggleDist('download')">
            <span class="dist-icon">⬇️</span><span class="dist-title">Descargar</span><span class="dist-chevron">›</span>
          </div>
          <div class="dist-body" :class="{ open: openDist === 'download' }">
            <p style="font-size:12px;color:var(--dim);margin-bottom:14px">Descarga como JPGs (ZIP) o PDF.</p>
            <div class="btn-row">
              <button class="btn ghost" :disabled="dlLoading" @click="exportPages('zip')">Exportar JPG (ZIP)</button>
              <button class="btn green" :disabled="dlLoading" @click="exportPages('pdf')">Exportar PDF</button>
            </div>
            <div class="form-status" :class="dlStatus.cls">{{ dlStatus.msg }}</div>
          </div>
        </div>

        <!-- Correo -->
        <div class="dist-section">
          <div class="dist-header" :class="{ open: openDist === 'email' }" @click="toggleDist('email')">
            <span class="dist-icon">✉️</span><span class="dist-title">Correo electrónico</span><span class="dist-chevron">›</span>
          </div>
          <div class="dist-body" :class="{ open: openDist === 'email' }">
            <div class="field"><label>Destinatario</label><input type="email" v-model="emailTo" placeholder="correo@destino.com"></div>
            <div class="field"><label>Asunto</label><input type="text" v-model="emailSubject" placeholder="Menú del día"></div>
            <div class="ptabs">
              <button class="ptab" :class="{ active: emailTab === 'now' }" @click="emailTab = 'now'">Enviar ahora</button>
              <button class="ptab" :class="{ active: emailTab === 'sched' }" @click="emailTab = 'sched'; loadScheduledEmails()">Programar</button>
            </div>
            <div v-show="emailTab === 'now'" class="ppanel">
              <div class="form-status" :class="emailStatusNow.cls">{{ emailStatusNow.msg }}</div>
              <button class="btn blue full" :disabled="emailSending" @click="sendEmailNow">ENVIAR AHORA</button>
            </div>
            <div v-show="emailTab === 'sched'" class="ppanel">
              <div class="field"><label>Fecha y hora</label><input type="datetime-local" v-model="emailSendAt"></div>
              <div class="form-status" :class="emailStatusSched.cls">{{ emailStatusSched.msg }}</div>
              <button class="btn blue full" :disabled="emailScheduling" @click="scheduleEmail">PROGRAMAR ENVÍO</button>
              <div v-if="scheduledEmails.length" class="sched-list" style="margin-top:8px">
                <div v-for="item in scheduledEmails" :key="item.id" class="sched-item">
                  <div class="sched-item-info"><strong>{{ item.email_to }}</strong><br>{{ formatDt(item.send_at) }}</div>
                  <button class="sched-cancel" @click="cancelEmail(item.id)">×</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Instagram -->
        <div class="dist-section">
          <div class="dist-header" :class="{ open: openDist === 'ig' }" @click="toggleDist('ig')">
            <span class="dist-icon">📸</span><span class="dist-title">Instagram Stories</span><span class="dist-chevron">›</span>
          </div>
          <div class="dist-body" :class="{ open: openDist === 'ig' }">
            <template v-if="!igStatus.connected">
              <p style="font-size:12px;color:var(--dim);margin-bottom:14px">Conecta tu cuenta desde Ajustes → Conexiones.</p>
            </template>
            <template v-else>
              <p style="font-size:12px;color:var(--dim);margin-bottom:12px">Cuenta: <strong style="color:var(--accent-dim)">@{{ igStatus.username }}</strong></p>
              <div class="ptabs">
                <button class="ptab" :class="{ active: igTab === 'now' }" @click="igTab = 'now'">Publicar ahora</button>
                <button class="ptab" :class="{ active: igTab === 'sched' }" @click="igTab = 'sched'; loadScheduledPosts()">Programar</button>
              </div>
              <div v-show="igTab === 'now'" class="ppanel">
                <div class="form-status" :class="igStatusNow.cls">{{ igStatusNow.msg }}</div>
                <button class="btn ig full" :disabled="igPublishing" @click="publishIGNow">PUBLICAR EN STORIES</button>
              </div>
              <div v-show="igTab === 'sched'" class="ppanel">
                <div class="field"><label>Fecha y hora</label><input type="datetime-local" v-model="igSchedAt"></div>
                <div class="form-status" :class="igStatusSched.cls">{{ igStatusSched.msg }}</div>
                <button class="btn ig full" :disabled="igScheduling" @click="scheduleIG">PROGRAMAR PUBLICACIÓN</button>
                <div v-if="scheduledPosts.length" class="sched-list" style="margin-top:8px">
                  <div v-for="item in scheduledPosts" :key="item.id" class="sched-item">
                    <div class="sched-item-info"><strong>{{ item.template_name || 'Story' }}</strong><br>{{ formatDt(item.scheduled_at) }}</div>
                    <button class="sched-cancel" @click="cancelPost(item.id)">×</button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Link público -->
        <div class="dist-section">
          <div class="dist-header" :class="{ open: openDist === 'link' }" @click="toggleDist('link')">
            <span class="dist-icon">🔗</span><span class="dist-title">Link público</span><span class="dist-chevron">›</span>
          </div>
          <div class="dist-body" :class="{ open: openDist === 'link' }">
            <template v-if="!userLinks.length">
              <p style="font-size:12px;color:var(--dim)">No tienes links públicos. Créalos en Ajustes →</p>
            </template>
            <template v-else>
              <p style="font-size:12px;color:var(--dim);margin-bottom:14px">Selecciona a qué link publicar. El contenido anterior se reemplaza.</p>
              <div v-for="link in userLinks" :key="link.id" class="link-dist-item">
                <div class="link-dist-info">
                  <div class="link-dist-name">{{ link.name }}</div>
                  <div class="link-dist-url">{{ origin }}/p/{{ link.slug }} · {{ link.last_published_at ? 'Act. ' + formatShortDate(link.last_published_at) : 'Sin publicar' }}</div>
                  <div class="form-status" :class="linkPubStatus[link.id]?.cls">{{ linkPubStatus[link.id]?.msg }}</div>
                </div>
                <button class="btn green sm" @click="publishToLink(link.id)">Publicar</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== PLANTILLAS ===== -->
    <div v-show="activeTab === 'plantillas'" style="padding:24px 24px 96px;max-width:960px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div class="page-title">Mis <span>Plantillas</span></div>
        <button class="btn green sm" @click="router.push('/editor')">+ Nueva</button>
      </div>
      <div class="grid">
        <div v-if="!templates.length" class="empty">
          <strong>Sin plantillas</strong>Crea tu primera con "+ Nueva"
        </div>
        <div v-for="tpl in templates" :key="tpl.id" class="tmpl-card">
          <div class="tmpl-card-top">
            <div class="tmpl-name">{{ tpl.name }}</div>
            <div class="menu-wrap">
              <button class="menu-btn" @click.stop="toggleDropdown(tpl.id)">···</button>
              <div class="dropdown" :class="{ open: openDropdown === tpl.id }">
                <button @click="router.push(`/editor/${tpl.id}`)">Editar</button>
                <button class="del" @click="deleteTemplate(tpl.id)">Eliminar</button>
              </div>
            </div>
          </div>
          <div class="tmpl-info">Actualizada {{ formatDate(tpl.updatedAt) }}</div>
          <button class="btn green sm full" style="margin-top:4px" @click="addPageFromTemplate(tpl.id)">+ Añadir a Generar</button>
        </div>
      </div>
    </div>

    <!-- FOOTER STEP 1 -->
    <div class="gen-footer1" v-show="activeTab === 'generar' && genStep === 1 && genPages.length">
      <span class="pages-count"><strong>{{ genPages.length }}</strong> páginas</span>
      <button class="btn green" @click="goToStep2">Continuar →</button>
    </div>

    <!-- FAB -->
    <button class="fab" @click="fabAction">+</button>

    <!-- SETTINGS OVERLAY -->
    <div class="settings-overlay" :class="{ open: settingsOpen }" @click="closeSettings"></div>
    <!-- SETTINGS PANEL -->
    <div class="settings-panel" :class="{ open: settingsOpen }">
      <div class="settings-header">
        <span class="settings-header-title">Ajustes</span>
        <button class="hdr-icon-btn" @click="closeSettings">✕</button>
      </div>
      <div class="settings-body">
        <div class="settings-section">
          <div class="settings-section-title">Cuenta</div>
          <div class="card">
            <div class="field"><label>Usuario</label><input type="text" :value="auth.username" readonly style="opacity:0.6;cursor:default"></div>
          </div>
          <div class="card">
            <div class="card-label">Cambiar contraseña</div>
            <div class="field"><label>Contraseña actual</label><input type="password" v-model="sPassCur" placeholder="••••••"></div>
            <div class="field"><label>Nueva contraseña</label><input type="password" v-model="sPassNew" placeholder="Mínimo 6 caracteres"></div>
            <div class="form-status" :class="sPassStatus.cls">{{ sPassStatus.msg }}</div>
            <button class="btn ghost full" style="margin-top:8px" @click="changePassword">Guardar contraseña</button>
          </div>
          <div class="card">
            <div class="card-label">Plan</div>
            <p style="font-size:13px;color:var(--dim)">Plan actual: <strong style="color:var(--text)">Básico</strong></p>
          </div>
          <button class="btn ghost full" style="margin-top:4px" @click="handleLogout">Cerrar sesión</button>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">Conexiones</div>
          <div class="card">
            <div class="card-label">Instagram</div>
            <template v-if="igStatus.connected">
              <p style="font-size:13px;margin-bottom:12px">Conectado como <strong style="color:var(--accent-dim)">@{{ igStatus.username }}</strong></p>
              <button class="btn ghost sm" @click="disconnectIG">Desconectar</button>
            </template>
            <template v-else>
              <p style="font-size:12px;color:var(--dim);margin-bottom:12px">Conecta tu cuenta para publicar Stories directamente.</p>
              <button class="btn ig sm" @click="connectIG">Conectar Instagram</button>
            </template>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">Links públicos</div>
          <p style="font-size:12px;color:var(--dim);margin-bottom:16px;line-height:1.7">Crea hasta 3 links permanentes. Puedes asignarle tu propio dominio con un registro CNAME.</p>
          <div v-for="link in userLinks" :key="link.id" class="link-settings-card">
            <div class="link-settings-row">
              <input class="link-settings-name" :value="link.name" @blur="renameLinkBlur($event, link)" @keydown.enter="($event.target as HTMLInputElement).blur()" spellcheck="false">
              <button class="icon-btn" @click="copyLink(link.slug)" title="Copiar">⎘</button>
              <button class="icon-btn del" @click="deleteLink(link.id)" title="Eliminar">✕</button>
            </div>
            <div class="link-settings-url">{{ origin }}/p/{{ link.slug }}{{ link.last_published_at ? ' · act. ' + formatShortDate(link.last_published_at) : ' · sin publicar' }}</div>
            <div style="margin-top:10px">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--accent-dim);margin-bottom:6px">Dominio personalizado</div>
              <div class="link-settings-domain">
                <input type="text" placeholder="menu.turestaurante.com" :value="link.custom_domain ?? ''" :id="`domain-input-${link.id}`">
                <button class="btn ghost sm" @click="saveDomain(link.id)">Guardar</button>
              </div>
              <div class="form-status" :id="`domain-status-${link.id}`"></div>
            </div>
          </div>
          <button class="btn-dashed" :disabled="userLinks.length >= 3" @click="createLink">
            {{ userLinks.length >= 3 ? 'Límite de 3 links alcanzado' : '+ Crear link público' }}
          </button>
        </div>
      </div>
    </div>

    <!-- PICKER OVERLAY -->
    <div class="picker-overlay" :class="{ open: pickerOpen }" @click="closePicker"></div>
    <!-- PICKER SHEET -->
    <div class="picker-sheet" :class="{ open: pickerOpen }">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <span class="sheet-title">Elegir plantilla</span>
        <button class="sheet-close" @click="closePicker">×</button>
      </div>
      <div class="sheet-list">
        <p v-if="!templates.length" style="text-align:center;color:var(--dim);padding:24px 0;font-size:14px">
          No tienes plantillas.<br>
          <router-link to="/editor" style="color:var(--accent-dim)">Crear una ahora</router-link>
        </p>
        <div v-for="tpl in templates" :key="tpl.id" class="picker-item" @click="addFromPicker(tpl.id)">
          <div>
            <div class="picker-item-name">{{ tpl.name }}</div>
            <div class="picker-item-date">Actualizada {{ formatDate(tpl.updatedAt) }}</div>
          </div>
          <button class="picker-item-add" @click.stop="addFromPicker(tpl.id)">+</button>
        </div>
      </div>
    </div>

    <!-- TOAST -->
    <transition name="toast-fade">
      <div v-if="toast.visible" class="toast" :style="{ borderColor: toast.ok ? 'var(--accent-dim)' : 'var(--error)', color: toast.ok ? 'var(--accent-dim)' : 'var(--error)' }">
        {{ toast.msg }}
      </div>
    </transition>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store.js'
import { templatesApi, distributeApi, exportApi, linksApi, instagramApi, authApi } from '@/api/index.js'
import type { TemplateListItem, TemplateConfig, LinkResponse, ScheduledEmailResponse, ScheduledIgResponse } from '@menu-bar/shared'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const origin = window.location.origin

// ===== TABS =====
const activeTab = ref<'generar' | 'plantillas'>('generar')
function switchTab(tab: 'generar' | 'plantillas') { activeTab.value = tab }

// ===== TEMPLATES =====
const templates = ref<TemplateListItem[]>([])
async function loadTemplates() {
  templates.value = await templatesApi.list().catch(() => [])
}
async function deleteTemplate(id: number) {
  if (!confirm('¿Eliminar esta plantilla?')) return
  await templatesApi.delete(id)
  templates.value = templates.value.filter(t => t.id !== id)
}

// ===== DROPDOWN =====
const openDropdown = ref<number | null>(null)
function toggleDropdown(id: number) {
  openDropdown.value = openDropdown.value === id ? null : id
}
function onAppClick() { openDropdown.value = null }

// ===== GENERAR STATE =====
interface GenPage {
  templateId: number
  name: string
  config: TemplateConfig & Record<string, any>
  selectedFormat: 'story' | 'folio'
  fondo_b64: string | null
  fieldValues: Record<string, string>
}

const genPages = ref<GenPage[]>([])
const genStep = ref(1)

function getFmtConfig(config: any, fmt: string): any {
  return config[fmt] ?? config
}

function getAvailableFormats(config: any): string[] {
  if (config.story || config.folio) {
    const out: string[] = []
    if (config.story?.blocks?.length) out.push('story')
    if (config.folio?.blocks?.length) out.push('folio')
    return out.length ? out : ['story']
  }
  return [config.formato ?? 'story']
}

function getVarBlocks(config: any, fmt: string) {
  const fmtConfig = getFmtConfig(config, fmt)
  return (fmtConfig.blocks ?? []).filter((b: any) => b.type === 'variable')
}

async function addPageFromTemplate(templateId: number) {
  const tpl = await templatesApi.get(templateId)
  const config = tpl.config as any
  const available = getAvailableFormats(config)
  genPages.value.push({
    templateId,
    config,
    name: tpl.name,
    selectedFormat: available[0] as 'story' | 'folio',
    fondo_b64: null,
    fieldValues: {},
  })
  switchTab('generar')
}

async function addFromPicker(templateId: number) {
  closePicker()
  await addPageFromTemplate(templateId)
}

function removePage(idx: number) {
  genPages.value.splice(idx, 1)
}

async function onFondoChange(e: InputEvent, idx: number) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const pg = genPages.value[idx]
  if (!pg) return
  pg.fondo_b64 = await fileToB64(file)
}

function buildRenderConfigs() {
  return genPages.value.map(pg => {
    const fmtConfig = getFmtConfig(pg.config, pg.selectedFormat)
    const fondo_b64 = pg.fondo_b64 || fmtConfig.fondo_b64
    const filledBlocks = (fmtConfig.blocks ?? []).map((b: any) => {
      let content: string | string[] = b.type === 'static'
        ? b.content ?? ''
        : (pg.fieldValues[b.key] ?? '')
      if (b.multiline && typeof content === 'string') {
        content = content.split('\n').filter((s: string) => s.trim())
      }
      return {
        type: b.type,
        x: b.x, y: b.y, w: b.w, align: b.align,
        content,
        font_family: b.font_family,
        font_size: b.font_size,
        text_color: b.text_color,
      }
    })
    return {
      fondo_b64,
      formato: pg.selectedFormat as 'story' | 'folio',
      letter_spacing: pg.config.letter_spacing,
      blocks: filledBlocks,
    } as any
  })
}

function goToStep2() {
  for (let i = 0; i < genPages.value.length; i++) {
    const pg = genPages.value[i]!
    const fmtConfig = getFmtConfig(pg.config, pg.selectedFormat)
    if (!pg.fondo_b64 && !fmtConfig.fondo_b64) {
      showToast(`Página ${i + 1} (${pg.name}): falta imagen de fondo`, false)
      return
    }
  }
  genStep.value = 2
}

// ===== DISTRIBUTION =====
const openDist = ref<string | null>(null)
function toggleDist(id: string) {
  openDist.value = openDist.value === id ? null : id
}

// Download
const dlLoading = ref(false)
const dlStatus = reactive({ msg: '', cls: '' })
async function exportPages(format: 'zip' | 'pdf') {
  dlLoading.value = true
  dlStatus.msg = 'Generando...'; dlStatus.cls = ''
  try {
    await exportApi.export({ pages: buildRenderConfigs(), format }, format === 'pdf' ? 'menu.pdf' : 'menus.zip')
    dlStatus.msg = `✓ ${format === 'pdf' ? 'PDF' : 'ZIP'} descargado`; dlStatus.cls = 'ok'
  } catch (err) {
    dlStatus.msg = '✗ ' + (err instanceof Error ? err.message : 'Error'); dlStatus.cls = 'err'
  } finally { dlLoading.value = false }
}

// Email
const emailTo = ref('')
const emailSubject = ref('')
const emailTab = ref<'now' | 'sched'>('now')
const emailSending = ref(false)
const emailScheduling = ref(false)
const emailStatusNow = reactive({ msg: '', cls: '' })
const emailStatusSched = reactive({ msg: '', cls: '' })
const emailSendAt = ref('')
const scheduledEmails = ref<ScheduledEmailResponse[]>([])

async function sendEmailNow() {
  if (!emailTo.value.trim()) { emailStatusNow.msg = '⚠ Escribe un destinatario'; emailStatusNow.cls = 'err'; return }
  emailSending.value = true; emailStatusNow.msg = 'Enviando...'; emailStatusNow.cls = ''
  try {
    await distributeApi.sendEmail({ pages: buildRenderConfigs(), email_to: emailTo.value, subject: emailSubject.value || 'Menú' })
    emailStatusNow.msg = '✓ Email enviado'; emailStatusNow.cls = 'ok'
  } catch (err) { emailStatusNow.msg = '✗ ' + (err instanceof Error ? err.message : 'Error'); emailStatusNow.cls = 'err' }
  finally { emailSending.value = false }
}

async function scheduleEmail() {
  if (!emailTo.value.trim()) { emailStatusSched.msg = '⚠ Escribe un destinatario'; emailStatusSched.cls = 'err'; return }
  if (!emailSendAt.value || new Date(emailSendAt.value) <= new Date()) { emailStatusSched.msg = '⚠ Fecha futura requerida'; emailStatusSched.cls = 'err'; return }
  emailScheduling.value = true; emailStatusSched.msg = 'Programando...'; emailStatusSched.cls = ''
  try {
    await distributeApi.scheduleEmail({ pages: buildRenderConfigs(), email_to: emailTo.value, subject: emailSubject.value || 'Menú', send_at: new Date(emailSendAt.value).toISOString() })
    emailStatusSched.msg = '✓ Programado'; emailStatusSched.cls = 'ok'
    emailSendAt.value = ''
    loadScheduledEmails()
  } catch (err) { emailStatusSched.msg = '✗ ' + (err instanceof Error ? err.message : 'Error'); emailStatusSched.cls = 'err' }
  finally { emailScheduling.value = false }
}

async function loadScheduledEmails() {
  scheduledEmails.value = await distributeApi.getScheduledEmails().catch(() => [])
}

async function cancelEmail(id: number) {
  await distributeApi.deleteScheduledEmail(id)
  loadScheduledEmails()
}

// Instagram
const igTab = ref<'now' | 'sched'>('now')
const igPublishing = ref(false)
const igScheduling = ref(false)
const igStatusNow = reactive({ msg: '', cls: '' })
const igStatusSched = reactive({ msg: '', cls: '' })
const igSchedAt = ref('')
const scheduledPosts = ref<ScheduledIgResponse[]>([])
const igStatus = reactive<{ connected: boolean; username?: string }>({ connected: false })

async function loadIgStatus() {
  try {
    const s = await instagramApi.status()
    igStatus.connected = s.connected
    igStatus.username = s.connected ? s.username : undefined
  } catch {}
}

async function publishIGNow() {
  igPublishing.value = true; igStatusNow.msg = 'Publicando...'; igStatusNow.cls = ''
  try {
    const data = await distributeApi.publishIg({ pages: buildRenderConfigs() })
    igStatusNow.msg = data.postUrl ? `✓ Publicado · Ver: ${data.postUrl}` : '✓ Publicado'; igStatusNow.cls = 'ok'
  } catch (err) { igStatusNow.msg = '✗ ' + (err instanceof Error ? err.message : 'Error'); igStatusNow.cls = 'err' }
  finally { igPublishing.value = false }
}

async function scheduleIG() {
  if (!igSchedAt.value || new Date(igSchedAt.value) <= new Date()) { igStatusSched.msg = '⚠ Fecha futura requerida'; igStatusSched.cls = 'err'; return }
  igScheduling.value = true; igStatusSched.msg = 'Programando...'; igStatusSched.cls = ''
  try {
    await distributeApi.scheduleIg({ pages: buildRenderConfigs(), scheduled_at: new Date(igSchedAt.value).toISOString() })
    igStatusSched.msg = '✓ Programado'; igStatusSched.cls = 'ok'
    igSchedAt.value = ''
    loadScheduledPosts()
  } catch (err) { igStatusSched.msg = '✗ ' + (err instanceof Error ? err.message : 'Error'); igStatusSched.cls = 'err' }
  finally { igScheduling.value = false }
}

async function loadScheduledPosts() {
  scheduledPosts.value = await distributeApi.getScheduledIg().catch(() => [])
}

async function cancelPost(id: number) {
  await distributeApi.deleteScheduledIg(id)
  loadScheduledPosts()
}

function connectIG() { window.location.href = '/api/instagram/connect' }
async function disconnectIG() {
  if (!confirm('¿Desconectar Instagram?')) return
  await instagramApi.disconnect()
  igStatus.connected = false; igStatus.username = undefined
}

// Link publish
const userLinks = ref<LinkResponse[]>([])
const linkPubStatus = ref<Record<number, { msg: string; cls: string }>>({})

async function publishToLink(linkId: number) {
  linkPubStatus.value[linkId] = { msg: 'Publicando...', cls: '' }
  try {
    const data = await linksApi.publish(linkId, buildRenderConfigs())
    linkPubStatus.value[linkId] = { msg: `✓ Publicado · ${data.url}`, cls: 'ok' }
    loadLinks()
  } catch (err) {
    linkPubStatus.value[linkId] = { msg: '✗ ' + (err instanceof Error ? err.message : 'Error'), cls: 'err' }
  }
}

// ===== SETTINGS =====
const settingsOpen = ref(false)
const sPassCur = ref('')
const sPassNew = ref('')
const sPassStatus = reactive({ msg: '', cls: '' })

function openSettings() { settingsOpen.value = true; document.body.style.overflow = 'hidden' }
function closeSettings() { settingsOpen.value = false; document.body.style.overflow = '' }

async function changePassword() {
  if (!sPassCur.value || !sPassNew.value) { sPassStatus.msg = '⚠ Rellena ambos campos'; sPassStatus.cls = 'err'; return }
  sPassStatus.msg = 'Guardando...'; sPassStatus.cls = ''
  try {
    await authApi.changePassword({ current: sPassCur.value, newPassword: sPassNew.value })
    sPassStatus.msg = '✓ Contraseña actualizada'; sPassStatus.cls = 'ok'
    sPassCur.value = ''; sPassNew.value = ''
  } catch (err) { sPassStatus.msg = '✗ ' + (err instanceof Error ? err.message : 'Error'); sPassStatus.cls = 'err' }
}

// ===== LINKS =====
async function loadLinks() {
  userLinks.value = await linksApi.list().catch(() => [])
}

async function createLink() {
  const name = prompt('Nombre del link (ej: Carta del día)')
  if (!name) return
  await linksApi.create({ name }).catch(e => { showToast('✗ ' + e.message, false); return null })
  await loadLinks()
  showToast('✓ Link creado', true)
}

async function deleteLink(id: number) {
  if (!confirm('¿Eliminar este link? Se borrará el contenido publicado.')) return
  await linksApi.delete(id)
  await loadLinks()
}

async function renameLinkBlur(e: Event, link: LinkResponse) {
  const newName = (e.target as HTMLInputElement).value.trim()
  if (newName && newName !== link.name) {
    await linksApi.update(link.id, { name: newName })
    link.name = newName
  }
}

async function saveDomain(linkId: number) {
  const input = document.getElementById(`domain-input-${linkId}`) as HTMLInputElement
  const statusEl = document.getElementById(`domain-status-${linkId}`)
  const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '')
  if (statusEl) { statusEl.textContent = 'Guardando...'; statusEl.className = 'form-status' }
  try {
    await linksApi.update(linkId, { custom_domain: domain || null })
    if (statusEl) { statusEl.textContent = domain ? `✓ Dominio: ${domain}` : '✓ Eliminado'; statusEl.className = 'form-status ok' }
  } catch (err) {
    if (statusEl) { statusEl.textContent = '✗ ' + (err instanceof Error ? err.message : 'Error'); statusEl.className = 'form-status err' }
  }
}

function copyLink(slug: string) {
  navigator.clipboard.writeText(`${origin}/p/${slug}`).then(() => showToast('✓ Link copiado', true))
}

// ===== PICKER =====
const pickerOpen = ref(false)
function openPicker() { pickerOpen.value = true; document.body.style.overflow = 'hidden' }
function closePicker() { pickerOpen.value = false; document.body.style.overflow = '' }

// ===== FAB =====
function fabAction() {
  if (activeTab.value === 'plantillas') router.push('/editor')
  else if (activeTab.value === 'generar' && genStep.value === 1) openPicker()
}

// ===== LOGOUT =====
async function handleLogout() {
  await authApi.logout().catch(() => null)
  auth.logout()
  router.push('/login')
}

// ===== TOAST =====
const toast = reactive({ visible: false, msg: '', ok: true })
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, ok: boolean) {
  toast.msg = msg; toast.ok = ok; toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, 4500)
}

// ===== UTILS =====
function fileToB64(file: File): Promise<string> {
  return new Promise(resolve => {
    const fr = new FileReader()
    fr.onload = e => resolve((e.target!.result as string).split(',')[1] ?? '')
    fr.readAsDataURL(file)
  })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
function formatDt(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ===== INIT =====
onMounted(async () => {
  await Promise.all([loadTemplates(), loadIgStatus(), loadLinks()])

  const q = route.query
  if (q['ig_connected']) {
    showToast(`✓ Instagram conectado: @${q['ig_username'] ?? ''}`, true)
    router.replace('/dashboard')
  }
  if (q['ig_error']) {
    showToast(`✗ Error IG: ${q['ig_error']}`, false)
    router.replace('/dashboard')
  }
})
</script>

<style scoped>
:root { --bg:#060d24; --s0:#0f1834; --s1:#151e3c; --s2:#1a2547; --accent:#9effc8; --accent-dim:#00ec9a; --text:#e8edf8; --dim:#6b7a99; --error:#d7383b; --r:6px; }

.app { font-family:'Inter',sans-serif; background:#060d24; color:#e8edf8; min-height:100vh; }

/* HEADER */
header { position:sticky; top:0; z-index:200; height:56px; padding:0 20px; background:#0f1834; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:10px; }
.logo { font-family:'Manrope',sans-serif; font-size:15px; font-weight:700; flex:1; }
.logo span { color:#9effc8; }
.hdr-icon-btn { width:36px; height:36px; border-radius:50%; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#6b7a99; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:17px; transition:all 0.15s; flex-shrink:0; }
.hdr-icon-btn:hover { background:#1a2547; color:#e8edf8; }

/* TAB BAR */
.tab-bar { display:flex; background:#0f1834; border-bottom:1px solid rgba(255,255,255,0.05); position:sticky; top:56px; z-index:100; }
.tab-btn { flex:1; padding:13px 0; background:none; border:none; cursor:pointer; font-size:13px; font-family:'Manrope',sans-serif; font-weight:600; color:#6b7a99; letter-spacing:0.06em; text-transform:uppercase; border-bottom:2px solid transparent; transition:all 0.15s; }
.tab-btn.active { color:#9effc8; border-bottom-color:#9effc8; }

/* CARDS & FIELDS */
.card { background:#0f1834; border-radius:10px; padding:20px; border:1px solid rgba(255,255,255,0.05); margin-bottom:12px; }
.card-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#00ec9a; margin-bottom:12px; }
.field { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
.field:last-child { margin-bottom:0; }
.field label { font-size:11px; color:#6b7a99; letter-spacing:0.04em; }
.field input, .field textarea, .field select { background:#151e3c; border:none; border-bottom:2px solid transparent; color:#e8edf8; padding:9px 10px; border-radius:6px 6px 0 0; font-size:13px; font-family:'Inter',sans-serif; outline:none; width:100%; transition:border-color 0.15s; }
.field input:focus, .field textarea:focus { border-bottom-color:#00ec9a; }
.form-status { font-size:12px; color:#6b7a99; min-height:16px; margin-top:4px; }
.form-status.ok { color:#00ec9a; }
.form-status.err { color:#d7383b; }

/* BUTTONS */
.btn { padding:10px 18px; border-radius:6px; border:none; cursor:pointer; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.05em; transition:opacity 0.15s, box-shadow 0.15s; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
.btn:disabled { opacity:0.4; cursor:not-allowed; }
.btn.green { background:linear-gradient(135deg,#00ec9a,#9effc8); color:#060d24; box-shadow:0 0 12px rgba(0,236,154,0.15); }
.btn.green:hover:not(:disabled) { opacity:0.9; }
.btn.ghost { background:#1a2547; color:#e8edf8; border:1px solid rgba(255,255,255,0.08); }
.btn.ghost:hover:not(:disabled) { background:#151e3c; }
.btn.blue { background:linear-gradient(135deg,#3b6fd4,#5b8ff9); color:#fff; }
.btn.blue:hover:not(:disabled) { opacity:0.85; }
.btn.ig { background:linear-gradient(135deg,#833ab4,#e1306c,#fd1d1d); color:#fff; }
.btn.ig:hover:not(:disabled) { opacity:0.85; }
.btn.full { width:100%; justify-content:center; }
.btn.sm { padding:7px 12px; font-size:12px; }
.btn-row { display:flex; gap:8px; flex-wrap:wrap; }
.btn-dashed { display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; border-radius:10px; border:1.5px dashed rgba(158,255,200,0.2); background:transparent; color:#6b7a99; cursor:pointer; font-size:13px; font-family:'Manrope',sans-serif; font-weight:600; transition:all 0.15s; width:100%; }
.btn-dashed:hover:not(:disabled) { border-color:rgba(158,255,200,0.5); color:#9effc8; background:rgba(158,255,200,0.04); }
.btn-dashed:disabled { opacity:0.3; cursor:not-allowed; }

/* PTABS */
.ptabs { display:flex; gap:6px; margin-bottom:14px; }
.ptab { flex:1; padding:8px 6px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:transparent; color:#6b7a99; cursor:pointer; font-size:12px; font-family:'Manrope',sans-serif; font-weight:600; transition:all 0.15s; }
.ptab.active { background:linear-gradient(135deg,#00ec9a,#9effc8); color:#060d24; border-color:transparent; }
.ppanel { display:flex; flex-direction:column; gap:10px; }

/* SCHED LIST */
.sched-list { display:flex; flex-direction:column; gap:6px; }
.sched-item { display:flex; align-items:center; justify-content:space-between; background:#1a2547; border-radius:6px; padding:8px 10px; font-size:12px; gap:8px; }
.sched-item-info { flex:1; color:#6b7a99; line-height:1.5; }
.sched-item-info strong { color:#e8edf8; }
.sched-cancel { background:none; border:none; color:#d7383b; cursor:pointer; font-size:18px; line-height:1; padding:0 4px; }
.icon-btn { width:32px; height:32px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#6b7a99; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all 0.1s; }
.icon-btn:hover { background:#1a2547; color:#e8edf8; }
.icon-btn.del:hover { background:rgba(215,56,59,0.15); color:#d7383b; }

/* PLANTILLAS TAB */
.page-title { font-family:'Manrope',sans-serif; font-size:22px; font-weight:700; }
.page-title span { color:#9effc8; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
.tmpl-card { background:#0f1834; border-radius:10px; padding:20px; border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:12px; transition:border-color 0.15s; }
.tmpl-card:hover { border-color:rgba(158,255,200,0.12); }
.tmpl-card-top { display:flex; align-items:flex-start; gap:8px; }
.tmpl-name { font-family:'Manrope',sans-serif; font-size:15px; font-weight:600; flex:1; }
.tmpl-info { font-size:12px; color:#6b7a99; }
.menu-wrap { position:relative; flex-shrink:0; }
.menu-btn { width:28px; height:28px; border-radius:6px; border:none; background:transparent; color:#6b7a99; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; transition:background 0.1s; }
.menu-btn:hover { background:#1a2547; color:#e8edf8; }
.dropdown { display:none; position:absolute; right:0; top:32px; z-index:50; background:#151e3c; border-radius:6px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 8px 24px rgba(0,0,0,0.4); min-width:140px; overflow:hidden; }
.dropdown.open { display:block; }
.dropdown button { width:100%; padding:10px 14px; background:transparent; border:none; color:#e8edf8; text-align:left; cursor:pointer; font-size:13px; font-family:'Inter',sans-serif; transition:background 0.1s; display:block; }
.dropdown button:hover { background:#1a2547; }
.dropdown button.del { color:#d7383b; }
.empty { grid-column:1/-1; text-align:center; padding:64px 0; color:#6b7a99; font-size:14px; line-height:2; }
.empty strong { display:block; font-family:'Manrope',sans-serif; font-size:18px; color:#e8edf8; margin-bottom:8px; }

/* FAB */
.fab { position:fixed; bottom:24px; right:20px; z-index:99; width:52px; height:52px; border-radius:50%; border:none; cursor:pointer; background:linear-gradient(135deg,#00ec9a,#9effc8); color:#060d24; font-size:26px; line-height:1; box-shadow:0 4px 20px rgba(0,236,154,0.35); display:none; align-items:center; justify-content:center; transition:transform 0.15s; }
.fab:hover { transform:scale(1.06); }

/* STEP BAR */
.step-bar { display:flex; align-items:center; padding:14px 24px; border-bottom:1px solid rgba(255,255,255,0.05); background:#060d24; }
.step-item { display:flex; align-items:center; gap:8px; }
.step-num { width:24px; height:24px; border-radius:50%; background:#1a2547; color:#6b7a99; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s; }
.step-item.active .step-num { background:#9effc8; color:#060d24; }
.step-label { font-size:13px; font-family:'Manrope',sans-serif; font-weight:600; color:#6b7a99; transition:color 0.2s; }
.step-item.active .step-label { color:#e8edf8; }
.step-sep { flex:1; height:1px; background:rgba(255,255,255,0.08); margin:0 14px; }

/* STEP 1 */
#gen-step1 { padding:20px 24px 0; max-width:720px; margin:0 auto; }
.gen-empty { text-align:center; padding:80px 0; color:#6b7a99; }
.gen-empty strong { display:block; font-family:'Manrope',sans-serif; font-size:18px; color:#e8edf8; margin-bottom:10px; }
.gen-empty p { font-size:14px; line-height:1.7; margin-bottom:24px; }
.gen-pages { display:flex; flex-direction:column; gap:14px; }
.gen-page-card { background:#0f1834; border-radius:12px; padding:20px; border:1px solid rgba(255,255,255,0.06); }
.gen-page-header { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.gen-page-num { width:26px; height:26px; border-radius:50%; background:#9effc8; color:#060d24; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.gen-page-name { font-family:'Manrope',sans-serif; font-size:15px; font-weight:600; flex:1; }
.gen-page-remove { width:30px; height:30px; border-radius:50%; border:none; cursor:pointer; background:transparent; color:#6b7a99; font-size:18px; display:flex; align-items:center; justify-content:center; transition:all 0.1s; flex-shrink:0; }
.gen-page-remove:hover { background:rgba(215,56,59,0.15); color:#d7383b; }
.gen-divider { height:1px; background:rgba(255,255,255,0.05); margin-bottom:14px; }
.gen-section-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#00ec9a; margin-bottom:10px; }
.fmt-tabs { display:flex; gap:6px; margin-bottom:14px; }
.fmt-tab { flex:1; padding:8px 6px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:transparent; color:#6b7a99; cursor:pointer; font-size:11px; font-family:'Manrope',sans-serif; font-weight:600; transition:all 0.15s; }
.fmt-tab.active { background:linear-gradient(135deg,#00ec9a,#9effc8); color:#060d24; border-color:transparent; }
.fmt-tab:disabled { opacity:0.3; cursor:not-allowed; }
.gen-field { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
.gen-field label { font-size:11px; color:#6b7a99; }
.gen-field input, .gen-field textarea { background:#151e3c; border:none; border-bottom:2px solid transparent; color:#e8edf8; padding:8px 10px; border-radius:6px 6px 0 0; font-size:13px; font-family:'Inter',sans-serif; outline:none; width:100%; transition:border-color 0.15s; }
.gen-field input:focus, .gen-field textarea:focus { border-bottom-color:#00ec9a; }
.gen-field textarea { min-height:72px; resize:vertical; }
input[type="file"] { font-size:12px; color:#6b7a99; background:#151e3c; border:1.5px dashed rgba(158,255,200,0.2); padding:8px 10px; border-radius:6px; width:100%; cursor:pointer; font-family:'Inter',sans-serif; }

/* FOOTER STEP 1 */
.gen-footer1 { position:fixed; bottom:0; left:0; right:0; z-index:150; background:#0f1834; border-top:1px solid rgba(255,255,255,0.07); padding:14px 20px; display:flex; gap:12px; align-items:center; box-shadow:0 -4px 24px rgba(0,0,0,0.4); }
.pages-count { font-size:12px; color:#6b7a99; flex:1; font-family:'Manrope',sans-serif; }
.pages-count strong { color:#e8edf8; }

/* STEP 2 */
#gen-step2 { padding:20px 24px 120px; max-width:720px; margin:0 auto; }
.step2-summary { background:#0f1834; border-radius:10px; padding:14px 18px; margin-bottom:20px; border:1px solid rgba(158,255,200,0.1); display:flex; align-items:center; gap:12px; }
.step2-summary-text strong { font-family:'Manrope',sans-serif; font-size:14px; display:block; }
.step2-summary-text span { font-size:12px; color:#6b7a99; }
.btn-back-step { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#6b7a99; cursor:pointer; background:none; border:none; font-family:'Inter',sans-serif; padding:0; margin-bottom:18px; transition:color 0.15s; }
.btn-back-step:hover { color:#e8edf8; }

/* DIST ACCORDION */
.dist-section { margin-bottom:10px; }
.dist-header { display:flex; align-items:center; gap:12px; padding:14px 18px; background:#0f1834; border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.05); transition:border-color 0.15s; user-select:none; }
.dist-header:hover { border-color:rgba(255,255,255,0.1); }
.dist-header.open { border-radius:10px 10px 0 0; border-bottom-color:transparent; }
.dist-icon { font-size:18px; width:26px; text-align:center; flex-shrink:0; }
.dist-title { font-family:'Manrope',sans-serif; font-size:14px; font-weight:600; flex:1; }
.dist-chevron { color:#6b7a99; font-size:14px; transition:transform 0.2s; }
.dist-header.open .dist-chevron { transform:rotate(90deg); }
.dist-body { display:none; background:#151e3c; border:1px solid rgba(255,255,255,0.05); border-top:none; border-radius:0 0 10px 10px; padding:18px; }
.dist-body.open { display:block; }
.link-dist-item { background:#1a2547; border-radius:6px; padding:12px 14px; display:flex; align-items:center; gap:12px; margin-bottom:8px; }
.link-dist-info { flex:1; min-width:0; }
.link-dist-name { font-family:'Manrope',sans-serif; font-size:13px; font-weight:600; }
.link-dist-url { font-size:11px; color:#6b7a99; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }

/* SETTINGS PANEL */
.settings-overlay { display:none; position:fixed; inset:0; z-index:400; background:rgba(0,0,0,0.5); backdrop-filter:blur(3px); }
.settings-overlay.open { display:block; }
.settings-panel { position:fixed; top:0; right:0; bottom:0; z-index:401; width:min(420px, 100vw); background:#060d24; border-left:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; transform:translateX(100%); transition:transform 0.28s cubic-bezier(.4,0,.2,1); overflow:hidden; }
.settings-panel.open { transform:translateX(0); }
.settings-header { height:56px; padding:0 20px; background:#0f1834; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:12px; flex-shrink:0; }
.settings-header-title { font-family:'Manrope',sans-serif; font-size:15px; font-weight:700; flex:1; }
.settings-body { flex:1; overflow-y:auto; padding:24px 20px 40px; }
.settings-section { margin-bottom:32px; }
.settings-section-title { font-family:'Manrope',sans-serif; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#6b7a99; margin-bottom:14px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); }
.link-settings-card { background:#151e3c; border-radius:10px; padding:16px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px; }
.link-settings-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.link-settings-name { font-family:'Manrope',sans-serif; font-size:14px; font-weight:600; flex:1; cursor:text; border:none; background:none; color:#e8edf8; outline:none; padding:0; }
.link-settings-name:focus { outline:1px solid #00ec9a; border-radius:3px; padding:2px 4px; }
.link-settings-url { font-size:11px; color:#6b7a99; margin-bottom:10px; word-break:break-all; }
.link-settings-domain { display:flex; gap:8px; align-items:center; }
.link-settings-domain input { flex:1; background:#1a2547; border:none; border-bottom:2px solid transparent; color:#e8edf8; padding:7px 9px; border-radius:6px 6px 0 0; font-size:12px; font-family:'Inter',sans-serif; outline:none; transition:border-color 0.15s; min-width:0; }
.link-settings-domain input:focus { border-bottom-color:#00ec9a; }

/* PICKER SHEET */
.picker-overlay { display:none; position:fixed; inset:0; z-index:300; background:rgba(0,0,0,0.6); backdrop-filter:blur(2px); }
.picker-overlay.open { display:block; }
.picker-sheet { position:fixed; bottom:0; left:0; right:0; z-index:301; background:#0f1834; border-radius:18px 18px 0 0; transform:translateY(100%); transition:transform 0.28s cubic-bezier(.4,0,.2,1); max-height:75vh; display:flex; flex-direction:column; }
.picker-sheet.open { transform:translateY(0); }
.sheet-handle { width:36px; height:4px; border-radius:2px; background:rgba(255,255,255,0.15); margin:12px auto 0; }
.sheet-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px 12px; border-bottom:1px solid rgba(255,255,255,0.06); }
.sheet-title { font-family:'Manrope',sans-serif; font-size:15px; font-weight:700; }
.sheet-close { width:30px; height:30px; border-radius:50%; border:none; cursor:pointer; background:#1a2547; color:#6b7a99; font-size:16px; display:flex; align-items:center; justify-content:center; }
.sheet-close:hover { color:#e8edf8; }
.sheet-list { overflow-y:auto; padding:12px 16px 24px; display:flex; flex-direction:column; gap:8px; }
.picker-item { padding:14px 16px; border-radius:10px; background:#151e3c; border:1px solid rgba(255,255,255,0.04); transition:all 0.15s; display:flex; align-items:center; justify-content:space-between; cursor:pointer; }
.picker-item:hover { border-color:rgba(158,255,200,0.2); background:#1a2547; }
.picker-item-name { font-family:'Manrope',sans-serif; font-size:14px; font-weight:600; }
.picker-item-date { font-size:11px; color:#6b7a99; margin-top:3px; }
.picker-item-add { width:32px; height:32px; border-radius:50%; background:rgba(158,255,200,0.1); color:#9effc8; border:none; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

/* TOAST */
.toast { position:fixed; top:70px; right:20px; z-index:999; background:#151e3c; border:1px solid; padding:10px 16px; border-radius:8px; font-size:13px; font-family:'Manrope',sans-serif; box-shadow:0 4px 16px rgba(0,0,0,0.4); max-width:280px; word-break:break-word; }
.toast-fade-enter-active, .toast-fade-leave-active { transition:opacity 0.3s, transform 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity:0; transform:translateY(-8px); }

/* MOBILE */
@media (max-width: 640px) {
  header { padding:0 14px; }
  #gen-step1 { padding:16px 14px 0; }
  #gen-step2 { padding:16px 14px 120px; }
  .gen-page-card { padding:16px; }
  .btn-row { flex-direction:column; }
  .btn.full { width:100%; }
  .step-bar { padding:12px 16px; }
  .fab { display:flex; }
  div[v-show*="plantillas"] { padding:20px 14px 88px; }
  .page-title { font-size:20px; margin-bottom:18px; }
  .grid { grid-template-columns:1fr; gap:12px; }
}
</style>
