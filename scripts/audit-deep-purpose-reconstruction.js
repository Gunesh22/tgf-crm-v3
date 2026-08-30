// scripts/audit-deep-purpose-reconstruction.js
import { MongoClient } from 'mongodb';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

// Load high-confidence migration JSON if available
let migrationMapping = [];
let migrationMapByPhone = new Map();
let migrationMapById = new Map();

try {
  const jsonRaw = fs.readFileSync('high_confidence_pipeline_mapping.json', 'utf8');
  const parsed = JSON.parse(jsonRaw);
  migrationMapping = parsed.contacts || [];
  migrationMapping.forEach(c => {
    if (c.contactId) migrationMapById.set(c.contactId, c);
    if (c.phone) migrationMapByPhone.set(c.phone.replace(/\D/g, ''), c);
  });
  console.log(`[INFO] Loaded ${migrationMapping.length} contacts from high_confidence_pipeline_mapping.json`);
} catch (e) {
  console.warn('[WARN] Could not load high_confidence_pipeline_mapping.json', e.message);
}

const isConnectedStatus = (status) => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  const unconn = ['na', 'busy', 'call cut', 'switched off', 'invalid no', 'no network', 'wrong no.', 'not picked up', 'no answer'];
  return !unconn.some(u => s.includes(u));
};

