import { bootstrapDashPage, mountDashShell } from '../../shared/dashboard-shell.js'
import { actualizarNegocio } from '../../services/negocios.service.js'
import { subirImagenBranding } from '../../services/storage.service.js'
import { PRESETS, COLOR_VARS, COLOR_LABELS, FONTS, FONT_ACENTO, TEXT_GROUPS, IMAGE_FIELDS, DEFAULT_WA_TEMPLATE, WA_TOKENS, findById, findPreset } from '../../theme-config.js'

// Estado de las imágenes (clave -> URL). Se inicializa desde tema.imagenes.
const imagenesState = {}

// Orden en que se muestran los pickers de color
const COLOR_ORDER = ['primary', 'accent', 'secondary', 'bg', 'text', 'desc', 'border']

// Valores por defecto = paleta/fuentes actuales del sitio (fallback si tema vacío)
const DEFAULT_COLORES = findPreset('kraft').colores
const DEFAULT_FUENTES = { titulos: 'fraunces', texto: 'system', acento: 'caveat' }

const feedback = document.getElementById('ap-feedback')
function showFeedback(msg, ok) {
    feedback.hidden = false
    feedback.textContent = msg
    feedback.className = 'dash-feedback ' + (ok ? 'ok' : 'error')
    if (ok) setTimeout(() => { feedback.hidden = true }, 5000)
}

function injectGoogleFont(googleSpec) {
    if (!googleSpec) return
    const id = 'gfont-' + googleSpec.replace(/[^a-z0-9]/gi, '').toLowerCase()
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=' + googleSpec + '&display=swap'
    document.head.appendChild(link)
}

// ---- Construcción del formulario ----
function buildPresets() {
    const cont = document.getElementById('ap-presets')
    cont.innerHTML = PRESETS.map(p => {
        const dots = ['primary', 'accent', 'secondary', 'bg']
            .map(k => `<span style="background:${p.colores[k]}"></span>`).join('')
        return `<button type="button" class="ap-preset" data-preset="${p.id}">
            <span class="ap-preset-dots">${dots}</span>
            <span class="ap-preset-name">${p.nombre}</span>
        </button>`
    }).join('')
    cont.querySelectorAll('.ap-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = findPreset(btn.dataset.preset)
            if (!preset) return
            setColores(preset.colores)
            markActivePreset(preset.id)
            updatePreview()
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
            const key = inp.dataset.color
            cont.querySelector(`input[data-hex="${key}"]`).value = inp.value
            markActivePreset(null)
            updatePreview()
        })
    })
    cont.querySelectorAll('input[data-hex]').forEach(inp => {
        inp.addEventListener('input', () => {
            let v = inp.value.trim()
            if (v && !v.startsWith('#')) v = '#' + v
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                const key = inp.dataset.hex
                cont.querySelector(`input[data-color="${key}"]`).value = v
                markActivePreset(null)
                updatePreview()
            }
        })
    })
}

function buildFontSelects() {
    const fill = (id, list) => {
        const sel = document.getElementById(id)
        sel.innerHTML = list.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('')
        sel.addEventListener('change', updatePreview)
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
}

// ---- Estado <-> formulario ----
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

// Reescala la imagen en un canvas y devuelve un Blob liviano.
function fileToBlob(file, cfg) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            let w = img.naturalWidth, h = img.naturalHeight
            const scale = Math.min(1, cfg.maxW / w, cfg.maxH / h)
            w = Math.max(1, Math.round(w * scale))
            h = Math.max(1, Math.round(h * scale))
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
            } catch (e) {
                console.error('[apariencia] imagen:', e)
                setStatus('No se pudo procesar la imagen.', 'err')
            }
        })

        removeBtn.addEventListener('click', () => {
            delete imagenesState[cfg.key]
            thumb.src = cfg.def
            fileInp.value = ''
            removeBtn.hidden = true
            setStatus('Volverá a la imagen por defecto al guardar.')
        })
    })
}

