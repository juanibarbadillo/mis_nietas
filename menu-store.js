import { obtenerProductos, guardarProducto, eliminarProductoDeSupabase } from './services/productos.service.js'
import { isSupabaseReady } from './services/supabase.js'
import placeholderImg from '/static/producto.jpeg'

var UMASUSHI_MENU_CATEGORIAS = ['Dulces y Mermeladas', 'Dulce de Leche', 'Conservas', 'Aceite de Oliva', 'Vinos', 'Cerveza Artesanal', 'Frutos Secos']
var CACHE_KEY = 'misnietas_productos_cache'
var CACHE_TTL_MS = 10 * 60 * 1000

export var productosCache = []

export function setProductosCache(val) {
    var arr = Array.isArray(val) ? val.slice() : []
    productosCache = arr
    guardarCacheLocal(arr)
}

function cargarCacheLocal() {
    try {
        var raw = localStorage.getItem(CACHE_KEY)
        if (!raw) return null
        var parsed = JSON.parse(raw)
        if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
            localStorage.removeItem(CACHE_KEY)
            return null
        }
        return parsed.data
    } catch (e) {
        return null
    }
}

function guardarCacheLocal(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }))
    } catch (e) {
        /* localStorage lleno, ignorar */
    }
}

function umasushiUid(prefix) {
    return (
        String(prefix || 'id') +
        '-' +
        Math.random().toString(36).slice(2, 7) +
        '-' +
        Date.now().toString(36)
    )
}

function umasushiClampInt(n, min) {
    var x = parseInt(n, 10)
    if (isNaN(x)) x = 0
    return Math.max(typeof min === 'number' ? min : 0, x)
}

function umasushiSafeText(s) {
    return String(s == null ? '' : s).trim()
}

function umasushiNormalizeCategory(cat) {
    var c = umasushiSafeText(cat)
    if (UMASUSHI_MENU_CATEGORIAS.indexOf(c) !== -1) return c
    return 'Productos'
}

function removeLegacyMenuStorageKeys() {
    try {
        localStorage.removeItem('umasushiMenu')
        localStorage.removeItem('menuProductos')
    } catch (e) {
        /* ignore */
    }
}

function defaultMenuSeed() {
    return [
        // Dulce de Leche
        { id: 'dl-vaca', nombre: 'Dulce de Leche de Vaca', descripcion: 'Artesanal, frasco de 500g.', precio: 6000, orden: 1, categoria: 'Dulce de Leche', tags: { veggi: true, glutenfree: true } },
        { id: 'dl-cabra', nombre: 'Dulce de Leche de Cabra', descripcion: '100% natural, libre de gluten. Frasco de 500g.', precio: 9000, orden: 2, categoria: 'Dulce de Leche', tags: { veggi: true, glutenfree: true } },
        // Dulces y Mermeladas (elaboración propia)
        { id: 'mm-uva', nombre: 'Mermelada de Uvas', descripcion: 'Elaboración propia, como la hacía la abuela.', precio: 4000, orden: 1, categoria: 'Dulces y Mermeladas', tags: { veggi: true, glutenfree: true } },
        { id: 'mm-pera', nombre: 'Mermelada de Pera', descripcion: 'Elaboración propia.', precio: 4000, orden: 2, categoria: 'Dulces y Mermeladas', tags: { veggi: true, glutenfree: true } },
        { id: 'mm-durazno', nombre: 'Mermelada de Durazno', descripcion: 'Elaboración propia.', precio: 4000, orden: 3, categoria: 'Dulces y Mermeladas', tags: { veggi: true, glutenfree: true } },
        // Vinos caseros
        { id: 'vino-bonarda', nombre: 'Tinto Bonarda "Santa Lucia"', descripcion: 'Vino casero, elaboración propia. 1 botella.', precio: 5000, orden: 1, categoria: 'Vinos', tags: { veggi: true, glutenfree: true } },
        { id: 'vino-malbec', nombre: 'Tinto Malbec "Perseveranza"', descripcion: 'Vino casero, elaboración propia. 1 botella.', precio: 6000, orden: 2, categoria: 'Vinos', tags: { veggi: true, glutenfree: true } },
        // Aceite de Oliva
        { id: 'aceite-900', nombre: 'Aceite de Oliva Extra Virgen 900ml', descripcion: 'Primera prensada en frío, suave.', precio: 6000, orden: 1, categoria: 'Aceite de Oliva', tags: { veggi: true, glutenfree: true } },
        { id: 'aceite-2l', nombre: 'Aceite de Oliva Extra Virgen 2L', descripcion: 'Primera prensada en frío.', precio: 13500, orden: 2, categoria: 'Aceite de Oliva', tags: { veggi: true, glutenfree: true } },
        // Conservas
        { id: 'salsa-cond', nombre: 'Salsa Condimentada', descripcion: 'Conserva artesanal.', precio: 3500, orden: 1, categoria: 'Conservas', tags: { veggi: true, glutenfree: true } },
        // Frutos Secos
        { id: 'fs-almendras', nombre: 'Almendras', descripcion: 'Frutos secos seleccionados. Por 250g.', precio: 4500, orden: 1, categoria: 'Frutos Secos', tags: { veggi: true, glutenfree: true } },
        { id: 'fs-nueces', nombre: 'Nueces Mariposa', descripcion: 'Frutos secos seleccionados. Por 250g.', precio: 4000, orden: 2, categoria: 'Frutos Secos', tags: { veggi: true, glutenfree: true } }
    ]
}

