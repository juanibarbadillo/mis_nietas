import { productosCache } from './menu-store.js'
import { DEFAULT_WA_TEMPLATE } from './theme-config.js'

export var umasushiZonasCache = []

// Rinde una plantilla de mensaje reemplazando {etiquetas} por sus valores.
// Si TODAS las etiquetas de una línea quedan vacías, se omite la línea entera
// (ej.: "📍 {direccion}" en retiro). Etiquetas desconocidas se dejan como están.
function renderPlantillaMensaje(tpl, tokens) {
    var lines = String(tpl).split('\n')
    var out = []
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
        if (!/\{(\w+)\}/.test(line)) { out.push(line); continue }
        var algunoConValor = false
        var replaced = line.replace(/\{(\w+)\}/g, function (m, key) {
            if (!(key in tokens)) { algunoConValor = true; return m }   // etiqueta desconocida: dejar literal
            var v = tokens[key]
            if (v !== '' && v != null) algunoConValor = true
            return v == null ? '' : String(v)
        })
        if (!algunoConValor) continue   // toda la línea dependía de etiquetas vacías
        out.push(replaced)
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '')
}

export function setUmasushiZonasCache(val) {
    umasushiZonasCache = Array.isArray(val) ? val.slice() : []
}

export function umasushiEscapeHtml(text) {
    if (text == null) return ''
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function formatPedidoTimestamp(date) {
    var d = date instanceof Date ? date : new Date()
    var tz = 'America/Argentina/Mendoza'
    var fmt = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz
    })
    var parts = fmt.formatToParts(d)
    var map = {}
    for (var i = 0; i < parts.length; i++) {
        map[parts[i].type] = parts[i].value
    }
    var day = map.day || '00'
    var month = map.month || '00'
    var year = map.year || '0000'
    var hour = map.hour || '00'
    var minute = map.minute || '00'
    return day + '/' + month + '/' + year + ' - ' + hour + ':' + minute + ' hs'
}

export function obtenerZonasDelivery() {
    if (!Array.isArray(umasushiZonasCache)) return []
    return umasushiZonasCache.filter(function (zona) {
        return zona && zona.center && zona.radiusM != null
    })
}

export function obtenerExtrasStored() {
    try {
        var raw = localStorage.getItem('umasushiPedidoExtras')
        if (!raw) return {}
        var j = JSON.parse(raw)
        if (!j || typeof j !== 'object') return {}
        var clean = {}
        for (var k in j) {
            if (k === 'teriyaki' || k === 'soja') continue
            var v = parseInt(j[k], 10)
            if (v > 0) clean[k] = v
        }
        return clean
    } catch (e) {
        return {}
    }
}

export function calcularExtrasMonto(extras) {
    if (!extras) return 0
    if (Array.isArray(extras)) {
        return extras.reduce(function (acc, x) {
            var precio = Number(x && x.precio) || 0
            var cant = Math.max(0, parseInt(x && x.cantidad, 10) || 0)
            return acc + precio * cant
        }, 0)
    }
    if (typeof extras !== 'object') return 0
    if (!productosCache || !Array.isArray(productosCache)) return 0
    var total = 0
    var ids = Object.keys(extras)
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i]
        var cant = Math.max(0, parseInt(extras[id], 10) || 0)
        if (cant === 0) continue
        var p = productosCache.find(function (x) { return x.id === id })
        if (p) total += (Number(p.precio) || 0) * cant
    }
    return total
}

export function obtenerSubtotalProductos(productos) {
    if (!productos || !productos.length) return 0
    var sum = 0
    for (var i = 0; i < productos.length; i++) {
        var item = productos[i]
        sum += (item.precio || 0) * (item.cantidad || 0)
    }
    return sum
}

export function obtenerTotalPedidoNumerico(productos, extras, costoEnvioDelivery) {
    var subProd = obtenerSubtotalProductos(productos)
    var ex = calcularExtrasMonto(extras)
    var envio =
        typeof costoEnvioDelivery === 'number' && !isNaN(costoEnvioDelivery) ? Math.max(0, costoEnvioDelivery) : 0
    return subProd + ex + envio
}

