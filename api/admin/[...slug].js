// api/admin/[...slug].js
import statsHandler from '../_admin/stats.js';
import attendersHandler from '../_admin/attenders.js';
import programsHandler from '../_admin/programs.js';
import reassignHandler from '../_admin/reassign.js';
import settingsHandler from '../_admin/settings.js';
import adminAuthHandler from '../_admin/admin-auth.js';

const handlers = {
  'stats': statsHandler,
  'attenders': attendersHandler,
  'programs': programsHandler,
  'reassign': reassignHandler,
  'settings': settingsHandler,
  'admin-auth': adminAuthHandler
};

export default async function handler(req, res) {
  const { slug } = req.query;
  const route = Array.isArray(slug) ? slug[0] : (slug || req.url.split('?')[0].split('/').pop());

  const targetHandler = handlers[route];
  if (targetHandler) {
    return targetHandler(req, res);
  }

  return res.status(404).json({ error: `Route /api/admin/${route} not found` });
}
