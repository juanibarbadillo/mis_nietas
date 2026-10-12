/**
 * Mantiene despierto el proyecto free de Supabase (se pausa a los 7 días
 * sin requests). Lo llama el cron de Vercel definido en vercel.json.
 *
 * Reusa VITE_SUPABASE_URL, que ya está cargada en Vercel para el build.
 * La service role key es server-only: nunca se hornea en el bundle.
 */
module.exports = async (req, res) => {
    // Vercel manda `Authorization: Bearer $CRON_SECRET` en las corridas del
    // cron si la variable está definida. Sin la variable no se exige nada,
    // así el deploy no se rompe antes de que esté cargada.
    const secreto = process.env.CRON_SECRET
    if (secreto && req.headers.authorization !== `Bearer ${secreto}`) {
        return res.status(401).json({ ok: false, error: 'No autorizado' })
    }

    const url = process.env.VITE_SUPABASE_URL
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !clave) {
        return res.status(500).json({
            ok: false,
            error: 'Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'
        })
    }

    try {
        const r = await fetch(`${url}/rest/v1/rpc/registrar_keepalive`, {
            method: 'POST',
            headers: {
                apikey: clave,
                Authorization: `Bearer ${clave}`,
                'Content-Type': 'application/json'
            },
            body: '{}'
        })

        const cuerpo = await r.text()
        if (!r.ok) {
            return res.status(500).json({ ok: false, error: cuerpo || `HTTP ${r.status}` })
        }

        // registrar_keepalive() devuelve la fila actualizada (viene como array).
        const data = cuerpo ? JSON.parse(cuerpo) : null
        const fila = Array.isArray(data) ? data[0] : data
        return res.status(200).json({ ok: true, ultimo_ping: fila?.ultimo_ping ?? null })
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message })
    }
}
