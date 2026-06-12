// Editor en vivo de la apariencia. Carga el sitio real en un iframe y, mientras
// se editan colores / fuentes / textos / imágenes / mensaje de WhatsApp en el
// panel, se aplican al instante sobre esa vista (vía postMessage al
// editor-bridge del sitio). Tocar un texto en el sitio enfoca su campo acá.
// Reemplaza al viejo panel de Apariencia (reutiliza su lógica).
import { bootstrapDashPage } from '../../shared/dashboard-shell.js'
import { actualizarNegocio } from '../../services/negocios.service.js'
import { subirImagenBranding } from '../../services/storage.service.js'
import { PRESETS, COLOR_VARS, COLOR_LABELS, FONTS, FONT_ACENTO, TEXT_GROUPS, IMAGE_FIELDS, DEFAULT_WA_TEMPLATE, WA_TOKENS, findById, findPreset } from '../../theme-config.js'

const imagenesState = {}
const COLOR_ORDER = ['primary', 'accent', 'secondary', 'bg', 'text', 'desc', 'border']
const DEFAULT_COLORES = findPreset('kraft').colores
const DEFAULT_FUENTES = { titulos: 'fraunces', texto: 'system', acento: 'caveat' }

// key -> { label, placeholder, textarea, grupo } para el editor de "selección".
const FIELD_BY_KEY = {}
TEXT_GROUPS.forEach(g => g.campos.forEach(c => { FIELD_BY_KEY[c.key] = { ...c, grupo: g.titulo } }))

const frame = document.getElementById('editor-frame')
let frameReady = false
let selectedKey = null
let savedTema = {}

function postToFrame(msg) {
    if (frame && frame.contentWindow) {
        try { frame.contentWindow.postMessage(msg, window.location.origin) } catch (e) { /* noop */ }
    }
}

const feedback = document.getElementById('editor-feedback')
function showFeedback(msg, ok) {
    feedback.hidden = false
    feedback.textContent = msg
    feedback.className = 'dash-feedback ' + (ok ? 'ok' : 'error')
    if (ok) setTimeout(() => { feedback.hidden = true }, 4000)
}

// ---- Construcción del panel (adaptado del viejo Apariencia) ----
function buildPresets() {
    const cont = document.getElementById('ap-presets')
    cont.innerHTML = PRESETS.map(p => {
        const dots = ['primary', 'accent', 'secondary', 'bg'].map(k => `<span style="background:${p.colores[k]}"></span>`).join('')
        return `<button type="button" class="ap-preset" data-preset="${p.id}"><span class="ap-preset-dots">${dots}</span><span class="ap-preset-name">${p.nombre}</span></button>`
    }).join('')
    cont.querySelectorAll('.ap-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = findPreset(btn.dataset.preset)
            if (!preset) return
            setColores(preset.colores)
            markActivePreset(preset.id)
            applyToIframe()
        })
    })
}

function buildColorPickers() {
    const cont = document.getElementById('ap-colores')
    cont.innerHTML = COLOR_ORDER.map(key => `
        <div class="ap-color-row" data-key="${key}">
            <label for="ap-c-${key}">${COLOR_LABELS[key] || key}</label>
            <input type="color" id="ap-c-${key}" data-color="${key}">
            <input type="text" data-hex="${key}" maxlength="7" spellcheck="false">
        </div>`).join('')
    cont.querySelectorAll('input[type=color]').forEach(inp => {
        inp.addEventListener('input', () => {
            cont.querySelector(`input[data-hex="${inp.dataset.color}"]`).value = inp.value
            markActivePreset(null)
            applyToIframe()
        })
    })
    cont.querySelectorAll('input[data-hex]').forEach(inp => {
        inp.addEventListener('input', () => {
            let v = inp.value.trim()
            if (v && !v.startsWith('#')) v = '#' + v
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                cont.querySelector(`input[data-color="${inp.dataset.hex}"]`).value = v
                markActivePreset(null)
                applyToIframe()
            }
        })
    })
}

function buildFontSelects() {
    const fill = (id, list) => {
        const sel = document.getElementById(id)
        sel.innerHTML = list.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('')
        sel.addEventListener('change', applyToIframe)
    }
    fill('ap-font-titulos', FONTS)
    fill('ap-font-texto', FONTS)
    fill('ap-font-acento', FONT_ACENTO)
}

