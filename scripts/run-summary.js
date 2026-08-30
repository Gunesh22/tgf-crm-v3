// scripts/run-summary.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import { classifyCallEvent } from './audit-deep-purpose-reconstruction.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
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

  const confidenceBreakdown = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };

  let totalEvents = 0;

  contacts.forEach(contact => {
    const cId = contact._id.toString();
    if (Array.isArray(contact.history)) {
      contact.history.forEach(h => {
        totalEvents++;
        const res = classifyCallEvent(h, contact);
        const p = map[res.purpose];
        p.calls++;
        p.contacts.add(cId);

        const status = (h.status || contact.status || '').toLowerCase();
        const unconn = ['na', 'busy', 'call cut', 'switched off', 'invalid no', 'no network', 'wrong no.', 'not picked up', 'no answer'];
        if (!unconn.some(u => status.includes(u))) {
          p.connected++;
        }

        confidenceBreakdown[res.confidence]++;
      });
    }
  });

  console.log('====================================================');
  console.log('FINAL PURPOSE BREAKDOWN FOR 2,094 REAL HISTORY EVENTS');
  console.log('====================================================\n');

  console.table(Object.entries(map).map(([purpose, data]) => ({
    Purpose: purpose === 'unknown_legacy' ? 'Unknown / Legacy' : purpose.charAt(0).toUpperCase() + purpose.slice(1),
    Calls: data.calls,
    'Unique People': data.contacts.size,
    'Connected %': data.calls > 0 ? ((data.connected / data.calls) * 100).toFixed(1) + '%' : '0.0%'
  })));

  console.log('\nCONFIDENCE LEVEL BREAKDOWN:');
  console.table(confidenceBreakdown);

  await client.close();
}

main().catch(console.error);
