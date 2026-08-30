// api/_admin/settings.js
import clientPromise from '../lib/mongodb.js';

const DEFAULT_CONNECTED_STATUSES = [
  "Info given", "Interested", "Reg.Done", "reminder", "Query", 
  "Already Reg.d", "Next time", "Shivir done", "Not possible", 
  "Pending", "Not interested", "Not Attended", "Call Log Added"
];

const DEFAULT_NOT_CONNECTED_STATUSES = [
  "NA", "Busy", "Call Cut", "switched off", "Invalid No", 
  "Called by mistake", "No Network", "wrong no.", "no answer"
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

const DEFAULT_WHATSAPP_TEMPLATES = [
  { id: "template_1", name: "CBT Basic Info", text: "Namaste! Here are the details for the CBT Basic program." },
  { id: "template_2", name: "Registration Link", text: "Namaste! Please click the link below to complete your registration." },
  { id: "template_3", name: "Callback Reminder", text: "Namaste! Trying to reach you regarding your inquiry. Please call back when free." }
];

export const DEFAULT_SETTINGS = {
  _id: "call_center_options",
  statusOptions: [...DEFAULT_CONNECTED_STATUSES, ...DEFAULT_NOT_CONNECTED_STATUSES],
  connectedStatuses: DEFAULT_CONNECTED_STATUSES,
  notConnectedStatuses: DEFAULT_NOT_CONNECTED_STATUSES,
  sourceOptions: DEFAULT_SOURCE_OPTIONS,
  calledForOptions: DEFAULT_CALLED_FOR_OPTIONS,
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES,
  optionalCompulsoryStatuses: DEFAULT_NOT_CONNECTED_STATUSES,
  updatedAt: new Date().toISOString()
};

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db('tgf_crm');
    const collection = db.collection('settings');

    if (req.method === 'GET') {
      let doc = await collection.findOne({ _id: 'call_center_options' });

      if (!doc) {
        await collection.insertOne({ ...DEFAULT_SETTINGS });
        doc = DEFAULT_SETTINGS;
      }

      // Return clean settings object (omit _id) — STRICTLY READ-ONLY
      const { _id, ...cleanData } = doc;
      return res.status(200).json({ success: true, data: cleanData });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { _id, ...updates } = req.body || {};

      const setFields = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await collection.updateOne(
        { _id: 'call_center_options' },
        { $set: setFields },
        { upsert: true }
      );

      const updatedDoc = await collection.findOne({ _id: 'call_center_options' });
      const { _id: unusedId, ...cleanData } = updatedDoc || {};

      return res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        data: cleanData
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
