const sendJson = (res, status, data) => {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

const envUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const envKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

const probe = async (supabaseUrl, key, column) => {
  const url = supabaseUrl + '/rest/v1/job_parts?select=' + encodeURIComponent(column) + '&limit=1'
  const r = await fetch(url, {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
  })
  return r.ok
}

export default async function handler(req, res) {
  const t0 = Date.now()
  try {
    const supabaseUrl = envUrl()
    const key = envKey()
    if (!supabaseUrl || !key)
      return sendJson(res, 500, {
        ok: false,
        error:
          'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY',
        ms: Date.now() - t0,
      })
    const columns = {
      scheduled_start_time: await probe(supabaseUrl, key, 'scheduled_start_time'),
      scheduled_end_time: await probe(supabaseUrl, key, 'scheduled_end_time'),
    }
    return sendJson(res, 200, { ok: true, columns, ms: Date.now() - t0 })
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String(e?.message || e), ms: Date.now() - t0 })
  }
}
