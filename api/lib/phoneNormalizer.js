import { ObjectId } from 'mongodb';

export function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

export function extractLast10(phone) {
  const clean = normalizePhone(phone);
  if (clean.length < 10) return clean;
  return clean.slice(-10);
}

export function buildPhoneDuplicateFilter(phoneStr, mobileStr, excludeId = null) {
  const clauses = [];

  const addClausesFor = (val) => {
    if (!val) return;
    const clean = normalizePhone(val);
    if (clean.length < 10) return;
    const last10 = clean.slice(-10);

    const variations = Array.from(new Set([
      last10,
      clean,
      `91${last10}`,
      `+91${last10}`,
      `0${last10}`
    ]));
    const regex = new RegExp(last10, 'i');

    clauses.push(
      { normalizedPhone: { $in: variations } },
      { phone: { $in: variations } },
      { Phone: { $in: variations } },
      { mobile: { $in: variations } },
      { Mobile: { $in: variations } },
      { normalizedMobile: { $in: variations } },
      { Phone: regex },
      { phone: regex },
      { Mobile: regex },
      { mobile: regex },
      { normalizedPhone: regex }
    );
  };

  addClausesFor(phoneStr);
  addClausesFor(mobileStr);

  if (clauses.length === 0) return null;

  const filter = { $or: clauses };

  if (excludeId) {
    const excludeObjectIds = [];
    try {
      if (ObjectId.isValid(excludeId)) {
        excludeObjectIds.push(new ObjectId(excludeId));
      }
    } catch (e) {}
    excludeObjectIds.push(excludeId);

    filter._id = { $nin: excludeObjectIds };
    filter.id = { $ne: excludeId };
  }

  return filter;
}
