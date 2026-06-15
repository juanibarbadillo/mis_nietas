// Recortador cuadrado liviano, sin dependencias. Funciona con mouse y touch
// (pointer events). Abre un modal, deja encuadrar la foto (arrastrar + zoom) y
// devuelve un Blob JPEG cuadrado del tamaño pedido.
//
// Si alejás (zoom para atrás) hasta que la foto no llena el cuadrado, el espacio
// que sobra se rellena con la MISMA foto difuminada y agrandada de fondo (estilo
// Instagram), así la foto se ve completa y el resultado igual queda cuadrado.
// Ese fondo difuminado se "hornea" en la imagen final, por eso el resto del
// sitio no necesita ningún cambio.
//
// Resuelve: Blob (confirmado) | null (cancelado). Rechaza si la imagen no se
// pudo decodificar (ej. HEIC en algunos navegadores).

function el(tag, cls) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    return n
}

export function recortarImagenCuadrada(file, opciones = {}) {
    const size = opciones.size || 1000
    return new Promise((resolve, reject) => {
        if (!file) { resolve(null); return }
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('No se pudo leer la imagen. Si es una foto de iPhone (HEIC), probá sacarle una captura o exportarla como JPG.'))
        }
        img.onload = () => iniciarCropper(img, url, size, resolve)
        img.src = url
    })
}

