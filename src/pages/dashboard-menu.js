import { bootstrapDashPage } from '../../shared/dashboard-shell.js'
import { obtenerProductos, guardarProducto, eliminarProductoDeSupabase, renombrarCategoria } from '../../services/productos.service.js'
import { actualizarNegocio } from '../../services/negocios.service.js'
import { subirImagenProducto } from '../../services/storage.service.js'
import { recortarImagenCuadrada } from '../lib/image-cropper.js'
import placeholderImg from '/static/producto.jpeg'

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatPrecio(n) { return '$' + (Number(n) || 0).toLocaleString('es-AR'); }
function newUuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : ('p-' + Math.random().toString(36).slice(2, 11));
}
function showFeedback(el, msg, ok) {
    el.hidden = false;
    el.textContent = msg;
    el.className = 'dash-feedback ' + (ok ? 'ok' : 'error');
    setTimeout(() => { el.hidden = true; }, 4000);
}

let state = { negocioId: null, productos: [], secciones: [], editando: false, galeria: [] };

// ---- Secciones -----------------------------------------------------------
function categoriasUsadas() {
    const vistas = [];
    state.productos.forEach(p => {
        const c = (p.categoria || '').trim();
        if (c && vistas.indexOf(c) === -1) vistas.push(c);
    });
    return vistas;
}
function contarProductosEnSeccion(nombre) {
    return state.productos.filter(p => (p.categoria || '').trim() === nombre).length;
}
function poblarSelectCategoria(selected) {
    const sel = document.getElementById('prod-categoria');
    const cats = state.secciones.slice();
    if (selected && cats.indexOf(selected) === -1) cats.unshift(selected);
    if (!cats.length) cats.push('Productos');
    sel.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (selected) sel.value = selected;
}

function proximoOrden(categoria) {
    const existentes = state.productos.filter(p => (p.categoria || 'Productos') === categoria);
    if (!existentes.length) return 1;
    return Math.max(...existentes.map(p => p.orden || 0)) + 1;
}

// ---- Grilla de productos -------------------------------------------------
function productoCardHtml(p) {
    const tags = [];
    if (p.es_extra) tags.push('<span class="dash-menu-tag tag-extra">Extra</span>');
    const nFotos = Array.isArray(p.imagenes) ? p.imagenes.length : 0;
    if (nFotos > 1) tags.push(`<span class="dash-menu-tag">${nFotos} fotos</span>`);
    const cover = p.imagen || (Array.isArray(p.imagenes) && p.imagenes[0]) || placeholderImg;
    return `
        <div class="dash-menu-card" data-prod-id="${escapeHtml(p.id)}">
            <img src="${escapeHtml(cover)}" alt="">
            <div class="dash-menu-card-body">
                <h4>${escapeHtml(p.nombre || '')}</h4>
                <p class="dash-menu-card-desc">${escapeHtml(p.descripcion || '')}</p>
                <div class="dash-menu-card-tags">${tags.join('')}</div>
                <div class="dash-menu-card-meta">
                    <span>${escapeHtml(p.categoria || 'Productos')}</span>
                    <span class="price">${formatPrecio(p.precio)}</span>
                </div>
                <div class="dash-menu-card-actions">
                    <button data-action="edit" data-id="${escapeHtml(p.id)}">Editar</button>
                    <button data-action="del" data-id="${escapeHtml(p.id)}" class="btn-del">Eliminar</button>
                </div>
            </div>
        </div>`;
}
function renderGrid() {
    const host = document.getElementById('menu-grid');
    const orden = state.secciones.slice();
    const idxCat = c => {
        const i = orden.indexOf(c);
        return i === -1 ? orden.length : i;
    };
    const sorted = state.productos.slice().sort((a, b) => {
        const ca = a.categoria || '', cb = b.categoria || '';
        if (ca !== cb) {
            const d = idxCat(ca) - idxCat(cb);
            if (d !== 0) return d;
            return ca.localeCompare(cb);
        }
        if ((a.orden || 0) !== (b.orden || 0)) return (a.orden || 0) - (b.orden || 0);
        return (a.nombre || '').localeCompare(b.nombre || '');
    });
    if (!sorted.length) {
        host.innerHTML = '<div class="dash-empty">Aún no hay productos. Agregá el primero con "+ Agregar producto".</div>';
        return;
    }
    host.innerHTML = sorted.map(productoCardHtml).join('');
}