function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildTextos() {
    const cont = document.getElementById('ap-textos')
    cont.innerHTML = TEXT_GROUPS.map(g => {
        const campos = g.campos.map(c => {
            const ph = escAttr(c.placeholder || '')
            const control = c.textarea
                ? `<textarea id="ap-t-${c.key}" data-text="${c.key}" rows="2" placeholder="${ph}"></textarea>`
                : `<input type="text" id="ap-t-${c.key}" data-text="${c.key}" placeholder="${ph}">`
            return `<div class="dash-form-row"><label for="ap-t-${c.key}">${escAttr(c.label)}</label>${control}</div>`
        }).join('')
        return `<div class="ap-text-group">${escAttr(g.titulo)}</div>${campos}`
    }).join('')

    cont.querySelectorAll('[data-text]').forEach(el => {
        el.addEventListener('input', () => {
            if (el.dataset.text === selectedKey) {
                const sel = document.getElementById('ap-sel-input')
                if (sel && sel.value !== el.value) sel.value = el.value
            }
            applyToIframe()
        })
        el.addEventListener('focus', () => selectKey(el.dataset.text, { fromPanel: true }))
    })
}

function buildImagenes(negocioId) {
    const cont = document.getElementById('ap-imagenes')
    cont.innerHTML = IMAGE_FIELDS.map(f => `
        <div class="ap-img-field" data-key="${f.key}">
            <h4>${f.label}</h4>
            <p class="ap-img-hint">${f.hint}</p>
            <img class="ap-img-thumb" data-thumb="${f.key}" src="${imagenesState[f.key] || f.def}" alt="">
            <div class="ap-img-actions">
                <input type="file" accept="image/*" data-file="${f.key}">
                <button type="button" class="ap-img-remove" data-remove="${f.key}" ${imagenesState[f.key] ? '' : 'hidden'}>Quitar</button>
            </div>
            <p class="ap-img-status" data-status="${f.key}"></p>
        </div>`).join('')

    IMAGE_FIELDS.forEach(cfg => {
        const fileInp = cont.querySelector(`input[data-file="${cfg.key}"]`)
        const thumb = cont.querySelector(`img[data-thumb="${cfg.key}"]`)
        const status = cont.querySelector(`p[data-status="${cfg.key}"]`)
        const removeBtn = cont.querySelector(`button[data-remove="${cfg.key}"]`)
        const setStatus = (msg, cls) => { status.textContent = msg; status.className = 'ap-img-status' + (cls ? ' ' + cls : '') }

        fileInp.addEventListener('change', async () => {
            const file = fileInp.files && fileInp.files[0]
            if (!file) return
            setStatus('Procesando…')
            try {
                const blob = await fileToBlob(file, cfg)
                setStatus('Subiendo…')
                const ext = cfg.format === 'png' ? 'png' : 'jpg'
                const publicUrl = await subirImagenBranding(negocioId, cfg.key, blob, ext)
                if (!publicUrl) { setStatus('Error al subir. Reintentá.', 'err'); return }
                imagenesState[cfg.key] = publicUrl
                thumb.src = publicUrl
                removeBtn.hidden = false
                setStatus('✓ Lista — acordate de Guardar', 'ok')
                applyToIframe()
            } catch (e) {
                console.error('[editor] imagen:', e)
                setStatus('No se pudo procesar la imagen.', 'err')
            }
        })

        removeBtn.addEventListener('click', () => {
            delete imagenesState[cfg.key]
            thumb.src = cfg.def
            fileInp.value = ''
            removeBtn.hidden = true
            setStatus('Volverá a la imagen por defecto al guardar.')
            applyToIframe()
        })
    })
}

// Reescala la imagen en un canvas y devuelve un Blob liviano.
function fileToBlob(file, cfg) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            let w = img.naturalWidth, h = img.naturalHeight
            const scale = Math.min(1, cfg.maxW / w, cfg.maxH / h)
            w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale))
            const canvas = document.createElement('canvas')
            canvas.width = w; canvas.height = h
            const ctx = canvas.getContext('2d')
            if (cfg.format === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h) }
            ctx.drawImage(img, 0, 0, w, h)
            const mime = cfg.format === 'png' ? 'image/png' : 'image/jpeg'
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob null')), mime, cfg.format === 'jpeg' ? 0.82 : undefined)
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo leer la imagen')) }
        img.src = url
    })
}

function buildWaSection() {
    const tokensCont = document.getElementById('ap-wa-tokens')
    const textarea = document.getElementById('ap-wa-template')
    if (!tokensCont || !textarea) return
    tokensCont.innerHTML = WA_TOKENS.map(t => `<button type="button" class="ap-wa-token" data-token="${t.token}" title="${t.desc}">${t.token}</button>`).join('')
    tokensCont.querySelectorAll('.ap-wa-token').forEach(btn => {
        btn.addEventListener('click', () => {
            const tk = btn.dataset.token
            const start = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length
            const end = textarea.selectionEnd != null ? textarea.selectionEnd : textarea.value.length
            textarea.value = textarea.value.slice(0, start) + tk + textarea.value.slice(end)
            const pos = start + tk.length
            textarea.focus(); textarea.setSelectionRange(pos, pos)
        })
    })
    document.getElementById('ap-wa-load-default').addEventListener('click', () => {
        textarea.value = DEFAULT_WA_TEMPLATE; textarea.focus()
    })
}

