import { bootstrapDashPage, mountDashShell } from '../../shared/dashboard-shell.js'
import { actualizarNegocio } from '../../services/negocios.service.js'
import { PRESETS, COLOR_VARS, COLOR_LABELS, FONTS, FONT_ACENTO, TEXT_GROUPS, findById, findPreset } from '../../theme-config.js'

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

    buildPresets()
    buildColorPickers()
    buildFontSelects()
    buildTextos()

    setColores(tema.colores || DEFAULT_COLORES)
    setFuentes(tema.fuentes)
    setTextos(tema.textos)
    if (tema.preset && findPreset(tema.preset)) markActivePreset(tema.preset)
    updatePreview()

    document.getElementById('ap-save').addEventListener('click', async () => {
        const btn = document.getElementById('ap-save')
        btn.disabled = true
        btn.textContent = 'Guardando…'

        const activePreset = document.querySelector('.ap-preset.active')
        // Merge: preservamos otras claves del tema (textos, contacto, imagenes, seo)
        const nuevoTema = {
            ...tema,
            preset: activePreset ? activePreset.dataset.preset : 'custom',
            colores: readColores(),
            fuentes: readFuentes(),
            textos: readTextos()
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
