// ============================================================
// Catálogo de personalización (compartido entre el sitio público
// y el dashboard de Apariencia).
//   - PRESETS:   paletas de color predefinidas
//   - COLOR_VARS: mapa clave_tema -> variable CSS
//   - FONTS / FONT_ACENTO: fuentes disponibles (Google Fonts)
// ============================================================

// Paletas predefinidas. `colores` usa las mismas claves que COLOR_VARS.
export const PRESETS = [
    {
        id: 'kraft',
        nombre: 'Kraft / Marrón (actual)',
        colores: { primary: '#5a3823', secondary: '#e7d2ad', accent: '#b07a2e', text: '#3a2a1c', desc: '#8a7355', bg: '#fbf7ef', border: '#ece0cb' }
    },
    {
        id: 'olivo',
        nombre: 'Olivo / Campo',
        colores: { primary: '#3f4a2e', secondary: '#dfe3c8', accent: '#8a9a3c', text: '#2c331f', desc: '#6b7355', bg: '#f7f8f0', border: '#dde2cc' }
    },
    {
        id: 'vino',
        nombre: 'Vino / Bordó',
        colores: { primary: '#5e1f24', secondary: '#e9cdb0', accent: '#a8472e', text: '#3a1c1c', desc: '#8a6a5f', bg: '#fbf4ee', border: '#ecd9c9' }
    },
    {
        id: 'terracota',
        nombre: 'Terracota / Tomate',
        colores: { primary: '#8a3b1e', secondary: '#f1d9b5', accent: '#cc6b2c', text: '#3a2418', desc: '#9a7355', bg: '#fdf6ee', border: '#f0ddc6' }
    },
    {
        id: 'durazno',
        nombre: 'Durazno / Suave',
        colores: { primary: '#9c4a3c', secondary: '#f6dcc8', accent: '#e08a5d', text: '#3d241d', desc: '#a07b6a', bg: '#fff7f1', border: '#f3ddcd' }
    },
    {
        id: 'pizarra',
        nombre: 'Pizarra / Sobrio',
        colores: { primary: '#2f3a40', secondary: '#d7e0e3', accent: '#3f8f8a', text: '#222b30', desc: '#5f6c72', bg: '#f5f7f8', border: '#dde4e7' }
    }
];

// Claves de color del tema -> variable CSS que pinta el sitio.
export const COLOR_VARS = {
    primary: '--color-primary',
    secondary: '--color-secondary',
    accent: '--color-accent',
    text: '--color-text',
    desc: '--color-desc',
    bg: '--color-bg',
    border: '--color-border'
};

// Etiquetas legibles para los pickers del dashboard.
export const COLOR_LABELS = {
    primary: 'Principal (títulos, botones)',
    accent: 'Acento (precios, links)',
    secondary: 'Secundario (franjas suaves)',
    bg: 'Fondo de la página',
    text: 'Texto',
    desc: 'Texto secundario',
    border: 'Bordes'
};

