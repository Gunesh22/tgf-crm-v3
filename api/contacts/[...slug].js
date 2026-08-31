// api/contacts/[...slug].js
import searchHandler from '../_contacts/search.js';
import getAssignedHandler from '../_contacts/get-assigned.js';
import getSingleHandler from '../_contacts/get-single.js';
import logCallHandler from '../_contacts/log-call.js';
import undoCallHandler from '../_contacts/undo-call.js';
import checkDuplicateHandler from '../_contacts/check-duplicate.js';
import createIncomingHandler from '../_contacts/create-incoming.js';
import importBulkHandler from '../_contacts/import-bulk.js';
import overrideStageHandler from '../_contacts/override-stage.js';

const handlers = {
  'search': searchHandler,
  'get-assigned': getAssignedHandler,
  'get-single': getSingleHandler,
  'log-call': logCallHandler,
  'undo-call': undoCallHandler,
  'check-duplicate': checkDuplicateHandler,
  'create-incoming': createIncomingHandler,
  'import-bulk': importBulkHandler,
  'override-stage': overrideStageHandler
};

export default async function handler(req, res) {
  const { slug } = req.query;
  const route = Array.isArray(slug) ? slug[0] : (slug || req.url.split('?')[0].split('/').pop());

  const targetHandler = handlers[route];
  if (targetHandler) {
    return targetHandler(req, res);
  }

  return res.status(404).json({ error: `Route /api/contacts/${route} not found` });
}