// ---- Galería de fotos (modal producto) -----------------------------------
function setImgStatus(msg, cls) {
    const el = document.getElementById('prod-img-status');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'dash-img-status' + (cls ? ' ' + cls : '');
}
function renderGaleria() {
    const cont = document.getElementById('prod-galeria');
    const thumbs = state.galeria.map((url, i) => `
        <div class="dash-galeria-thumb" data-idx="${i}">
            ${i === 0 ? '<span class="badge-principal">Principal</span>' : ''}
            <img src="${escapeHtml(url)}" alt="">
            <div class="dash-galeria-thumb-actions">
                ${i === 0 ? '<button type="button" disabled>★</button>' : '<button type="button" data-gal="principal" data-idx="' + i + '" title="Hacer principal">★</button>'}
                <button type="button" data-gal="del" data-idx="${i}" title="Quitar">✕</button>
            </div>
        </div>`).join('');
    const addTile = state.galeria.length < 3
        ? `<button type="button" class="dash-galeria-add" id="galeria-add"><span class="plus">+</span><span>Foto</span></button>`
        : '';
    cont.innerHTML = thumbs + addTile;
}

async function agregarFoto(file) {
    if (!file) return;
    if (state.galeria.length >= 3) { setImgStatus('Máximo 3 fotos por producto.', 'err'); return; }
    setImgStatus('Acomodá la foto…');
    let blob;
    try {
        blob = await recortarImagenCuadrada(file, { size: 1000 });
    } catch (e) {
        setImgStatus(e && e.message ? e.message : 'No se pudo procesar la imagen.', 'err');
        return;
    }
    if (!blob) { setImgStatus(''); return; } // canceló el recorte
    setImgStatus('Subiendo…');
    const url = await subirImagenProducto(state.negocioId, blob, 'jpg');
    if (!url) { setImgStatus('Error al subir la foto. Reintentá.', 'err'); return; }
    state.galeria.push(url);
    renderGaleria();
    setImgStatus('✓ Foto agregada', 'ok');
}

// ---- Modal producto ------------------------------------------------------
const modal = document.getElementById('modal');
const modalFb = document.getElementById('modal-feedback');
function openModal(producto) {
    modalFb.hidden = true;
    setImgStatus('');
    state.editando = !!producto;
    const isEdit = state.editando;
    document.getElementById('modal-title').textContent = isEdit ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('prod-id').value = isEdit ? producto.id : '';
    document.getElementById('prod-nombre').value = isEdit ? (producto.nombre || '') : '';
    document.getElementById('prod-desc').value = isEdit ? (producto.descripcion || '') : '';
    document.getElementById('prod-precio').value = isEdit ? (producto.precio || 0) : '';
    const cat = isEdit ? (producto.categoria || (state.secciones[0] || 'Productos')) : (state.secciones[0] || 'Productos');
    poblarSelectCategoria(cat);
    if (isEdit) {
        document.getElementById('prod-orden').value = producto.orden || 1;
    } else {
        document.getElementById('prod-orden').value = proximoOrden(cat);
    }
    document.getElementById('prod-es-extra').checked = !!producto?.es_extra;

    if (isEdit && Array.isArray(producto.imagenes) && producto.imagenes.length) {
        state.galeria = producto.imagenes.slice();
    } else if (isEdit && producto.imagen) {
        state.galeria = [producto.imagen];
    } else {
        state.galeria = [];
    }
    renderGaleria();
    document.getElementById('prod-imagen-file').value = '';
    modal.hidden = false;
}
function closeModal() { modal.hidden = true; }

