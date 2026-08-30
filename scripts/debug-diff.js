// scripts/debug-diff.js
import { MongoClient } from 'mongodb';
import { classifyInitial, reviewUnknownEvent } from './review-190-unknown-events.js';
import { getCallPurpose } from './reconcile-final-approved-baseline.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const contacts = await db.collection('contacts').find({}).toArray();

  const diffs = [];

  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        let init = classifyInitial(h, c);
        let approvedPurpose = init.purpose;
        let approvedConf = init.confidence;
        if (approvedPurpose === 'unknown_legacy') {
          let rev = reviewUnknownEvent(h, c, idx, '');
          approvedPurpose = rev.proposedPurpose;
          approvedConf = rev.confidence;
        }

        let inlinePurpose = getCallPurpose(h, c);

        if (approvedPurpose !== inlinePurpose) {
          diffs.push({
            contactId: c._id.toString(),
            idx,
            status: h.status || c.status,
            remark: h.remark || c.remark,
            approvedPurpose,
            inlinePurpose
          });
        }
      });
    }
  });

  console.log('Found', diffs.length, 'differences:');
  console.table(diffs);

  await client.close();
}

main().catch(console.error);
