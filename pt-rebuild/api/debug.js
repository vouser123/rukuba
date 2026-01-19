/**
 * Debug endpoint to check user auth context
 */

import { requireAuth } from '../lib/auth.js';

async function debugUser(req, res) {
  return res.status(200).json({
    user: req.user,
    accessToken: req.accessToken ? 'present' : 'missing'
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return requireAuth(debugUser)(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