async function saveProducto() {
    const id = document.getElementById('prod-id').value || newUuid();
    const nombre = document.getElementById('prod-nombre').value.trim();
    const desc = document.getElementById('prod-desc').value.trim();
    const precio = Number(document.getElementById('prod-precio').value);
    const categoria = document.getElementById('prod-categoria').value;
    const es_extra = document.getElementById('prod-es-extra').checked;
    const orden = Number(document.getElementById('prod-orden').value) || 1;

    if (!nombre) { showFeedback(modalFb, 'El nombre es obligatorio', false); return; }
    if (!(precio >= 0)) { showFeedback(modalFb, 'Precio inválido', false); return; }

    const producto = {
        id,
        nombre,
        descripcion: desc,
        precio,
        categoria,
        imagen: state.galeria[0] || null,
        imagenes: state.galeria.slice(),
        orden,
        activo: true,
        es_extra,
        negocio_id: state.negocioId
    };

    const saveBtn = document.getElementById('modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    const guardado = await guardarProducto(producto);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';

    if (!guardado) {
        showFeedback(modalFb, 'Error guardando producto', false);
        return;
    }
    state.productos = await obtenerProductos({ negocioId: state.negocioId });
    renderGrid();
    closeModal();
    showFeedback(document.getElementById('feedback'), '✓ Producto guardado', true);
}

async function delProducto(id) {
    if (!confirm('¿Eliminar este producto? Se marca como inactivo.')) return;
    const ok = await eliminarProductoDeSupabase(id);
    if (!ok) {
        showFeedback(document.getElementById('feedback'), 'Error eliminando', false);
        return;
    }
    state.productos = state.productos.filter(p => p.id !== id);
    renderGrid();
    showFeedback(document.getElementById('feedback'), '✓ Producto eliminado', true);
}

// ---- Administrador de secciones ------------------------------------------
const modalSec = document.getElementById('modal-secciones');
const secFb = document.getElementById('secciones-feedback');

function seccionRowHtml(nombre) {
    const count = contarProductosEnSeccion(nombre);
    return `
        <div class="dash-seccion-row" data-original="${escapeHtml(nombre)}">
            <input type="text" class="dash-seccion-nombre" value="${escapeHtml(nombre)}">
            <span class="dash-seccion-count">${count} prod.</span>
            <button type="button" data-act="up" title="Subir">↑</button>
            <button type="button" data-act="down" title="Bajar">↓</button>
            <button type="button" data-act="del" class="btn-del" title="Borrar">✕</button>
        </div>`;
}
function renderSeccionesLista() {
    const cont = document.getElementById('secciones-lista');
    cont.innerHTML = state.secciones.map(seccionRowHtml).join('');
    actualizarFlechasSecciones();
}
function actualizarFlechasSecciones() {
    const rows = Array.from(document.querySelectorAll('#secciones-lista .dash-seccion-row'));
    rows.forEach((row, i) => {
        const up = row.querySelector('[data-act="up"]');
        const down = row.querySelector('[data-act="down"]');
        if (up) up.disabled = i === 0;
        if (down) down.disabled = i === rows.length - 1;
    });
}
function openSeccionesModal() {
    secFb.hidden = true;
    renderSeccionesLista();
    modalSec.hidden = false;
}
function closeSeccionesModal() { modalSec.hidden = true; }

async function guardarSecciones() {
    const rows = Array.from(document.querySelectorAll('#secciones-lista .dash-seccion-row'));
    const nuevas = [];
    const renames = []; // { original, nuevo }
    for (const row of rows) {
        const original = row.getAttribute('data-original') || '';
        const nuevo = row.querySelector('.dash-seccion-nombre').value.trim();
        if (!nuevo) { showFeedback(secFb, 'Hay una sección sin nombre.', false); return; }
        if (nuevas.indexOf(nuevo) !== -1) { showFeedback(secFb, `La sección "${nuevo}" está repetida.`, false); return; }
        nuevas.push(nuevo);
        if (original && original !== nuevo) renames.push({ original, nuevo });
    }

    const saveBtn = document.getElementById('secciones-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';

    // Renombrar arrastra la categoría de los productos afectados.
    for (const r of renames) {
        await renombrarCategoria(state.negocioId, r.original, r.nuevo);
    }
    const negocio = await actualizarNegocio(state.negocioId, { secciones: nuevas });

    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar secciones';

    if (!negocio) { showFeedback(secFb, 'No se pudieron guardar las secciones.', false); return; }

    state.secciones = Array.isArray(negocio.secciones) ? negocio.secciones : nuevas;
    if (renames.length) {
        state.productos = await obtenerProductos({ negocioId: state.negocioId });
    }
    renderGrid();
    poblarSelectCategoria(document.getElementById('prod-categoria').value);
    closeSeccionesModal();
    showFeedback(document.getElementById('feedback'), '✓ Secciones actualizadas', true);
}

// ---- Bootstrap -----------------------------------------------------------
;(async () => {
    const ctx = await bootstrapDashPage('menu');
    if (!ctx) return;
    const { negocio } = ctx;
    if (!negocio) {
        document.getElementById('menu-grid').innerHTML = '<div class="dash-error">No se encontró tu negocio.</div>';
        return;
    }
    state.negocioId = negocio.id;
    state.secciones = Array.isArray(negocio.secciones) ? negocio.secciones.slice() : [];
    state.productos = await obtenerProductos({ negocioId: negocio.id });

    // Primera vez sin secciones definidas: las inicializo desde las categorías
    // que ya usan los productos (respetando su orden actual) y las persisto.
    if (!state.secciones.length) {
        const derivadas = categoriasUsadas();
        if (derivadas.length) {
            state.secciones = derivadas;
            await actualizarNegocio(state.negocioId, { secciones: derivadas });
        }
    }

    renderGrid();

    document.getElementById('btn-nuevo').addEventListener('click', () => openModal(null));
    document.getElementById('btn-secciones').addEventListener('click', openSeccionesModal);

    document.getElementById('menu-grid').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        const producto = state.productos.find(p => p.id === id);
        if (!producto) return;
        if (btn.dataset.action === 'edit') openModal(producto);
        else if (btn.dataset.action === 'del') delProducto(id);
    });

    document.getElementById('modal-save').addEventListener('click', saveProducto);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // Galería: clic en "+ Foto" o en acciones de cada thumb
    const fileInput = document.getElementById('prod-imagen-file');
    document.getElementById('prod-galeria').addEventListener('click', e => {
        const add = e.target.closest('#galeria-add');
        if (add) { fileInput.click(); return; }
        const act = e.target.closest('[data-gal]');
        if (!act) return;
        const idx = Number(act.dataset.idx);
        if (act.dataset.gal === 'del') {
            state.galeria.splice(idx, 1);
            renderGaleria();
        } else if (act.dataset.gal === 'principal') {
            const [u] = state.galeria.splice(idx, 1);
            state.galeria.unshift(u);
            renderGaleria();
        }
    });
    fileInput.addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        await agregarFoto(f);
    });

    document.getElementById('prod-categoria').addEventListener('change', () => {
        if (state.editando) return;
        document.getElementById('prod-orden').value = proximoOrden(document.getElementById('prod-categoria').value);
    });

    // "+ Nueva sección" rápida desde el modal de producto
    document.getElementById('btn-nueva-seccion').addEventListener('click', async () => {
        const nombre = (prompt('Nombre de la nueva sección:') || '').trim();
        if (!nombre) return;
        if (state.secciones.indexOf(nombre) !== -1) { poblarSelectCategoria(nombre); return; }
        state.secciones.push(nombre);
        await actualizarNegocio(state.negocioId, { secciones: state.secciones });
        poblarSelectCategoria(nombre);
    });

    // Administrador de secciones
    document.getElementById('secciones-save').addEventListener('click', guardarSecciones);
    document.getElementById('secciones-cancel').addEventListener('click', closeSeccionesModal);
    modalSec.addEventListener('click', e => { if (e.target === modalSec) closeSeccionesModal(); });
    document.getElementById('nueva-seccion-add').addEventListener('click', () => {
        const inp = document.getElementById('nueva-seccion-input');
        const nombre = inp.value.trim();
        if (!nombre) return;
        const existentes = Array.from(document.querySelectorAll('#secciones-lista .dash-seccion-nombre')).map(i => i.value.trim());
        if (existentes.indexOf(nombre) !== -1) { showFeedback(secFb, 'Esa sección ya existe.', false); return; }
        const cont = document.getElementById('secciones-lista');
        cont.insertAdjacentHTML('beforeend', seccionRowHtml(nombre));
        // La fila recién creada no tiene "original" (es nueva): la vaciamos.
        cont.lastElementChild.setAttribute('data-original', '');
        inp.value = '';
        actualizarFlechasSecciones();
    });
    document.getElementById('secciones-lista').addEventListener('click', e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const row = btn.closest('.dash-seccion-row');
        if (!row) return;
        const act = btn.dataset.act;
        if (act === 'up' && row.previousElementSibling) {
            row.parentNode.insertBefore(row, row.previousElementSibling);
            actualizarFlechasSecciones();
        } else if (act === 'down' && row.nextElementSibling) {
            row.parentNode.insertBefore(row.nextElementSibling, row);
            actualizarFlechasSecciones();
        } else if (act === 'del') {
            const original = row.getAttribute('data-original') || '';
            if (original && contarProductosEnSeccion(original) > 0) {
                showFeedback(secFb, `"${original}" tiene productos. Movélos a otra sección antes de borrarla.`, false);
                return;
            }
            row.remove();
            actualizarFlechasSecciones();
        }
    });
})();
