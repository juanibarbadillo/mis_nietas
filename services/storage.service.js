import { getSupabase, isSupabaseReady } from './supabase.js'

const BUCKET = 'branding'

// Sube un Blob al bucket `branding` (carpeta = negocioId) y devuelve la URL
// pública. Nombre con timestamp para evitar caché vieja del CDN.
export async function subirImagenBranding(negocioId, campo, blob, ext) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return null
    if (!negocioId || !blob) return null

    const ts = Date.now()
    const path = `${negocioId}/${campo}-${ts}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || undefined,
        upsert: true
    })
    if (error) {
        console.error('[storage] subirImagenBranding:', error.message)
        return null
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data?.publicUrl || null
}