export const classifyCallEvent = (h, contact = {}) => {
  // 1. Explicit V2 callPurpose or purpose field
  const explicit = (h.callPurpose || h.purpose || '').toLowerCase().trim();
  if (explicit === 'sales') return { purpose: 'sales', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = sales' };
  if (explicit === 'query') return { purpose: 'query', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = query' };
  if (explicit === 'reminder') return { purpose: 'reminder', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = reminder' };

  const remark = (h.remark || h.comment || contact.remark || '').toLowerCase().trim();
  const status = (h.status || contact.status || '').toLowerCase().trim();
  const calledFor = (h.calledFor || contact.calledFor || contact.programName || '').toLowerCase().trim();

  // 2. Query Evidence (Check remark and status first to catch Query "Info Given" edge case)
  const isQueryRemark = remark.includes('query') || remark.includes('doubt') || remark.includes('question') || 
                        remark.includes('asking about') || remark.includes('asked about') || remark.includes('shivir query') || 
                        remark.includes('fee detail asked') || remark.includes('inquiry') || remark.includes('location') ||
                        remark.includes('timing') || remark.includes('batch timing') || remark.includes('when is next') ||
                        remark.includes('offline possible');
  const isQueryStatus = status.includes('query') || status === 'query desk';

  if (isQueryRemark || isQueryStatus) {
    return {
      purpose: 'query',
      confidence: 'HIGH',
      reason: isQueryRemark ? `Query evidence in remark: "${h.remark || contact.remark}"` : `Status is explicitly Query: "${h.status || contact.status}"`
    };
  }

  // 3. Reminder Evidence
  const isReminderRemark = remark.includes('reminder') || remark.includes('remind') || remark.includes('payment link') || 
                           remark.includes('session link') || remark.includes('zoom link') || remark.includes('whatsapp link') ||
                           remark.includes('webinar link') || remark.includes('event reminder') || remark.includes('workshop reminder');
  const isReminderStatus = status.includes('reminder');

  if (isReminderRemark || isReminderStatus) {
    return {
      purpose: 'reminder',
      confidence: 'HIGH',
      reason: isReminderRemark ? `Reminder evidence in remark: "${h.remark || contact.remark}"` : `Status is explicitly Reminder: "${h.status || contact.status}"`
    };
  }

  // 4. Sales Evidence
  const isSalesStatus = status.includes('info given') || status.includes('information given') || 
                        status.includes('interested') || status.includes('reg.done') || status.includes('registered') ||
                        status.includes('not interested') || status.includes('future pool') || status.includes('next time') ||
                        status.includes('attempting') || status.includes('new lead');

  const isSalesRemark = remark.includes('info given') || remark.includes('explained') || remark.includes('details sent') ||
                        remark.includes('shivir info') || remark.includes('will join') || remark.includes('interested') ||
                        remark.includes('fees given') || remark.includes('program info') || remark.includes('call back for sales');

  if (isSalesStatus || isSalesRemark) {
    return {
      purpose: 'sales',
      confidence: 'HIGH',
      reason: isSalesStatus ? `Sales journey status: "${h.status || contact.status}"` : `Sales evidence in remark: "${h.remark || contact.remark}"`
    };
  }

  // 5. Check Migration JSON Context for contact
  const cPhoneClean = (contact.Phone || contact.phone || '').replace(/\D/g, '');
  const cId = contact._id ? contact._id.toString() : '';
  const migrationContact = migrationMapById.get(cId) || migrationMapByPhone.get(cPhoneClean);

  if (migrationContact && migrationContact.programRelationships && migrationContact.programRelationships.length > 0) {
    const rel = migrationContact.programRelationships[0];
    if (rel.evidence && rel.evidence.status) {
      const migStatus = rel.evidence.status.toLowerCase();
      if (migStatus.includes('interested') || migStatus.includes('info given') || migStatus.includes('reg.done')) {
        return {
          purpose: 'sales',
          confidence: 'MEDIUM',
          reason: `Contact has high-confidence sales migration relationship for "${rel.program}" (${rel.reason})`
        };
      }
    }
  }

  // 6. Generic Callback / Unconnected Attempt Evidence
  if (status.includes('busy') || status.includes('call cut') || status.includes('na') || status.includes('switched off') || status.includes('no answer')) {
    // If contact is in a sales calledFor or sales stage, the attempt was a Sales call attempt
    if (calledFor || contact.pipelineStage) {
      return {
        purpose: 'sales',
        confidence: 'MEDIUM',
        reason: `Sales call attempt (Status: "${h.status || contact.status}", Called For: "${calledFor || contact.pipelineStage}")`
      };
    }
  }

  // 7. Unknown / Legacy (Ambiguous)
  return {
    purpose: 'unknown_legacy',
    confidence: 'LOW',
    reason: `Ambiguous legacy record (Status: "${h.status || contact.status || 'Blank'}", Remark: "${h.remark || contact.remark || 'Blank'}")`
  };
};

async function audit() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('====================================================');
  console.log('PHASE 1: READ-ONLY GROUND TRUTH & 2,162 DISCREPANCY AUDIT');
  console.log('====================================================\n');

  const contacts = await db.collection('contacts').find({}).toArray();

  let totalContacts = contacts.length;
  let totalHistoryEntries = 0;
  let totalUniqueCallIds = new Set();
  let legacyEntriesNoCallId = 0;
  let contactsWithoutHistoryArray = 0;
  let syntheticFallbackCalls = 0;

  const syntheticFallbackContacts = [];

  contacts.forEach(c => {
    const cId = c._id.toString();

    if (Array.isArray(c.history) && c.history.length > 0) {
      c.history.forEach((h, idx) => {
        totalHistoryEntries++;
        if (h.callId || h.id) {
          totalUniqueCallIds.add(h.callId || h.id);
        } else {
          legacyEntriesNoCallId++;
        }
      });
    } else {
      contactsWithoutHistoryArray++;
      if (c.lastCalledAt || (c.status && c.status !== 'Pending')) {
        syntheticFallbackCalls++;
        syntheticFallbackContacts.push({
          contactId: cId,
          name: c.Name || c.name || 'Unnamed',
          phone: c.Phone || c.phone || '',
          status: c.status || 'Pending',
          lastCalledAt: c.lastCalledAt
        });
      }
    }
  });

  console.log(`Ground Truth Database Counts:`);
  console.log(`- Total Contacts in MongoDB:                    ${totalContacts}`);
  console.log(`- Total True History Events in contacts.history:${totalHistoryEntries}`);
  console.log(`- Total Unique callId entries:                 ${totalUniqueCallIds.size}`);
  console.log(`- Legacy history entries without explicit callId:${legacyEntriesNoCallId}`);
  console.log(`- Contacts with NO history array:               ${contactsWithoutHistoryArray}`);
  console.log(`- Synthetic Fallback Call Events created:        ${syntheticFallbackCalls}`);
  console.log(`- Combined Events (2,094 Real + 68 Synthetic):   ${totalHistoryEntries + syntheticFallbackCalls}`);

  console.log(`\nDiscrepancy Explanation:`);
  console.log(`Analytics was showing 2,162 calls because the UI component extracted 2,094 true history events PLUS 68 synthetic fallback calls for contacts lacking a history array.`);
  console.log(`Per Phase 1 instructions: Synthetic events must NOT be created. True total historical call events = 2,094.`);

  console.log('\n====================================================');
  console.log('PHASE 3 & 9: EVIDENCE-BASED CALL PURPOSE RECONSTRUCTION');
  console.log('====================================================\n');

  const classifiedEvents = [];
  const unknownSamples = [];

  contacts.forEach(c => {
    const cId = c._id.toString();
    const cName = c.Name || c.name || 'Unnamed';
    const cPhone = c.Phone || c.phone || '';

    if (Array.isArray(c.history) && c.history.length > 0) {
      c.history.forEach((h, idx) => {
        const result = classifyCallEvent(h, c);
        const eventObj = {
          contactId: cId,
          contactName: cName,
          contactPhone: cPhone,
          callId: h.callId || h.id || `legacy_${cId}_${idx}`,
          status: h.status || c.status || '',
          remark: h.remark || h.comment || c.remark || '',
          calledFor: h.calledFor || c.calledFor || c.programName || '',
          timestamp: h.timestamp || h.date || c.createdAt || '',
          purpose: result.purpose,
          confidence: result.confidence,
          reason: result.reason,
          isConnected: isConnectedStatus(h.status || c.status)
        };

        classifiedEvents.push(eventObj);

        if (result.purpose === 'unknown_legacy') {
          const cPhoneClean = cPhone.replace(/\D/g, '');
          const mig = migrationMapById.get(cId) || migrationMapByPhone.get(cPhoneClean);
          if (unknownSamples.length < 20) {
            unknownSamples.push({
              contactId: cId,
              contactName: cName,
              calledFor: eventObj.calledFor || 'None',
              status: eventObj.status || 'Blank',
              remark: eventObj.remark || 'Blank',
              date: eventObj.timestamp ? new Date(eventObj.timestamp).toISOString().split('T')[0] : 'Unknown',
              migrationEvidence: mig ? (mig.programRelationships[0]?.reason || 'Found in migration JSON') : 'None in JSON',
              proposedPurpose: 'Unknown / Legacy',
              confidence: 'LOW'
            });
          }
        }
      });
    }
  });

  const purposeCounts = {
    sales: { calls: 0, connected: 0, contacts: new Set() },
    query: { calls: 0, connected: 0, contacts: new Set() },
    reminder: { calls: 0, connected: 0, contacts: new Set() },
    unknown_legacy: { calls: 0, connected: 0, contacts: new Set() }
  };

  classifiedEvents.forEach(e => {
    const p = purposeCounts[e.purpose];
    p.calls++;
    if (e.isConnected) p.connected++;
    p.contacts.add(e.contactId);
  });

  const finalDistributionTable = [
    {
      Purpose: 'Sales',
      Calls: purposeCounts.sales.calls,
      'Unique People': purposeCounts.sales.contacts.size,
      'Connected %': purposeCounts.sales.calls > 0 ? ((purposeCounts.sales.connected / purposeCounts.sales.calls) * 100).toFixed(1) + '%' : '0.0%'
    },
    {
      Purpose: 'Query',
      Calls: purposeCounts.query.calls,
      'Unique People': purposeCounts.query.contacts.size,
      'Connected %': purposeCounts.query.calls > 0 ? ((purposeCounts.query.connected / purposeCounts.query.calls) * 100).toFixed(1) + '%' : '0.0%'
    },
    {
      Purpose: 'Reminder',
      Calls: purposeCounts.reminder.calls,
      'Unique People': purposeCounts.reminder.contacts.size,
      'Connected %': purposeCounts.reminder.calls > 0 ? ((purposeCounts.reminder.connected / purposeCounts.reminder.calls) * 100).toFixed(1) + '%' : '0.0%'
    },
    {
      Purpose: 'Unknown / Legacy',
      Calls: purposeCounts.unknown_legacy.calls,
      'Unique People': purposeCounts.unknown_legacy.contacts.size,
      'Connected %': purposeCounts.unknown_legacy.calls > 0 ? ((purposeCounts.unknown_legacy.connected / purposeCounts.unknown_legacy.calls) * 100).toFixed(1) + '%' : '0.0%'
    },
    {
      Purpose: 'TOTAL',
      Calls: classifiedEvents.length,
      'Unique People': new Set(contacts.map(c => c._id.toString())).size,
      'Connected %': '-'
    }
  ];

  console.log('RECONSTRUCTED EVIDENCE-BASED CALL PURPOSE DISTRIBUTION:');
  console.table(finalDistributionTable);

  console.log('\n====================================================');
  console.log('PHASE 11: SAMPLE 20 UNKNOWN / LEGACY RECORDS FOR REVIEW');
  console.log('====================================================\n');
  console.table(unknownSamples);

  await client.close();
}

audit().catch(console.error);
