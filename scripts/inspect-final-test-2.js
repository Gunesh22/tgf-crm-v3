import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://socialmedia_db_user:oCx2eAeDNIIoPX2o@call-center.iigzryp.mongodb.net/?appName=Call-Center";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log("=== INSPECTING LEAD 'Final Test 2' (7777632943) ===");

  const contact = await db.collection('contacts').findOne({
    $or: [
      { phone: "7777632943" },
      { Phone: "7777632943" },
      { normalizedPhone: "7777632943" },
      { name: /Final Test 2/i },
      { Name: /Final Test 2/i }
    ]
  });

  if (!contact) {
    console.log("Lead not found!");
  } else {
    console.log(`Contact ID: ${contact._id || contact.id}`);
    console.log(`Name: ${contact.Name || contact.name}`);
    console.log(`Phone: ${contact.Phone || contact.phone}`);
    console.log(`pipelineStage: ${contact.pipelineStage}`);
    console.log(`status: ${contact.status}`);
    console.log(`calledFor: ${contact.calledFor || contact["Called For"]}`);

    console.log("\n--- programRelationships ---");
    console.log(contact.programRelationships || []);

    console.log("\n--- attenderStates ---");
    console.log(contact.attenderStates || {});

    console.log("\n--- history array ---");
    (contact.history || []).forEach((h, idx) => {
      console.log(`${idx + 1}. Status: "${h.status}" | CalledFor: "${h.calledFor}" | Timestamp: ${h.timestamp} | Attender: ${h.attenderName} | Remark: "${h.remark}" | ChangeType: ${h.changeType || 'CALL'}`);
    });
  }

  console.log("\n--- registrations collection matching this contact ---");
  const regs = await db.collection('registrations').find({
    $or: [
      { phone: "7777632943" },
      { contactId: String(contact?._id || contact?.id) }
    ]
  }).toArray();
  console.log(regs);

  await client.close();
}

main().catch(console.error);
