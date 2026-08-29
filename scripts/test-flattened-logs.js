// scripts/test-flattened-logs.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const getCanonicalHistoryList = (logs) => {
    const list = [];
    logs.forEach(log => {
      if (log._deleted) return;

      const contactName = log.Name || log.name || 'Unknown';
      const contactPhone = log.Phone || log.phone || log.Mobile || log.mobile || '';

      const history = Array.isArray(log.history) && log.history.length > 0 ? log.history : null;

      if (history) {
        history.forEach((h, idx) => {
          list.push({
            contactId: log._id ? log._id.toString() : log.id,
            Name: contactName,
            Phone: contactPhone,
            attenderId: h.attenderId || log.attenderId || 'legacy',
            attenderName: h.attenderName || log.attenderName || 'Legacy Attender',
            status: h.status || 'Pending',
            remark: h.remark || '',
            callType: h.callType || log.callType || 'outgoing',
            timestamp: new Date(h.timestamp || h.date || h.createdAt || log.createdAt || Date.now()),
            calledFor: h.calledFor || log['Called For'] || log.calledFor || '',
            source: h.source || log.Source || log.source || ''
          });
        });
      } else if (log.lastCalledAt || (log.status && log.status !== 'Pending') || log.remark) {
        // Fallback ONLY if no history array exists on this contact
        list.push({
          contactId: log._id ? log._id.toString() : log.id,
          Name: contactName,
          Phone: contactPhone,
          attenderId: log.attenderId || 'legacy',
          attenderName: log.attenderName || 'Legacy Attender',
          status: log.status || 'Pending',
          remark: log.remark || '',
          callType: log.callType || 'outgoing',
          timestamp: new Date(log.lastCalledAt || log.createdAt || Date.now()),
          calledFor: log['Called For'] || log.calledFor || '',
          source: log.Source || log.source || ''
        });
      }
    });
    return list;
  };

  const flattened = getCanonicalHistoryList(contacts);
  console.log(`Total Flattened Call Events: ${flattened.length}`);

  const byAttender = {};
  flattened.forEach(item => {
    let name = item.attenderName || 'Unknown';
    if (['ZJQsev2aLqi2ispr3j74', 'Priyanka'].includes(item.attenderId) || name.toLowerCase().includes('priyanka')) name = 'Priyanka';
    else if (['WbND9Oa4yPUuWXVyibb3', 'Geeta'].includes(item.attenderId) || name.toLowerCase().includes('geeta')) name = 'Geeta';
    else if (['9VZZnV00X63PzUSaGTgq', 'Manisha'].includes(item.attenderId) || name.toLowerCase().includes('manisha')) name = 'Manisha';

    byAttender[name] = (byAttender[name] || 0) + 1;
  });

  console.log('\nCall Events Count by Attender:');
  console.table(Object.entries(byAttender).map(([attender, count]) => ({ attender, count })));

  await client.close();
}

main().catch(console.error);
