/**
 * Debug endpoint to check user auth context
 * Restricted to admin role only.
 */

import { requireAuth } from '../lib/auth.js';

async function debugUser(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

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
