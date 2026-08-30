// scripts/review-190-unknown-events.js
import { MongoClient } from 'mongodb';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

// Load high-confidence migration JSON
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
} catch (e) {
  console.warn('[WARN] Could not load high_confidence_pipeline_mapping.json', e.message);
}

const isConnectedStatus = (status) => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  const unconn = ['na', 'busy', 'call cut', 'switched off', 'invalid no', 'no network', 'wrong no.', 'not picked up', 'no answer'];
  return !unconn.some(u => s.includes(u));
};

// Initial Classification Function
export const classifyInitial = (h, contact = {}) => {
  const explicit = (h.callPurpose || h.purpose || '').toLowerCase().trim();
  if (explicit === 'sales') return { purpose: 'sales', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = sales' };
  if (explicit === 'query') return { purpose: 'query', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = query' };
  if (explicit === 'reminder') return { purpose: 'reminder', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = reminder' };

  const remark = (h.remark || h.comment || contact.remark || '').toLowerCase().trim();
  const status = (h.status || contact.status || '').toLowerCase().trim();

  // 1. Query Evidence
  const isQueryRemark = remark.includes('query') || remark.includes('doubt') || remark.includes('question') || 
                        remark.includes('asking about') || remark.includes('asked about') || remark.includes('shivir query') || 
                        remark.includes('fee detail asked') || remark.includes('inquiry') || remark.includes('location') ||
                        remark.includes('timing') || remark.includes('batch timing') || remark.includes('when is next') ||
                        remark.includes('offline possible');
  const isQueryStatus = status.includes('query') || status === 'query desk';
  if (isQueryRemark || isQueryStatus) {
    return { purpose: 'query', confidence: 'HIGH', reason: isQueryRemark ? 'Query evidence in remark' : 'Status is explicitly Query' };
  }

  // 2. Reminder Evidence
  const isReminderRemark = remark.includes('reminder') || remark.includes('remind') || remark.includes('payment link') || 
                           remark.includes('session link') || remark.includes('zoom link') || remark.includes('whatsapp link') ||
                           remark.includes('webinar link') || remark.includes('event reminder') || remark.includes('workshop reminder');
  const isReminderStatus = status.includes('reminder');
  if (isReminderRemark || isReminderStatus) {
    return { purpose: 'reminder', confidence: 'HIGH', reason: isReminderRemark ? 'Reminder evidence in remark' : 'Status is explicitly Reminder' };
  }

  // 3. High-Confidence Sales Evidence
  const isSalesStatus = status.includes('info given') || status.includes('information given') || 
                        status.includes('interested') || status.includes('reg.done') || status.includes('registered') ||
                        status.includes('not interested') || status.includes('future pool') || status.includes('next time') ||
                        status.includes('attempting') || status.includes('new lead');
  const isSalesRemark = remark.includes('info given') || remark.includes('explained') || remark.includes('details sent') ||
                        remark.includes('shivir info') || remark.includes('will join') || remark.includes('interested') ||
                        remark.includes('fees given') || remark.includes('program info') || remark.includes('call back for sales');
  if (isSalesStatus || isSalesRemark) {
    return { purpose: 'sales', confidence: 'HIGH', reason: isSalesStatus ? `Sales journey status: "${h.status || contact.status}"` : 'Sales evidence in remark' };
  }

  // 4. Migration JSON Context
  const cPhoneClean = (contact.Phone || contact.phone || '').replace(/\D/g, '');
  const cId = contact._id ? contact._id.toString() : '';
  const migrationContact = migrationMapById.get(cId) || migrationMapByPhone.get(cPhoneClean);
  if (migrationContact && migrationContact.programRelationships && migrationContact.programRelationships.length > 0) {
    const rel = migrationContact.programRelationships[0];
    if (rel.evidence && rel.evidence.status) {
      const migStatus = rel.evidence.status.toLowerCase();
      if (migStatus.includes('interested') || migStatus.includes('info given') || migStatus.includes('reg.done')) {
        return { purpose: 'sales', confidence: 'MEDIUM', reason: `High-confidence sales migration relationship for "${rel.program}"` };
      }
    }
  }

  // 5. Generic Unconnected Attempt with Program Context
  const calledFor = (h.calledFor || contact.calledFor || contact.programName || '').toLowerCase().trim();
  if (status.includes('busy') || status.includes('call cut') || status.includes('na') || status.includes('switched off') || status.includes('no answer')) {
    if (calledFor || contact.pipelineStage) {
      return { purpose: 'sales', confidence: 'MEDIUM', reason: `Sales call attempt (Status: "${h.status || contact.status}")` };
    }
  }

  return { purpose: 'unknown_legacy', confidence: 'LOW', reason: 'Ambiguous legacy record' };
};

// Enhanced Secondary Pass specifically for the 190 Unknown / Legacy Events
export const reviewUnknownEvent = (h, contact, historyIndex, migEvidence) => {
  const remark = (h.remark || h.comment || contact.remark || '').toLowerCase().trim();
  const status = (h.status || contact.status || '').toLowerCase().trim();
  const calledFor = (h.calledFor || contact.calledFor || contact.programName || '').toLowerCase().trim();

  // A. Check for "Called by mistake" / accidental / test entry → Truly Unknown
  if (remark.includes('called by mistake') || remark.includes('by mistake') || status.includes('called by mistake')) {
    return {
      proposedPurpose: 'unknown_legacy',
      confidence: 'LOW',
      reason: 'Accidental call / Called by mistake'
    };
  }

  // B. Check for Sales Journey & Program Batch Evidence in Remark/Status
  const salesKeywords = [
    'next batch', 'added in', 'batch', 'group', 'program', 'not attended', 'link send', 
    'link sent', 'not possible to attend', 'next program', 'basic program', 'shivir',
    'future', 'postpone', 'august', 'july', 'september', 'october', 'reg.d', 'already reg'
  ];

  const hasSalesKeyword = salesKeywords.some(k => remark.includes(k) || status.includes(k));
  
  if (hasSalesKeyword) {
    return {
      proposedPurpose: 'sales',
      confidence: 'MEDIUM',
      reason: `Program batch / sales follow-up notes in remark/status: "${h.remark || contact.remark || h.status || contact.status}"`
    };
  }

  // C. Check for Call Attempt / Connection Failure in Program Context (e.g., "number not connected", "Invalid No", "No Network", "Call Log Added")
  const isCallAttemptStatus = status.includes('not attended') || status.includes('no network') || 
                              status.includes('invalid no') || status.includes('call log added') || 
                              status.includes('not possible') || status.includes('already reg');

  const isCallAttemptRemark = remark.includes('not connected') || remark.includes('call not received') || 
                              remark.includes('incoming call') || remark.includes('number not available');

  if ((isCallAttemptStatus || isCallAttemptRemark) && (calledFor || contact.pipelineStage || migEvidence !== 'None')) {
    return {
      proposedPurpose: 'sales',
      confidence: 'MEDIUM',
      reason: `Sales outreach / program call attempt (Status: "${h.status || contact.status || 'Blank'}", Program: "${calledFor || 'Known Program'}")`
    };
  }

  // D. Check for Query / Reminder secondary signals
  if (remark.includes('fee') || remark.includes('amount') || remark.includes('price') || remark.includes('cost') || remark.includes('bus ki suvidha') || remark.includes('suvidha')) {
    return {
      proposedPurpose: 'query',
      confidence: 'HIGH',
      reason: `Query indicator in remark: "${h.remark || contact.remark}"`
    };
  }

  if (remark.includes('registration done') || remark.includes('reg.done') || remark.includes('registered')) {
    return {
      proposedPurpose: 'sales',
      confidence: 'HIGH',
      reason: `Registration completion sales event: "${h.remark || contact.remark}"`
    };
  }

  if (remark.includes('link') || remark.includes('zoom') || remark.includes('passcode')) {
    return {
      proposedPurpose: 'reminder',
      confidence: 'HIGH',
      reason: `Session link / passcode reminder in remark: "${h.remark || contact.remark}"`
    };
  }

  // E. Genuinely Ambiguous (Blank remark, blank status, no program context)
  return {
    proposedPurpose: 'unknown_legacy',
    confidence: 'LOW',
    reason: `Genuinely ambiguous legacy event with no program or remark context (Status: "${h.status || 'Blank'}", Remark: "${h.remark || 'Blank'}")`
  };
};

async function audit190() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('====================================================');
  console.log('PHASE 11: FULL EVIDENCE REVIEW OVER 190 UNKNOWN EVENTS');
  console.log('====================================================\n');

  const contacts = await db.collection('contacts').find({}).toArray();

  const allEvents = [];
  const unknownList = [];

  contacts.forEach(contact => {
    const cId = contact._id.toString();
    const cName = contact.Name || contact.name || 'Unnamed';
    const cPhone = contact.Phone || contact.phone || '';
    const cPhoneClean = cPhone.replace(/\D/g, '');

    const mig = migrationMapById.get(cId) || migrationMapByPhone.get(cPhoneClean);
    const migEvidenceStr = mig ? (mig.programRelationships[0]?.reason || 'Found in migration JSON') : 'None';

    if (Array.isArray(contact.history) && contact.history.length > 0) {
      contact.history.forEach((h, idx) => {
        const initialRes = classifyInitial(h, contact);

        const eventRecord = {
          contactId: cId,
          contactName: cName,
          historyIndex: idx,
          date: h.timestamp || h.date || contact.createdAt || 'Unknown',
          dateStr: (h.timestamp || h.date || contact.createdAt) ? new Date(h.timestamp || h.date || contact.createdAt).toISOString().split('T')[0] : 'Unknown',
          calledFor: h.calledFor || contact.calledFor || contact.programName || 'Blank',
          status: h.status || contact.status || 'Blank',
          remark: h.remark || h.comment || contact.remark || 'Blank',
          migrationEvidence: migEvidenceStr,
          initialPurpose: initialRes.purpose,
          initialConfidence: initialRes.confidence,
          initialReason: initialRes.reason,
          finalPurpose: initialRes.purpose,
          finalConfidence: initialRes.confidence,
          finalReason: initialRes.reason
        };

        if (initialRes.purpose === 'unknown_legacy') {
          const reviewRes = reviewUnknownEvent(h, contact, idx, migEvidenceStr);
          eventRecord.finalPurpose = reviewRes.proposedPurpose;
          eventRecord.finalConfidence = reviewRes.confidence;
          eventRecord.finalReason = reviewRes.reason;
          unknownList.push(eventRecord);
        }

        allEvents.push(eventRecord);
      });
    }
  });

  console.log(`Identified ${unknownList.length} initial Unknown events out of ${allEvents.length} total events.\n`);

  // Write the itemized review of all 190 unknown events to a JSON / report file for full transparency
  fs.writeFileSync('itemized_190_unknown_review.json', JSON.stringify(unknownList, null, 2));
  console.log(`[INFO] Wrote complete itemized review of all 190 Unknown events to itemized_190_unknown_review.json`);

  // Print sample 25 items from the 190 review table
  console.log('\n--- ITEMIZED SAMPLE OF THE 190 REVIEWED EVENTS ---');
  const tableOutput = unknownList.slice(0, 25).map(e => ({
    contactId: e.contactId,
    idx: e.historyIndex,
    date: e.dateStr,
    calledFor: e.calledFor,
    status: e.status,
    remark: e.remark.length > 30 ? e.remark.slice(0, 27) + '...' : e.remark,
    migEvidence: e.migrationEvidence.length > 25 ? e.migrationEvidence.slice(0, 22) + '...' : e.migrationEvidence,
    proposedPurpose: e.finalPurpose,
    confidence: e.finalConfidence
  }));
  console.table(tableOutput);

  // Compute final 5-way breakdown across all 2,094 events
  let highSales = 0;
  let medSales = 0;
  let highQuery = 0;
  let medQuery = 0;
  let highReminder = 0;
  let medReminder = 0;
  let remainingUnknown = 0;

  allEvents.forEach(e => {
    if (e.finalPurpose === 'sales') {
      if (e.finalConfidence === 'HIGH') highSales++;
      else medSales++;
    } else if (e.finalPurpose === 'query') {
      if (e.finalConfidence === 'HIGH') highQuery++;
      else medQuery++;
    } else if (e.finalPurpose === 'reminder') {
      if (e.finalConfidence === 'HIGH') highReminder++;
      else medReminder++;
    } else {
      remainingUnknown++;
    }
  });

  const grandTotal = highSales + medSales + highQuery + medQuery + highReminder + medReminder + remainingUnknown;

  console.log('\n====================================================');
  console.log('FINAL 5-WAY BREAKDOWN ACROSS ALL 2,094 EVENTS');
  console.log('====================================================\n');

  const summaryTable = [
    { Category: 'HIGH-confidence Sales', Count: highSales },
    { Category: 'MEDIUM-confidence Sales', Count: medSales },
    { Category: 'HIGH-confidence Query', Count: highQuery },
    { Category: 'MEDIUM-confidence Query', Count: medQuery },
    { Category: 'HIGH-confidence Reminder', Count: highReminder },
    { Category: 'MEDIUM-confidence Reminder', Count: medReminder },
    { Category: 'Remaining Genuinely Unknown', Count: remainingUnknown },
    { Category: 'TOTAL HISTORICAL EVENTS', Count: grandTotal }
  ];

  console.table(summaryTable);
  console.log(`\nPARITY CHECK: HIGH Sales (${highSales}) + MED Sales (${medSales}) + HIGH Query (${highQuery}) + MED Query (${medQuery}) + HIGH Reminder (${highReminder}) + MED Reminder (${medReminder}) + Unknown (${remainingUnknown}) = ${grandTotal}`);
  console.log(`Target = 2,094. Parity Satisfied: ${grandTotal === 2094 ? 'YES ✅' : 'NO ❌'}`);

  await client.close();
}

audit190().catch(console.error);
