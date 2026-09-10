// src/lib/fieldSchema.js
/**
 * Canonical Field-Name Schema & Accessor Utilities for TGF CRM
 * 
 * Enforces single canonical field names across the application,
 * eliminating case inconsistencies and redundant multi-key writes.
 */

export const CONTACT_FIELDS = Object.freeze({
  NAME: 'Name',
  PHONE: 'Phone',
  MOBILE: 'Mobile',
  EMAIL: 'Email',
  CITY: 'City',
  STATE: 'State',
  KHOJI: 'Khoji',
  TAGS: 'Tags',
  CALLED_FOR: 'calledFor',
  SOURCE: 'source',
  LEAD_ORIGIN: 'leadOrigin',
  STATUS: 'status',
  PIPELINE_STAGE: 'pipelineStage',
  CALL_PURPOSE: 'callPurpose',
  CALL_TYPE: 'callType',
  CALL_STATUS: 'callStatus',
  REMARK: 'remark',
  CALLBACK_DATE: 'callbackDate',
  CALLBACK_TIME: 'callbackTime',
  NORMALIZED_PHONE: 'normalizedPhone',
  NORMALIZED_MOBILE: 'normalizedMobile',
  ATTEMPT_COUNT: 'attemptCount',
  ATTENDER_ID: 'attenderId',
  ATTENDER_NAME: 'attenderName',
  PROGRAM_ID: 'programId',
  PROGRAM_NAME: 'programName',
  PREVIOUS_PROGRAM: 'previousProgram',
  HISTORY: 'history',
  ATTENDER_STATES: 'attenderStates',
  PROGRAM_STATES: 'programStates',
  PROGRAM_RELATIONSHIPS: 'programRelationships',
  ASSIGNED_TO: 'assignedTo',
  LEAD_OWNER: 'leadOwner',
  LEAD_OWNER_NAME: 'leadOwnerName'
});

/**
 * Clean canonical field accessors with backward-compatible legacy fallback
 * for existing unmigrated database documents.
 */
export const getFieldCity = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.CITY] || record.city || record.location || record['Khoji City'] || '').trim();
};

export const getFieldState = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.STATE] || record.state || '').trim();
};

export const getFieldCalledFor = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.CALLED_FOR] || record['Called For'] || record.called_for || record.programName || '').trim();
};

export const getFieldSource = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.SOURCE] || record.Source || record.currentSource || record.sourse || '').trim();
};

export const getFieldLeadOrigin = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.LEAD_ORIGIN] || record.original_source || record.originalSource || record['Lead Origin'] || '').trim();
};

export const getFieldName = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.NAME] || record.name || record.leadName || record['Lead Name'] || record['Full Name'] || '').trim();
};

export const getFieldPhone = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.PHONE] || record.phone || record.contactPhone || record.Mobile || record.mobile || '').trim();
};

export const getFieldKhoji = (record) => {
  if (!record || typeof record !== 'object') return '';
  return String(record[CONTACT_FIELDS.KHOJI] || record.khoji || record['Khoji Type'] || '').trim();
};
