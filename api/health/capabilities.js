/**
 * /api/health/capabilities
 * Aggregates a few probes into one response for tooling/ops.
 * Works in Vite dev + Vercel-style environments.
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
  // Prefer service role for health probes; fall back to anon if needed.
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  );
}

async function probeColumn({ supabaseUrl, key, table, column }) {
  const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(
    column
  )}&limit=1`;
  const r = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  // PostgREST returns 400 for missing column; treat that as false.
  return r.ok;
}

async function probeVendorRelationship({ supabaseUrl, key }) {
  // Relationship probe (job_parts -> vendors)
  const url = `${supabaseUrl}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1`;
  const r = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return { ok: false, status: r.status, error: txt.slice(0, 300) };
  }
  const data = await r.json().catch(() => null);
  const rows = Array.isArray(data) ? data.length : 0;
  // We can’t reliably infer FK name here without SQL; this is enough for capability gating.
  return { ok: true, restQueryOk: true, rowsChecked: rows };
}

async function handler(req, res) {
  const t0 = Date.now();
  try {
    const supabaseUrl = envUrl();
    const key = envKey();

    if (!supabaseUrl) {
      return sendJson(res, 500, {
        ok: false,
        error: "Missing SUPABASE_URL/VITE_SUPABASE_URL",
        ms: Date.now() - t0,
      });
    }
    if (!key) {
      return sendJson(res, 500, {
        ok: false,
        error: "Missing SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY fallback)",
        ms: Date.now() - t0,
      });
    }

    // Basic reachability check
    const ping = await fetch(`${supabaseUrl}/rest/v1/`, { method: "GET" });
    const db = !!ping && typeof ping.status === "number";

    const vendorRelationship = await probeVendorRelationship({ supabaseUrl, key });

    // Probe user_profiles columns (matches your health-user-profiles shape)
    const columns = {
      name: await probeColumn({ supabaseUrl, key, table: "user_profiles", column: "name" }),
      full_name: await probeColumn({ supabaseUrl, key, table: "user_profiles", column: "full_name" }),
      display_name: await probeColumn({ supabaseUrl, key, table: "user_profiles", column: "display_name" }),
    };

    // Job parts scheduling time columns (best-effort, used by optional check)
    const jobPartsTimes = {
      scheduled_start_time: await probeColumn({ supabaseUrl, key, table: "job_parts", column: "scheduled_start_time" }),
      scheduled_end_time: await probeColumn({ supabaseUrl, key, table: "job_parts", column: "scheduled_end_time" }),
    };

    const out = {
      ok: true,
      db,
      capabilities: {
        vendorRelationship,
        userProfiles: { columns },
        jobPartsTimes: { columns: jobPartsTimes },
      },
      probeResults: {
        checks: {
          vendorRelationship: vendorRelationship.ok === true,
          userProfiles: true,
          jobPartsTimes: true,
        },
      },
      ms: Date.now() - t0,
    };

    return sendJson(res, 200, out);
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: String(e?.message || e),
      ms: Date.now() - t0,
    });
  }
}

// Compatibility: Vite router may import default; CJS import() may also treat module.exports as default.
module.exports = handler;
module.exports.default = handler;
