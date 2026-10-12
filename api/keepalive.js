const nodemailer = require('nodemailer')

/**
 * Mantiene despierto el proyecto free de Supabase (se pausa a los 7 días
 * sin requests). Lo llama el cron de Vercel definido en vercel.json.
 *
 * Reusa VITE_SUPABASE_URL, que ya está cargada en Vercel para el build.
 * La service role key es server-only: nunca se hornea en el bundle.
 *
 * Avisa por mail en dos casos, y en ninguno más — el mail de "todo bien"
 * diario sería ruido que se termina ignorando:
 *   1) el RPC falló (clave revocada, Supabase caído): algo hay que arreglar ya;
 *   2) al correr detecta que `ultimo_ping` quedó viejo, o sea que se
 *      saltearon corridas. Es detección retroactiva de un hueco.
 *
 * Lo que NO puede detectar: que el cron deje de dispararse del todo. Si eso
 * pasa no corre nada, y por lo tanto no hay quién mande el mail. La red de
 * seguridad es que a los 7 días se pausa y el sitio queda sin productos.
 */

/** Más de esto entre dos pings = se saltearon corridas (el cron es diario). */
const HORAS_PARA_ALERTAR = 48

/** Manda el aviso. Nunca tira: el mail no puede romper el keepalive. */
async function avisarPorMail(asunto, cuerpo) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !NOTIFY_EMAIL) {
        console.error('[keepalive] aviso no enviado: faltan las SMTP_* o NOTIFY_EMAIL')
        return false
    }
    try {
        const puerto = Number(SMTP_PORT || 587)
        const transporte = nodemailer.createTransport({
            host: SMTP_HOST,
            port: puerto,
            // 465 es SMTPS directo; 587 arranca en claro y sube a TLS con STARTTLS.
            secure: puerto === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        })
        const enviado = await transporte.sendMail({
            from: {
                name: process.env.SMTP_FROM_NAME || 'Regionales Mis Nietas',
                address: process.env.SMTP_FROM_EMAIL || SMTP_USER
            },
            to: NOTIFY_EMAIL,
            subject: asunto,
            text: cuerpo
        })
        console.log(`[keepalive] aviso enviado — "${asunto}" — aceptado: ${enviado.accepted?.join(', ')}`)
        return true
    } catch (e) {
        console.error(`[keepalive] aviso no enviado: ${e.message}`)
        return false
    }
}

const fecha = iso => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

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

    const cabeceras = {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json'
    }

    // Se lee ANTES de actualizar: registrar_keepalive() devuelve el valor nuevo,
    // y para medir el hueco hace falta el viejo.
    let pingAnterior = null
    try {
        const r = await fetch(`${url}/rest/v1/keepalive_pings?select=ultimo_ping&id=eq.1`, { headers: cabeceras })
        if (r.ok) pingAnterior = (await r.json())[0]?.ultimo_ping ?? null
    } catch (e) {
        // No es fatal: sin esto se pierde la detección del hueco, no el ping.
        console.error(`[keepalive] no se pudo leer el ping anterior: ${e.message}`)
    }

    try {
        const r = await fetch(`${url}/rest/v1/rpc/registrar_keepalive`, {
            method: 'POST',
            headers: cabeceras,
            body: '{}'
        })

        const cuerpo = await r.text()
        if (!r.ok) {
            const detalle = cuerpo || `HTTP ${r.status}`
            await avisarPorMail(
                '⚠️ Keepalive falló — Regionales Mis Nietas',
                [
                    'El cron que evita que Supabase pause el proyecto no pudo escribir en la base.',
                    '',
                    `Error: ${detalle}`,
                    `Código HTTP: ${r.status}`,
                    '',
                    'Causa más probable: la service role key fue rotada o revocada y hay que',
                    'actualizar SUPABASE_SERVICE_ROLE_KEY en las env vars de Vercel.',
                    '',
                    'Si esto no se arregla, a los 7 días Supabase pausa el proyecto y el panel',
                    'de administración deja de poder loguear.'
                ].join('\n')
            )
            return res.status(500).json({ ok: false, error: detalle })
        }

        // registrar_keepalive() devuelve la fila actualizada (viene como array).
        const data = cuerpo ? JSON.parse(cuerpo) : null
        const fila = Array.isArray(data) ? data[0] : data

        // Si el ping anterior quedó viejo, hubo corridas que no pasaron.
        if (pingAnterior) {
            const horas = (Date.now() - new Date(pingAnterior).getTime()) / 36e5
            if (horas > HORAS_PARA_ALERTAR) {
                const dias = Math.floor(horas / 24)
                await avisarPorMail(
                    `⚠️ El keepalive estuvo ${dias} día(s) sin correr — Regionales Mis Nietas`,
                    [
                        `El cron volvió a correr, pero antes estuvo ${horas.toFixed(1)} horas sin pingear.`,
                        'Debería hacerlo una vez por día, así que se saltearon corridas.',
                        '',
                        `Ping anterior: ${fecha(pingAnterior)}`,
                        `Ping de ahora: ${fecha(fila?.ultimo_ping)}`,
                        `Corridas totales: ${fila?.corridas}`,
                        '',
                        'Mirá los logs del cron en Vercel. Si el hueco llega a 7 días, Supabase',
                        'pausa el proyecto.'
                    ].join('\n')
                )
            }
        }

        return res.status(200).json({ ok: true, ultimo_ping: fila?.ultimo_ping ?? null })
    } catch (e) {
        await avisarPorMail(
            '⚠️ Keepalive falló — Regionales Mis Nietas',
            [
                'El cron que evita que Supabase pause el proyecto no pudo conectarse.',
                '',
                `Error: ${e.message}`,
                '',
                'Causa más probable: el proyecto de Supabase está pausado o caído.',
                'Entrá a supabase.com/dashboard y fijate si pide restaurarlo.'
            ].join('\n')
        )
        return res.status(500).json({ ok: false, error: e.message })
    }
}
