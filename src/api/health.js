// /api/health (server route) 
import { pingSupabase } from '../services/healthService';

export default async function handler(req, res) {
  try {
    const { ok } = await pingSupabase();
    res?.status(200)?.json({ ok: true, db: ok });
  } catch (error) {
    res?.status(500)?.json({ ok: false, db: false, error: error?.message });
  }
}