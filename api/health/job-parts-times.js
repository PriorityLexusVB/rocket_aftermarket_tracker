/**
 * /api/health/job-parts-times
 * Probes whether scheduling columns exist on job_parts.
 */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  if (res && typeof res.status === "function" && typeof res.json === "function") {
    return res.status(status).json(obj);
  }
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function envUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
}
function envKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

async function probe(supabaseUrl, key, column) {
  const url = `${supabaseUrl}/rest/v1/job_parts?select=${encodeURIComponent(column)}&limit=1`;
  const r = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  return r.ok;
}
