require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://shivam:Shivam123@cluster0.n4n5w.mongodb.net/tgf_crm?retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const names = ['Bhart', 'Niraj', 'Prashant', 'Ketkar', 'Kushwah'];

  for (const name of names) {
    const contacts = await db.collection('contacts').find({
      $or: [
        { name: new RegExp(name, 'i') },
        { Name: new RegExp(name, 'i') }
      ]
    }).toArray();

    console.log(`\n======================================================`);
    console.log(` SEARCH FOR NAME: ${name} (${contacts.length} found)`);
    console.log(`======================================================`);
    contacts.forEach(c => {
      console.log({
        _id: c._id,
        name: c.name || c.Name,
        phone: c.phone || c.Phone || c.mobile || c.Mobile,
        status: c.status,
        callStatus: c.callStatus,
        pipelineStage: c.pipelineStage,
        attenderName: c.attenderName || c.assignedName,
        lastCalledAt: c.lastCalledAt,
        createdAt: c.createdAt,
        historyCount: Array.isArray(c.history) ? c.history.length : 0,
        history: c.history
      });
    });
  }

  await client.close();
}

main().catch(console.error);