// Fuentes para títulos y para texto. `google` = spec de la URL css2 (o null para fuente del sistema).
export const FONTS = [
    { id: 'fraunces', nombre: 'Fraunces (serif gourmet)', stack: "'Fraunces', Georgia, serif", google: 'Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,900' },
    { id: 'playfair', nombre: 'Playfair Display (elegante)', stack: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@400;600;700;800' },
    { id: 'lora', nombre: 'Lora (serif clásica)', stack: "'Lora', Georgia, serif", google: 'Lora:wght@400;500;600;700' },
    { id: 'merriweather', nombre: 'Merriweather (serif legible)', stack: "'Merriweather', Georgia, serif", google: 'Merriweather:wght@400;700;900' },
    { id: 'cormorant', nombre: 'Cormorant (serif fina)', stack: "'Cormorant Garamond', Georgia, serif", google: 'Cormorant+Garamond:wght@500;600;700' },
    { id: 'montserrat', nombre: 'Montserrat (sans moderna)', stack: "'Montserrat', sans-serif", google: 'Montserrat:wght@400;500;600;700;800' },
    { id: 'poppins', nombre: 'Poppins (sans redondeada)', stack: "'Poppins', sans-serif", google: 'Poppins:wght@400;500;600;700' },
    { id: 'nunito', nombre: 'Nunito (sans amable)', stack: "'Nunito', sans-serif", google: 'Nunito:wght@400;600;700;800' },
    { id: 'worksans', nombre: 'Work Sans (sans limpia)', stack: "'Work Sans', sans-serif", google: 'Work+Sans:wght@400;500;600;700' },
    { id: 'system', nombre: 'Sistema (neutra, carga rápida)', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", google: null }
];

// Fuente "de acento" (el subtítulo manuscrito del hero).
export const FONT_ACENTO = [
    { id: 'caveat', nombre: 'Caveat (manuscrita, actual)', stack: "'Caveat', cursive", google: 'Caveat:wght@600;700' },
    { id: 'dancing', nombre: 'Dancing Script', stack: "'Dancing Script', cursive", google: 'Dancing+Script:wght@500;600;700' },
    { id: 'pacifico', nombre: 'Pacifico', stack: "'Pacifico', cursive", google: 'Pacifico' },
    { id: 'shadows', nombre: 'Shadows Into Light', stack: "'Shadows Into Light', cursive", google: 'Shadows+Into+Light' },
    { id: 'none', nombre: 'Sin manuscrita (usar la de títulos)', stack: 'var(--font-titulos)', google: null }
];

// Textos editables del sitio público. El `placeholder` es el texto actual
// por defecto: si el campo queda vacío, el sitio usa ese valor (fallback).
// Cada `key` se corresponde con un data-tema="key" en u/index.html.
export const TEXT_GROUPS = [
    {
        titulo: 'Portada (hero)',
        campos: [
            { key: 'hero_kicker', label: 'Línea superior', placeholder: 'Atuel Norte · San Rafael · Mendoza' },
            { key: 'hero_subtitulo', label: 'Subtítulo', placeholder: 'Sabores caseros, como los de la abuela' },
            { key: 'hero_btn_primario', label: 'Botón principal', placeholder: 'Ver catálogo' },
            { key: 'hero_btn_secundario', label: 'Botón secundario', placeholder: 'Hacer un pedido' }
        ]
    },
    {
        titulo: 'Franja de confianza',
        campos: [
            { key: 'trust1_titulo', label: 'Ítem 1 · título', placeholder: 'Elaboración propia' },
            { key: 'trust1_sub', label: 'Ítem 1 · detalle', placeholder: 'Recetas artesanales' },
            { key: 'trust2_titulo', label: 'Ítem 2 · título', placeholder: 'En San Rafael' },
            { key: 'trust2_sub', label: 'Ítem 2 · detalle', placeholder: 'Envíos a domicilio' },
            { key: 'trust3_titulo', label: 'Ítem 3 · título', placeholder: 'Pago fácil' },
            { key: 'trust3_sub', label: 'Ítem 3 · detalle', placeholder: 'Efectivo o transferencia' },
            { key: 'trust4_titulo', label: 'Ítem 4 · título', placeholder: 'Pedí por WhatsApp' },
            { key: 'trust4_sub', label: 'Ítem 4 · detalle', placeholder: 'Coordinamos al instante' }
        ]
    },
    {
        titulo: 'Catálogo',
        campos: [
            { key: 'catalogo_kicker', label: 'Línea superior', placeholder: 'Nuestros productos' },
            { key: 'catalogo_titulo', label: 'Título', placeholder: 'Catálogo' },
            { key: 'catalogo_sub', label: 'Bajada', textarea: true, placeholder: 'Elegí tus productos, sumalos al pedido y lo coordinamos por WhatsApp.' }
        ]
    },
    {
        titulo: 'Nosotros',
        campos: [
            { key: 'nosotros_kicker', label: 'Línea superior', placeholder: 'Nuestra historia' },
            { key: 'nosotros_titulo', label: 'Título', placeholder: 'Un emprendimiento familiar' },
            { key: 'nosotros_p1', label: 'Párrafo 1', textarea: true, placeholder: 'En Regionales Mis Nietas hacemos las cosas como se hacían antes: dulce de leche, mermeladas, conservas, vinos caseros y aceite de oliva, todo de elaboración propia.' },
            { key: 'nosotros_p2', label: 'Párrafo 2', textarea: true, placeholder: 'Desde Atuel Norte, San Rafael (Mendoza), llevamos el verdadero sabor casero a tu mesa.' },
            { key: 'nosotros_btn', label: 'Texto del botón', placeholder: 'Ver el catálogo' }
        ]
    }
]

export function findById(list, id) {
    if (!id) return null;
    return list.find(x => x.id === id) || null;
}

export function findPreset(id) {
    return findById(PRESETS, id);
}