// ---- Estado <-> panel ----
function setColores(colores) {
    COLOR_ORDER.forEach(key => {
        const val = (colores && colores[key]) || DEFAULT_COLORES[key]
        const c = document.getElementById('ap-c-' + key)
        const h = document.querySelector(`input[data-hex="${key}"]`)
        if (c) c.value = val
        if (h) h.value = val
    })
}
function setFuentes(fuentes) {
    const f = fuentes || {}
    document.getElementById('ap-font-titulos').value = findById(FONTS, f.titulos) ? f.titulos : DEFAULT_FUENTES.titulos
    document.getElementById('ap-font-texto').value = findById(FONTS, f.texto) ? f.texto : DEFAULT_FUENTES.texto
    document.getElementById('ap-font-acento').value = findById(FONT_ACENTO, f.acento) ? f.acento : DEFAULT_FUENTES.acento
}
function setTextos(textos) {
    const t = textos || {}
    TEXT_GROUPS.forEach(g => g.campos.forEach(c => {
        const el = document.getElementById('ap-t-' + c.key)
        if (el) el.value = t[c.key] || ''
    }))
}
function readColores() {
    const out = {}
    COLOR_ORDER.forEach(key => { out[key] = document.getElementById('ap-c-' + key).value })
    return out
}
function readFuentes() {
    return {
        titulos: document.getElementById('ap-font-titulos').value,
        texto: document.getElementById('ap-font-texto').value,
        acento: document.getElementById('ap-font-acento').value
    }
}
function readTextos() {
    const out = {}
    TEXT_GROUPS.forEach(g => g.campos.forEach(c => {
        const el = document.getElementById('ap-t-' + c.key)
        const val = el ? el.value.trim() : ''
        if (val) out[c.key] = val
    }))
    return out
}
function markActivePreset(id) {
    document.querySelectorAll('.ap-preset').forEach(b => b.classList.toggle('active', !!id && b.dataset.preset === id))
}

// ---- Vista en vivo (iframe) ----
function temaPreview() {
    // Mandamos sólo los textos que el usuario realmente cargó (igual que al
    // guardar): los no tocados conservan su HTML original en el iframe (ej. las
    // negritas de "Nosotros"), así la vista coincide con el sitio real.
    return {
        colores: readColores(),
        fuentes: readFuentes(),
        textos: readTextos(),
        imagenes: { ...imagenesState }
    }
}
function applyToIframe() {
    if (!frameReady) return
    postToFrame({ type: 'editor:apply', tema: temaPreview() })
}

// ---- Selección (click en el sitio o foco en el panel) ----
const panel = document.getElementById('editor-panel')
const selCard = document.getElementById('ap-card-seleccion')
const selInput = document.getElementById('ap-sel-input')
const selTitle = document.getElementById('ap-sel-title')
const selHint = document.getElementById('ap-sel-hint')

function isMobile() { return window.matchMedia('(max-width: 920px)').matches }

function selectKey(key, opts = {}) {
    const field = FIELD_BY_KEY[key]
    if (!field) return
    selectedKey = key
    const target = document.getElementById('ap-t-' + key)
    selTitle.textContent = field.label
    selHint.textContent = 'Sección: ' + field.grupo
    selInput.value = target ? target.value : ''
    selInput.placeholder = field.placeholder || 'Escribí el texto…'
    selInput.rows = field.textarea ? 4 : 2
    selCard.hidden = false

    if (!opts.fromPanel) {
        // Vino de un click en el sitio: abrir panel (mobile) y enfocar.
        if (isMobile()) panel.classList.add('open')
        selCard.scrollIntoView({ block: 'nearest' })
        selInput.focus()
        postToFrame({ type: 'editor:highlight', key })
    }
}

selInput.addEventListener('input', () => {
    if (!selectedKey) return
    const target = document.getElementById('ap-t-' + selectedKey)
    if (target) target.value = selInput.value
    applyToIframe()
})

// ---- Mensajes del iframe ----
window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin || !e.data || typeof e.data !== 'object') return
    const m = e.data
    if (m.type === 'editor:ready') {
        frameReady = true
        applyToIframe()
    } else if (m.type === 'editor:select' && m.key) {
        if (m.kind === 'image') selectImage(m.key)
        else selectKey(m.key, { fromPanel: false })
    }
})

// Tocar una foto en el sitio: lleva al campo de esa imagen en el panel.
function selectImage(key) {
    const field = document.querySelector(`.ap-img-field[data-key="${key}"]`)
    if (!field) return
    selCard.hidden = true
    selectedKey = null
    if (isMobile()) panel.classList.add('open')
    document.querySelectorAll('.ap-img-field.sel').forEach(f => f.classList.remove('sel'))
    field.classList.add('sel')
    field.scrollIntoView({ block: 'center' })
    postToFrame({ type: 'editor:highlight', key })
}

