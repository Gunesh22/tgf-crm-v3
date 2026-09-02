require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://shivam:Shivam123@cluster0.n4n5w.mongodb.net/tgf_crm?retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log(`=== CHECKING REGISTRATIONS COLLECTION ===`);
  const regs = await db.collection('registrations').find({}).toArray();
  console.table(regs.map(r => ({
    _id: r._id,
    contactId: r.contactId,
    name: r.name || r.contactName,
    phone: r.phone || r.contactPhone,
    program: r.program || r.programName || r.calledFor,
    attenderName: r.attenderName,
    status: r.status,
    createdAt: r.createdAt
  })));

  console.log(`\n=== CHECKING TANAJI BABURAO KOLI IN CONTACTS ===`);
  const tanaji = await db.collection('contacts').find({ phone: /9561653801/ }).toArray();
  console.log(JSON.stringify(tanaji, null, 2));

  await client.close();
}

main().catch(console.error);
