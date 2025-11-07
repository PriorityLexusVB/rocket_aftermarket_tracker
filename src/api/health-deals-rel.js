// /api/health/deals-rel
// Purpose: Validate critical deals-related nested relationships (jobs -> job_parts -> vendors)
// Returns JSON status indicating whether the vendor relationship is operational.
// This helps quickly detect PostgREST schema cache drift or missing FK constraints.

import { supabase } from '@/lib/supabase'

function isMissingRelationshipError(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  return msg.includes('could not find a relationship') || msg.includes('schema cache')
}

export default async function handler(req, res) {
  const started = Date.now()
  try {
    // Probe a lightweight nested select; limit 1 keeps it cheap.
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_parts(id, vendor_id, vendor:vendor_id(id, name))')
      .limit(1)

    if (error) {
      if (isMissingRelationshipError(error)) {
        return res?.status(200)?.json({
          ok: false,
          relationship: false,
          // Provide actionable guidance for operators.
          error: 'Missing jobs → job_parts or job_parts → vendors relationship in schema cache',
          advice:
            'Run verify-schema-cache.sh then apply vendor_id FK migration or NOTIFY pgrst, "reload schema"',
          ms: Date.now() - started,
        })
      }
      return res
        ?.status(500)
        ?.json({ ok: false, relationship: false, error: error?.message, ms: Date.now() - started })
    }

    // Heuristic: if we got data (even empty array) without relationship error, relationship is functional.
    return res?.status(200)?.json({
      ok: true,
      relationship: true,
      rowsChecked: data?.length ?? 0,
      ms: Date.now() - started,
    })
  } catch (error) {
    return res
      ?.status(500)
      ?.json({ ok: false, relationship: false, error: error?.message, ms: Date.now() - started })
  }
}