function normalizeMenuItem(raw) {
    var nombre = umasushiSafeText(raw && raw.nombre)
    var descripcion = umasushiSafeText(raw && (raw.descripcion != null ? raw.descripcion : raw.desc))
    var precio = umasushiClampInt(raw && raw.precio, 0)
    var categoria = umasushiNormalizeCategory(raw && raw.categoria)
    var imagen = umasushiSafeText(raw && raw.imagen) || placeholderImg
    var id = umasushiSafeText(raw && raw.id) || umasushiUid('p')
    var orden = umasushiClampInt(raw && raw.orden, 0)

    var tags = raw && typeof raw.tags === 'object' && raw.tags ? raw.tags : {}
    var esExtra = !!(raw && raw.es_extra)
    return {
        id: id,
        nombre: nombre,
        descripcion: descripcion,
        precio: precio,
        imagen: imagen,
        categoria: categoria,
        orden: orden,
        es_extra: esExtra,
        tags: {
            veggi: !!tags.veggi,
            glutenfree: tags.glutenfree == null ? true : !!tags.glutenfree
        }
    }
}

function productoToSupabaseRow(item) {
    var row = {
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: item.precio,
        categoria: item.categoria,
        imagen: item.imagen,
        orden: item.orden != null ? item.orden : 0,
        activo: true,
        es_extra: !!item.es_extra
    }
    if (item.tags && typeof item.tags === 'object') {
        row.tags = item.tags
    }
    return row
}

function obtenerExtrasProductos() {
    if (!productosCache || !productosCache.length) return []
    return productosCache
        .map(function (p) {
            return normalizeMenuItem(p)
        })
        .filter(function (x) {
            return x.es_extra && x.nombre && x.precio >= 0
        })
}

function obtenerMenu() {
    if (!productosCache || !productosCache.length) return []
    return productosCache
        .map(function (p) {
            return normalizeMenuItem(p)
        })
        .filter(function (x) {
            return x.nombre && x.precio >= 0
        })
}

function initializeMenu() {
    removeLegacyMenuStorageKeys()
    return loadMenu()
}

function loadMenu() {
    return obtenerMenu()
}

function buscarProductoPorNombre(nombre) {
    var n = umasushiSafeText(nombre)
    var menu = obtenerMenu()
    for (var i = 0; i < menu.length; i++) {
        if (menu[i].nombre === n) return menu[i]
    }
    return null
}

function buscarProductoPorId(id) {
    var rid = umasushiSafeText(id)
    var menu = obtenerMenu()
    for (var i = 0; i < menu.length; i++) {
        if (menu[i].id === rid) return menu[i]
    }
    return null
}

function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
        if (!file) return resolve('')
        var reader = new FileReader()
        reader.onload = function () {
            resolve(String(reader.result || ''))
        }
        reader.onerror = function (e) {
            reject(e)
        }
        reader.readAsDataURL(file)
    })
}

async function upsertProductoAsync(rawItem) {
    console.log('[menu] Upsert producto:', rawItem && rawItem.nombre)

    if (!isSupabaseReady()) {
        console.error('[menu] Supabase no disponible para guardar producto')
        throw new Error('Supabase no disponible')
    }

    var item = normalizeMenuItem(rawItem)
    var row = productoToSupabaseRow(item)
    var resultado = await guardarProducto(row)
    if (!resultado || !resultado.id) {
        console.warn('[menu] Error guardando en Supabase:', item.nombre)
        throw new Error('Error guardando producto en Supabase')
    }

    var productosActualizados = await obtenerProductos()
    setProductosCache(productosActualizados)
    console.log('[menu] ✓ Lista refrescada:', productosActualizados.length, 'productos')
    return productosActualizados
}

async function eliminarProductoAsync(productId) {
    console.log('[menu] Eliminando producto:', productId)

    var eliminado = await eliminarProductoDeSupabase(productId)
    if (!eliminado) {
        console.warn('[menu] Error eliminando en Supabase:', productId)
        throw new Error('Error eliminando producto')
    }

    var productosActualizados = await obtenerProductos()
    setProductosCache(productosActualizados)
    console.log('[menu] ✓ Lista refrescada:', productosActualizados.length, 'productos')
    return productosActualizados
}

async function seedMenuEjemploEnSupabase() {
    if (!isSupabaseReady()) {
        throw new Error('Supabase no disponible')
    }
    var seed = defaultMenuSeed()
    for (var i = 0; i < seed.length; i++) {
        var item = normalizeMenuItem(seed[i])
        var row = productoToSupabaseRow(item)
        var resultado = await guardarProducto(row)
        if (!resultado || !resultado.id) {
            throw new Error('No se pudo guardar: ' + (item.nombre || item.id))
        }
    }
    var list = await obtenerProductos()
    setProductosCache(Array.isArray(list) ? list.slice() : [])
    return productosCache.slice()
}

async function sincronizarProductos() {
    console.log('[menu] Sincronizando cache con Supabase...')
    var list = await obtenerProductos()
    setProductosCache(list)
    console.log('[menu] ✓ Cache actualizado:', list.length, 'productos')
    return true
}

export {
    normalizeMenuItem,
    productoToSupabaseRow,
    obtenerExtrasProductos,
    obtenerMenu,
    initializeMenu,
    loadMenu,
    buscarProductoPorNombre,
    buscarProductoPorId,
    fileToDataUrl,
    upsertProductoAsync,
    eliminarProductoAsync,
    seedMenuEjemploEnSupabase,
    sincronizarProductos,
    defaultMenuSeed,
    cargarCacheLocal
}