function iniciarCropper(img, url, size, resolve) {
    const dpr = window.devicePixelRatio || 1
    const V = Math.round(Math.min((window.innerWidth || 360) * 0.82, 320))

    const overlay = el('div', 'cropper-overlay')
    const card = el('div', 'cropper-card')
    const title = el('h3', 'cropper-title'); title.textContent = 'Acomodá la foto'
    const hint = el('p', 'cropper-hint'); hint.textContent = 'Arrastrá para mover · acercá o alejá con la barra (o pellizcando). Si alejás, el fondo se difumina solo.'
    const stage = el('div', 'cropper-stage')
    stage.style.width = V + 'px'; stage.style.height = V + 'px'
    const canvas = el('canvas', 'cropper-canvas')
    canvas.width = Math.round(V * dpr); canvas.height = Math.round(V * dpr)
    canvas.style.width = V + 'px'; canvas.style.height = V + 'px'
    const zoom = el('input', 'cropper-zoom')
    const actions = el('div', 'cropper-actions')
    const btnCancel = el('button', 'cropper-cancel'); btnCancel.type = 'button'; btnCancel.textContent = 'Cancelar'
    const btnOk = el('button', 'cropper-confirm'); btnOk.type = 'button'; btnOk.textContent = 'Listo'

    const ctx = canvas.getContext('2d')
    const nw = img.naturalWidth || 1
    const nh = img.naturalHeight || 1

    // coverScale = la foto tapa todo el cuadrado (recorta). baseScale para el
    // cálculo del zoom. containScale = la foto entra entera (puede dejar huecos).
    const coverScale = V / Math.min(nw, nh)
    const containScale = V / Math.max(nw, nh)
    const baseScale = coverScale
    const zMin = containScale / coverScale   // <= 1 (zoom para atrás = ver entera)

    // Backdrop difumindo precalculado (downscale → upscale, sin ctx.filter para
    // que ande en cualquier navegador). Se estira a cuadrado: como va borroso,
    // la deformación no se nota y cubre todo.
    const TW = 64
    const blurTmp = el('canvas'); blurTmp.width = TW; blurTmp.height = TW
    blurTmp.getContext('2d').drawImage(img, 0, 0, TW, TW)

    let z = zMin                         // arranca mostrando la foto entera
    let scale = baseScale * z
    let ox = (V - nw * scale) / 2
    let oy = (V - nh * scale) / 2

    function clamp() {
        const dw = nw * scale, dh = nh * scale
        // Por eje: si tapa el cuadrado, lo mantenemos cubierto; si entra con
        // huecos, lo dejamos moverse pero adentro del cuadrado.
        ox = dw >= V ? Math.min(0, Math.max(V - dw, ox)) : Math.min(V - dw, Math.max(0, ox))
        oy = dh >= V ? Math.min(0, Math.max(V - dh, oy)) : Math.min(V - dh, Math.max(0, oy))
    }

    // Dibuja todo (fondo difuminado + foto) en un contexto, escalando las
    // coordenadas de V por `r` (preview r=1 con transform dpr; salida r=size/V).
    function render(ctx2, r) {
        const W = V * r
        ctx2.imageSmoothingEnabled = true
        ctx2.imageSmoothingQuality = 'high'
        ctx2.fillStyle = '#ffffff'
        ctx2.fillRect(0, 0, W, W)
        // Fondo difuminado (agrandado un poco para que no se vean los bordes).
        const over = 1.08
        const d = W * over, off = (W - d) / 2
        ctx2.drawImage(blurTmp, off, off, d, d)
        // Foto en primer plano, en su posición/tamaño actual.
        ctx2.drawImage(img, ox * r, oy * r, nw * scale * r, nh * scale * r)
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, V, V)
        render(ctx, 1)
    }
    function setZoom(newZ, cx, cy) {
        const px = cx == null ? V / 2 : cx
        const py = cy == null ? V / 2 : cy
        const imgX = (px - ox) / scale
        const imgY = (py - oy) / scale
        z = Math.min(4, Math.max(zMin, newZ))
        scale = baseScale * z
        ox = px - imgX * scale
        oy = py - imgY * scale
        clamp(); draw()
    }

    zoom.type = 'range'; zoom.min = String(zMin); zoom.max = '4'; zoom.step = '0.01'; zoom.value = String(z)

    clamp(); draw()

    const pointers = new Map()
    let lastDist = 0
    canvas.addEventListener('pointerdown', e => {
        canvas.setPointerCapture(e.pointerId)
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    })
    canvas.addEventListener('pointermove', e => {
        if (!pointers.has(e.pointerId)) return
        const prev = pointers.get(e.pointerId)
        const cur = { x: e.clientX, y: e.clientY }
        pointers.set(e.pointerId, cur)
        if (pointers.size === 1) {
            ox += (cur.x - prev.x); oy += (cur.y - prev.y); clamp(); draw()
        } else if (pointers.size === 2) {
            const pts = Array.from(pointers.values())
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
            if (lastDist) {
                const rect = canvas.getBoundingClientRect()
                const midX = (pts[0].x + pts[1].x) / 2 - rect.left
                const midY = (pts[0].y + pts[1].y) / 2 - rect.top
                setZoom(z * (dist / lastDist), midX, midY)
                zoom.value = String(z)
            }
            lastDist = dist
        }
    })
    function up(e) {
        pointers.delete(e.pointerId)
        if (pointers.size < 2) lastDist = 0
    }
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', e => {
        e.preventDefault()
        const rect = canvas.getBoundingClientRect()
        setZoom(z * (e.deltaY < 0 ? 1.08 : 0.92), e.clientX - rect.left, e.clientY - rect.top)
        zoom.value = String(z)
    }, { passive: false })
    zoom.addEventListener('input', () => setZoom(parseFloat(zoom.value)))

    function cleanup() {
        URL.revokeObjectURL(url)
        overlay.remove()
        document.removeEventListener('keydown', onKey)
    }
    function onKey(e) { if (e.key === 'Escape') { cleanup(); resolve(null) } }
    document.addEventListener('keydown', onKey)
    btnCancel.addEventListener('click', () => { cleanup(); resolve(null) })
    overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(); resolve(null) } })
    btnOk.addEventListener('click', () => {
        const out = el('canvas')
        out.width = size; out.height = size
        render(out.getContext('2d'), size / V)
        out.toBlob(b => { cleanup(); resolve(b) }, 'image/jpeg', 0.85)
    })

    stage.appendChild(canvas)
    actions.append(btnCancel, btnOk)
    card.append(title, hint, stage, zoom, actions)
    overlay.appendChild(card)
    document.body.appendChild(overlay)
}