function buildWaSection() {
    const tokensCont = document.getElementById('ap-wa-tokens')
    const textarea = document.getElementById('ap-wa-template')
    if (!tokensCont || !textarea) return

    tokensCont.innerHTML = WA_TOKENS.map(t =>
        `<button type="button" class="ap-wa-token" data-token="${t.token}" title="${t.desc}">${t.token}</button>`
    ).join('')

    tokensCont.querySelectorAll('.ap-wa-token').forEach(btn => {
        btn.addEventListener('click', () => {
            const tk = btn.dataset.token
            const start = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length
            const end = textarea.selectionEnd != null ? textarea.selectionEnd : textarea.value.length
            textarea.value = textarea.value.slice(0, start) + tk + textarea.value.slice(end)
            const pos = start + tk.length
            textarea.focus()
            textarea.setSelectionRange(pos, pos)
        })
    })

    document.getElementById('ap-wa-load-default').addEventListener('click', () => {
        textarea.value = DEFAULT_WA_TEMPLATE
        textarea.focus()
    })
    document.getElementById('ap-wa-clear').addEventListener('click', () => {
        textarea.value = ''
        textarea.focus()
    })
}

function setTextos(textos) {
    const t = textos || {}
    TEXT_GROUPS.forEach(g => g.campos.forEach(c => {
        const el = document.getElementById('ap-t-' + c.key)
        if (el) el.value = t[c.key] || ''
    }))
}

function readTextos() {
    const out = {}
    TEXT_GROUPS.forEach(g => g.campos.forEach(c => {
        const el = document.getElementById('ap-t-' + c.key)
        const val = el ? el.value.trim() : ''
        if (val) out[c.key] = val   // vacío => se omite => el sitio usa el default
    }))
    return out
}

function markActivePreset(id) {
    document.querySelectorAll('.ap-preset').forEach(b => {
        b.classList.toggle('active', !!id && b.dataset.preset === id)
    })
}

// ---- Vista previa (scoped al cuadro #ap-preview) ----
function updatePreview() {
    const prev = document.getElementById('ap-preview')
    const colores = readColores()
    for (const key in COLOR_VARS) {
        if (colores[key]) prev.style.setProperty(COLOR_VARS[key], colores[key])
    }
    const fuentes = readFuentes()
    const tit = findById(FONTS, fuentes.titulos)
    const txt = findById(FONTS, fuentes.texto)
    const acc = findById(FONT_ACENTO, fuentes.acento)
    if (tit) { injectGoogleFont(tit.google); prev.style.setProperty('--font-titulos', tit.stack) }
    if (txt) { injectGoogleFont(txt.google); prev.style.setProperty('--font-texto', txt.stack) }
    if (acc) { injectGoogleFont(acc.google); prev.style.setProperty('--font-acento', acc.stack) }
}

;(async () => {
    const ctx = await bootstrapDashPage('apariencia')
    if (!ctx) return
    const { negocio } = ctx
    if (!negocio) {
        document.querySelector('.ap-forms').innerHTML = '<div class="dash-error">No se encontró tu negocio.</div>'
        return
    }

    const tema = (negocio.tema && typeof negocio.tema === 'object') ? negocio.tema : {}
    if (tema.imagenes && typeof tema.imagenes === 'object') Object.assign(imagenesState, tema.imagenes)

    buildPresets()
    buildColorPickers()
    buildFontSelects()
    buildTextos()
    buildImagenes(negocio.id)
    buildWaSection()

    setColores(tema.colores || DEFAULT_COLORES)
    setFuentes(tema.fuentes)
    setTextos(tema.textos)
    document.getElementById('ap-wa-template').value = (typeof tema.mensaje_wa === 'string') ? tema.mensaje_wa : ''
    if (tema.preset && findPreset(tema.preset)) markActivePreset(tema.preset)
    updatePreview()

    document.getElementById('ap-save').addEventListener('click', async () => {
        const btn = document.getElementById('ap-save')
        btn.disabled = true
        btn.textContent = 'Guardando…'

        const activePreset = document.querySelector('.ap-preset.active')
        // Merge: preservamos otras claves del tema (textos, contacto, imagenes, seo)
        const waVal = (document.getElementById('ap-wa-template').value || '').trim()
        const nuevoTema = {
            ...tema,
            preset: activePreset ? activePreset.dataset.preset : 'custom',
            colores: readColores(),
            fuentes: readFuentes(),
            textos: readTextos(),
            imagenes: { ...imagenesState },
            mensaje_wa: waVal
        }

        const actualizado = await actualizarNegocio(negocio.id, { tema: nuevoTema })
        btn.disabled = false
        btn.textContent = 'Guardar cambios'

        if (!actualizado) {
            showFeedback('Error guardando. Revisá la consola.', false)
            return
        }
        negocio.tema = actualizado.tema || nuevoTema
        showFeedback('✓ Cambios guardados. Abrí "Ver mi sitio" para verlos.', true)
        mountDashShell({ active: 'apariencia', userEmail: ctx.session.user.email, negocio: actualizado })
    })
})()
