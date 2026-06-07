// ============================================================
// Aplica el `tema` del negocio al sitio público.
// Se llama una vez resuelto el negocio (script.js). Cualquier campo
// ausente se deja con el valor por defecto del CSS/HTML (fallback),
// así la página nunca queda rota.
// ============================================================
import { COLOR_VARS, FONTS, FONT_ACENTO, findById } from './theme-config.js'

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

function applyColores(colores) {
    if (!colores || typeof colores !== 'object') return
    const root = document.documentElement
    for (const key in COLOR_VARS) {
        const val = colores[key]
        if (val && typeof val === 'string') root.style.setProperty(COLOR_VARS[key], val)
    }
}

function applyFuentes(fuentes) {
    if (!fuentes || typeof fuentes !== 'object') return
    const root = document.documentElement
    const tit = findById(FONTS, fuentes.titulos)
    if (tit) { injectGoogleFont(tit.google); root.style.setProperty('--font-titulos', tit.stack) }
    const txt = findById(FONTS, fuentes.texto)
    if (txt) { injectGoogleFont(txt.google); root.style.setProperty('--font-texto', txt.stack) }
    const acc = findById(FONT_ACENTO, fuentes.acento)
    if (acc) { injectGoogleFont(acc.google); root.style.setProperty('--font-acento', acc.stack) }
}

// Rellena elementos marcados con data-tema="clave" usando tema.textos[clave].
// Forward-compatible: si el HTML aún no tiene esos atributos, no hace nada.
function applyTextos(textos) {
    if (!textos || typeof textos !== 'object') return
    document.querySelectorAll('[data-tema]').forEach(el => {
        const key = el.getAttribute('data-tema')
        const val = textos[key]
        if (val == null || val === '') return
        if (el.hasAttribute('data-tema-html')) el.innerHTML = String(val)
        else el.textContent = String(val)
    })
}

export function applyTema(tema) {
    if (!tema || typeof tema !== 'object') return
    applyColores(tema.colores)
    applyFuentes(tema.fuentes)
    applyTextos(tema.textos)
    // (Fases siguientes) imágenes y SEO
}
