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

// Rellena el contenido del sitio desde tema.textos (claves planas).
//   data-tema="k"        -> textContent
//   data-tema-html="k"   -> innerHTML
//   data-tema-href="k"   -> href (links: instagram, maps)
//   data-tema-src="k"    -> src (imágenes)
// Forward-compatible: si el HTML aún no tiene esos atributos, no hace nada.
function applyTextos(textos) {
    if (!textos || typeof textos !== 'object') return
    const val = key => {
        const v = textos[key]
        return (v == null || v === '') ? null : String(v)
    }
    document.querySelectorAll('[data-tema]').forEach(el => {
        const v = val(el.getAttribute('data-tema'))
        if (v != null) el.textContent = v
    })
    document.querySelectorAll('[data-tema-html]').forEach(el => {
        const v = val(el.getAttribute('data-tema-html'))
        if (v != null) el.innerHTML = v
    })
    document.querySelectorAll('[data-tema-href]').forEach(el => {
        const v = val(el.getAttribute('data-tema-href'))
        if (v != null) el.setAttribute('href', v)
    })
}

// Imágenes de marca (URLs de Storage). Claves: hero, nosotros, logo, favicon, og.
function applyImagenes(imagenes) {
    if (!imagenes || typeof imagenes !== 'object') return
    const get = k => imagenes[k] && typeof imagenes[k] === 'string' ? imagenes[k] : null

    // <img data-tema-src="clave">
    document.querySelectorAll('[data-tema-src]').forEach(el => {
        const v = get(el.getAttribute('data-tema-src'))
        if (v) el.setAttribute('src', v)
    })

    // Fondo del hero (mantiene posición/cover del CSS)
    const hero = get('hero')
    if (hero) {
        const el = document.querySelector('.hero')
        if (el) el.style.backgroundImage = `url("${hero}")`
    }

    // Favicon
    const fav = get('favicon')
    if (fav) {
        const link = document.querySelector('link[rel="icon"]')
        if (link) { link.setAttribute('href', fav); link.removeAttribute('type') }
    }

    // og:image (preferimos 'og', si no el hero)
    const og = get('og') || hero
    if (og) {
        const m = document.querySelector('meta[property="og:image"]')
        if (m) m.setAttribute('content', og)
    }
}

// SEO: solo en la home (donde existe el hero), para no pisar el título
// funcional de la página de pedido.
function applySeo(textos) {
    if (!textos || typeof textos !== 'object') return
    if (!document.getElementById('hero')) return
    const setMeta = (selector, value) => {
        if (!value) return
        const el = document.querySelector(selector)
        if (el) el.setAttribute('content', value)
    }
    if (textos.seo_title) {
        document.title = textos.seo_title
        setMeta('meta[property="og:title"]', textos.seo_title)
    }
    if (textos.seo_description) {
        setMeta('meta[name="description"]', textos.seo_description)
        setMeta('meta[property="og:description"]', textos.seo_description)
    }
}

export function applyTema(tema) {
    if (!tema || typeof tema !== 'object') return
    applyColores(tema.colores)
    applyFuentes(tema.fuentes)
    applyTextos(tema.textos)
    applyImagenes(tema.imagenes)
    applySeo(tema.textos)
}
