// scripts/print-clean-audit.js
import { MongoClient } from 'mongodb';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

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
} catch (e) {}

const isConnectedStatus = (status) => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  const unconn = ['na', 'busy', 'call cut', 'switched off', 'invalid no', 'no network', 'wrong no.', 'not picked up', 'no answer'];
  return !unconn.some(u => s.includes(u));
};

export const classifyCallEvent = (h, contact = {}) => {
  const explicit = (h.callPurpose || h.purpose || '').toLowerCase().trim();
  if (explicit === 'sales') return { purpose: 'sales', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = sales' };
  if (explicit === 'query') return { purpose: 'query', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = query' };
  if (explicit === 'reminder') return { purpose: 'reminder', confidence: 'HIGH', reason: 'Explicit V2 callPurpose field = reminder' };

  const remark = (h.remark || h.comment || contact.remark || '').toLowerCase().trim();
  const status = (h.status || contact.status || '').toLowerCase().trim();

  // 1. Query Evidence (Check remark and status first to catch Query "Info Given" edge case)
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
      reason: isQueryRemark ? `Query evidence in remark` : `Status is explicitly Query`
    };
  }

  // 2. Reminder Evidence
  const isReminderRemark = remark.includes('reminder') || remark.includes('remind') || remark.includes('payment link') || 
                           remark.includes('session link') || remark.includes('zoom link') || remark.includes('whatsapp link') ||
                           remark.includes('webinar link') || remark.includes('event reminder') || remark.includes('workshop reminder');
  const isReminderStatus = status.includes('reminder');

  if (isReminderRemark || isReminderStatus) {
    return {
      purpose: 'reminder',
      confidence: 'HIGH',
      reason: isReminderRemark ? `Reminder evidence in remark` : `Status is explicitly Reminder`
    };
  }

  // 3. Sales Evidence
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
      reason: isSalesStatus ? `Sales journey status: "${h.status || contact.status}"` : `Sales evidence in remark`
    };
  }

  // 4. Check Migration JSON Context
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
          reason: `Contact has high-confidence sales migration relationship`
        };
      }
    }
  }

  // 5. Generic Call Attempt with Sales Context
  const calledFor = (h.calledFor || contact.calledFor || contact.programName || '').toLowerCase().trim();
  if (status.includes('busy') || status.includes('call cut') || status.includes('na') || status.includes('switched off') || status.includes('no answer')) {
    if (calledFor || contact.pipelineStage) {
      return {
        purpose: 'sales',
        confidence: 'MEDIUM',
        reason: `Sales call attempt`
      };
    }
  }

  return {
    purpose: 'unknown_legacy',
    confidence: 'LOW',
    reason: `Ambiguous legacy record`
  };
};

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const map = {
    sales: { calls: 0, connected: 0, contacts: new Set() },
    query: { calls: 0, connected: 0, contacts: new Set() },
    reminder: { calls: 0, connected: 0, contacts: new Set() },
    unknown_legacy: { calls: 0, connected: 0, contacts: new Set() }
  };

  const confidenceCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  let totalCalls = 0;

  contacts.forEach(c => {
    const cId = c._id.toString();
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        totalCalls++;
        const res = classifyCallEvent(h, c);
        const item = map[res.purpose];
        item.calls++;
        if (isConnectedStatus(h.status || c.status)) item.connected++;
        item.contacts.add(cId);

        confidenceCounts[res.confidence]++;
      });
    }
  });

  console.log('Total True History Events Analyzed:', totalCalls);
  console.log('\nFINAL PURPOSE RECONSTRUCTION DISTRIBUTION:');
  console.log(JSON.stringify(Object.entries(map).map(([k, v]) => ({
    purpose: k,
    calls: v.calls,
    uniquePeople: v.contacts.size,
    connectedRate: ((v.connected / v.calls) * 100).toFixed(1) + '%'
  })), null, 2));

  console.log('\nCONFIDENCE BREAKDOWN:');
  console.log(JSON.stringify(confidenceCounts, null, 2));

  await client.close();
}

run().catch(console.error);
