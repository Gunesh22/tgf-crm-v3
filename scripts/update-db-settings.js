import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const DEFAULT_CALLED_FOR_OPTIONS = [
  "Other",
  "TGF Info",
  "CBT Avd",
  "CBT Basic",
  "Off MA",
  "On MA",
  "On MA Hindi",
  "On MA Eng.",
  "Dhyan",
  "Nisarg Dhyan",
  "BUP",
  "BUT",
  "Hair Program",
  "Hair Avd",
  "Pranayam",
  "Pranayam Avd",
  "Program",
  "Shravan",
  "App",
  "Special MA",
  "Spiritual H",
  "Swasthya Shivir",
  "Ashram Visit",
  "Mini Shivir",
  "Kids Shivir",
  "Reminder",
  "Yoga 1 Month",
  "Yoga 3 Month",
  "Yoga 6 Month",
  "Yoga 1 Yr",
  "SHSH",
  "Digestive Basic",
  "Digestive Avd",
  "Spine Basic",
  "Spine Avd",
  "Book",
  "Studya Smater",
  "Appointment"
];

const DEFAULT_SOURCE_OPTIONS = [
  "Facebook",
  "Instagram",
  "WhatsApp",
  "YouTube",
  "Google",
  "Website",
  "Books",
  "Call Centre",
  "Program",
  "Khoji",
  "Other",
  "NA",
  "SHSH",
  "CBT Basic"
];

async function updateDbSettings() {
  if (!MONGODB_URI) {
    console.error("No MONGODB_URI found in environment!");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('tgf_crm');
    const collection = db.collection('settings');

    const result = await collection.updateOne(
      { _id: 'call_center_options' },
      {
        $set: {
          calledForOptions: DEFAULT_CALLED_FOR_OPTIONS,
          sourceOptions: DEFAULT_SOURCE_OPTIONS,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    console.log("MongoDB settings update result:", result);
    const updated = await collection.findOne({ _id: 'call_center_options' });
    console.log("Updated settings document in DB:", {
      calledForCount: updated.calledForOptions?.length,
      sourceCount: updated.sourceOptions?.length,
      calledForOptions: updated.calledForOptions,
      sourceOptions: updated.sourceOptions
    });
  } catch (err) {
    console.error("Error updating settings in DB:", err);
  } finally {
    await client.close();
  }
}

updateDbSettings();