export function extrasLineItems(extras) {
    if (Array.isArray(extras)) {
        return extras
            .filter(function (x) { return x && (x.cantidad || 0) > 0 })
            .map(function (x) {
                var nombre = x.nombre || x.label || ''
                var precio = Number(x.precio) || 0
                var cantidad = Math.max(0, parseInt(x.cantidad, 10) || 0)
                return {
                    id: x.id || null,
                    label: 'Extra ' + nombre,
                    cantidad: cantidad,
                    precio: precio,
                    sub: precio * cantidad
                }
            })
    }
    if (!extras || typeof extras !== 'object') return []
    if (!productosCache || !Array.isArray(productosCache)) return []
    var lines = []
    var ids = Object.keys(extras)
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i]
        var cant = Math.max(0, parseInt(extras[id], 10) || 0)
        if (cant === 0) continue
        var p = productosCache.find(function (x) { return x.id === id })
        if (!p) continue
        var precio = Number(p.precio) || 0
        lines.push({
            id: id,
            label: 'Extra ' + (p.nombre || ''),
            cantidad: cant,
            precio: precio,
            sub: precio * cant
        })
    }
    return lines
}

export function ubicacionKitchenHtml(url) {
    if (!url || typeof url !== 'string') return 'No especificada'
    if (url.indexOf('http') === 0) {
        return '<a href="' + umasushiEscapeHtml(url) + '" target="_blank" rel="noopener">Ver ubicación</a>'
    }
    return umasushiEscapeHtml(url)
}

export function formatoMarcaTemporalPedido(pedido) {
    if (!pedido) return '—'
    if (pedido.fecha) {
        try {
            return new Date(pedido.fecha).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch (e) {
            console.error('[fecha] Error formateando fecha:', e)
        }
    }
    if (pedido.fechaHoraPedido) return pedido.fechaHoraPedido
    if (pedido.horario) return pedido.horario
    return '—'
}

export function construirMensajeWhatsApp(params) {
    var nombre = params.cliente || ''
    var telefono = params.telefono || ''
    var pedido = params.productos || []
    var extras = params.extras || {}
    var subProd = obtenerSubtotalProductos(pedido)
    var montoExtras = Array.isArray(extras)
        ? extras.reduce(function (acc, x) { return acc + (Number(x.precio) || 0) * (Number(x.cantidad) || 0) }, 0)
        : calcularExtrasMonto(extras)
    var zonaNombre = params.zonaNombre || ''
    var costoEnvio = params.costoEnvio || 0
    var entrega = params.entrega || ''
    var pago = params.pago || ''
    var fechaHora = params.fecha
        ? formatoMarcaTemporalPedido(params)
        : (params.fechaHoraPedido || '')
    var ubicacionTxt = params.direccion_texto || ''
    var ubicacionLink = params.maps_url || ''
    var montoPagara = params.montoPagaraCon
    var total = params.totalFinal

    var esDomicilio = entrega.indexOf('domicilio') !== -1
    // Formato de monto con separador de miles (es-AR): 12500 -> $12.500
    var fmt = function (n) {
        return '$' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    }

    // Bloques dinámicos (multilínea)
    var productosBlock = pedido.map(function (item) {
        return '• ' + item.cantidad + '×  ' + item.nombre + '  —  ' + fmt(item.precio * item.cantidad)
    }).join('\n')

    var exLines = extrasLineItems(extras)
    var extrasBlock = exLines.length
        ? '✨ *Extras*\n' + exLines.map(function (el) {
            return '• ' + (el.label || '').replace(/^Extra\s+/i, '') + '  ×' + el.cantidad + '  —  ' + fmt(el.sub)
        }).join('\n')
        : ''

    var envioVal = ''
    if (esDomicilio) {
        envioVal = params.envioACoordinar
            ? 'a coordinar 📲'
            : fmt(costoEnvio) + (zonaNombre ? '  (' + zonaNombre + ')' : '')
    }

    var pagaCon = (pago === 'Efectivo' && montoPagara != null && String(montoPagara).trim() !== '')
        ? fmt(String(montoPagara).replace(/[^\d]/g, ''))
        : ''

    var tokens = {
        nombre: nombre,
        telefono: telefono,
        productos: productosBlock,
        extras: extrasBlock,
        subtotal: fmt(subProd + montoExtras),
        envio: envioVal,
        total: fmt(total),
        pago: pago,
        paga_con: pagaCon,
        entrega: entrega,
        direccion: esDomicilio ? (ubicacionTxt || '') : '',
        mapa: (esDomicilio && ubicacionLink && ubicacionLink !== 'No especificada') ? ubicacionLink : '',
        indicaciones: (params.indicaciones_cliente || '').trim(),
        fecha: (fechaHora && fechaHora !== '—') ? fechaHora : '',
        link: params.linkPedido || ''
    }

    var tpl = (params.template && String(params.template).trim()) ? String(params.template) : DEFAULT_WA_TEMPLATE
    return renderPlantillaMensaje(tpl, tokens)
}
