// Modo edición del sitio público.
// Se activa cuando la home se carga DENTRO del editor del dashboard (iframe con
// ?editor=1). Convierte el sitio en "seleccionable": resalta las partes
// editables, bloquea la navegación y las acciones normales (carrito, lightbox,
// links), le avisa al editor qué se tocó, y aplica en vivo el tema que recibe.
//
// Contrato de mensajes (mismo origen):
//   iframe → padre:  { type: 'editor:ready' }
//                    { type: 'editor:select', key, kind }   kind: text|html|href
//   padre  → iframe: { type: 'editor:apply', tema }
//                    { type: 'editor:highlight', key }
import { applyTema } from './theme-apply.js'

const EDITABLE_SELECTOR = '[data-tema], [data-tema-html], [data-tema-href], [data-tema-src]'

function infoOf(el) {
    if (!el) return null
    if (el.hasAttribute('data-tema')) return { kind: 'text', key: el.getAttribute('data-tema') }
    if (el.hasAttribute('data-tema-html')) return { kind: 'html', key: el.getAttribute('data-tema-html') }
    if (el.hasAttribute('data-tema-href')) return { kind: 'href', key: el.getAttribute('data-tema-href') }
    if (el.hasAttribute('data-tema-src')) return { kind: 'image', key: el.getAttribute('data-tema-src') }
    return null
}

function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&')
}
function findByKey(key) {
    const k = cssEscape(key)
    return document.querySelector(`[data-tema="${k}"], [data-tema-html="${k}"], [data-tema-href="${k}"], [data-tema-src="${k}"]`)
}

let selectedEl = null
function setSelected(el) {
    if (selectedEl && selectedEl !== el) selectedEl.classList.remove('editor-selected')
    selectedEl = el || null
    if (selectedEl) selectedEl.classList.add('editor-selected')
}

function send(msg) {
    try { window.parent.postMessage(msg, window.location.origin) } catch (e) { /* noop */ }
}

export function initEditorBridge() {
    const root = document.documentElement
    root.classList.add('editor-mode')

    // Interceptar TODOS los clicks en fase de captura: en modo edición no se
    // navega ni se agrega al carrito; tocar una parte editable la selecciona.
    document.addEventListener('click', (e) => {
        const editable = e.target.closest(EDITABLE_SELECTOR)
        e.preventDefault()
        e.stopPropagation()
        if (editable) {
            const info = infoOf(editable)
            if (info) {
                setSelected(editable)
                send({ type: 'editor:select', key: info.key, kind: info.kind })
            }
        } else {
            setSelected(null)
        }
    }, true)

    // Cortar submits y aperturas en nueva pestaña por las dudas.
    document.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation() }, true)
    document.addEventListener('auxclick', (e) => { e.preventDefault(); e.stopPropagation() }, true)

    window.addEventListener('message', (e) => {
        if (e.origin !== window.location.origin || !e.data || typeof e.data !== 'object') return
        const m = e.data
        if (m.type === 'editor:apply' && m.tema) {
            applyTema(m.tema)
        } else if (m.type === 'editor:highlight' && m.key) {
            const el = findByKey(m.key)
            if (el) {
                setSelected(el)
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    })

    send({ type: 'editor:ready' })
}
