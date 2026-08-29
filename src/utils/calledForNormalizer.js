/**
 * Central Canonical Called-For Normalizer
 * Enforces UNIQUE(contactId + calledForKey) across:
 * - Registration creation
 * - Duplicate detection
 * - MongoDB compound index matching
 * - Admin analytics reporting
 */
export function normalizeCalledForKey(calledFor) {
  if (!calledFor || typeof calledFor !== 'string') return 'general';
  const trimmed = calledFor.trim().toLowerCase();
  if (!trimmed) return 'general';
  return trimmed.replace(/[\s_-]+/g, '-');
}

export function isMeaningfulRemarkChange(oldRemark, newRemark) {
  const normOld = String(oldRemark || '').trim();
  const normNew = String(newRemark || '').trim();
  return normOld !== normNew;
}