// ---- Toolbar: dispositivo, panel mobile, guardar, descartar ----
function setupToolbar(negocio) {
    const wrap = document.querySelector('.editor-frame-wrap')
    document.querySelectorAll('.editor-device-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.editor-device-btn').forEach(b => b.classList.toggle('active', b === btn))
            wrap.dataset.device = btn.dataset.device
        })
    })

    document.getElementById('editor-panel-handle').addEventListener('click', () => {
        panel.classList.toggle('open')
    })

    document.getElementById('editor-discard').addEventListener('click', () => {
        if (!confirm('¿Descartar los cambios sin guardar y volver a la última versión guardada?')) return
        aplicarTemaAlPanel(savedTema)
        selCard.hidden = true
        selectedKey = null
        // Recargar el iframe = reset limpio de la vista a lo último guardado.
        frameReady = false
        try { frame.contentWindow.location.reload() } catch (e) { applyToIframe() }
        showFeedback('Cambios descartados.', true)
    })

    document.getElementById('editor-save').addEventListener('click', async () => {
        const btn = document.getElementById('editor-save')
        btn.disabled = true; btn.textContent = 'Guardando…'
        const activePreset = document.querySelector('.ap-preset.active')
        const waRaw = (document.getElementById('ap-wa-template').value || '').trim()
        const waVal = (waRaw === DEFAULT_WA_TEMPLATE.trim()) ? '' : waRaw
        const nuevoTema = {
            ...savedTema,
            preset: activePreset ? activePreset.dataset.preset : 'custom',
            colores: readColores(),
            fuentes: readFuentes(),
            textos: readTextos(),
            imagenes: { ...imagenesState },
            mensaje_wa: waVal
        }
        const actualizado = await actualizarNegocio(negocio.id, { tema: nuevoTema })
        btn.disabled = false; btn.textContent = 'Guardar'
        if (!actualizado) { showFeedback('Error al guardar. Reintentá.', false); return }
        savedTema = actualizado.tema || nuevoTema
        negocio.tema = savedTema
        showFeedback('✓ Guardado y publicado.', true)
    })
}

function aplicarTemaAlPanel(tema) {
    const t = (tema && typeof tema === 'object') ? tema : {}
    // imágenes
    for (const k in imagenesState) delete imagenesState[k]
    if (t.imagenes && typeof t.imagenes === 'object') Object.assign(imagenesState, t.imagenes)
    setColores(t.colores || DEFAULT_COLORES)
    setFuentes(t.fuentes)
    setTextos(t.textos)
    document.getElementById('ap-wa-template').value =
        (typeof t.mensaje_wa === 'string' && t.mensaje_wa.trim()) ? t.mensaje_wa : DEFAULT_WA_TEMPLATE
    markActivePreset(t.preset && findPreset(t.preset) ? t.preset : null)
    // refrescar thumbnails de imágenes
    IMAGE_FIELDS.forEach(f => {
        const thumb = document.querySelector(`img[data-thumb="${f.key}"]`)
        const removeBtn = document.querySelector(`button[data-remove="${f.key}"]`)
        if (thumb) thumb.src = imagenesState[f.key] || f.def
        if (removeBtn) removeBtn.hidden = !imagenesState[f.key]
    })
}

;(async () => {
    const ctx = await bootstrapDashPage('apariencia')
    if (!ctx) return
    const { negocio } = ctx
    if (!negocio) {
        document.getElementById('editor-panel').innerHTML = '<div class="dash-error" style="padding:16px">No se encontró tu negocio.</div>'
        return
    }
    savedTema = (negocio.tema && typeof negocio.tema === 'object') ? negocio.tema : {}

    // El shell deja el wrap en display:block y el header es fijo (el body tiene
    // padding-top = alto del header). El editor llena el resto de la pantalla.
    const wrap = document.getElementById('dash-main-wrap')
    if (wrap) {
        wrap.style.display = 'flex'
        wrap.style.flexDirection = 'column'
        wrap.style.overflow = 'hidden'
        const header = document.querySelector('.main-header')
        const fitWrap = () => { wrap.style.height = `calc(100vh - ${header ? header.offsetHeight : 70}px)` }
        fitWrap()
        window.addEventListener('resize', fitWrap)
    }

    buildPresets()
    buildColorPickers()
    buildFontSelects()
    buildTextos()
    buildImagenes(negocio.id)
    buildWaSection()

    aplicarTemaAlPanel(savedTema)
    setupToolbar(negocio)
    // Si el iframe ya estaba listo, aplicamos; si no, se aplica al recibir ready.
    applyToIframe()
})()
