// api/_admin/settings.js
import clientPromise from '../lib/mongodb.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const DEFAULT_CONNECTED_STATUSES = [
  "Info Given", "Info given", "Interested", "Previous Program Pending", "Reg.Done", "reminder", "Query", 
  "Already Reg.d", "Next Time", "Next time", "Shivir done", "Not possible", 
  "Not Interested", "Not interested"
];

const DEFAULT_NOT_CONNECTED_STATUSES = [
  "Not Connected", "NA", "Busy", "Call Cut", "switched off", "Invalid No", "Invalid Number",
  "Called by mistake", "No Network", "wrong no.", "no answer", "Not Picked Up", "Not Attended", "Call Log Added", "Pending"
];

const DEFAULT_SALES_OUTCOME_OPTIONS = [
  "Info Given",
  "Interested",
  "Previous Program Pending",
  "Next Time",
  "Not Interested",
  "Reg.Done",
  "Already Reg.d",
  "Shivir done"
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
  "CBT Basic",
  "Direct Call",
  "Fail Payment"
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
  revision: 1,
  fieldRevisions: {},
  statusOptions: [...DEFAULT_CONNECTED_STATUSES, ...DEFAULT_NOT_CONNECTED_STATUSES],
  salesOutcomeOptions: DEFAULT_SALES_OUTCOME_OPTIONS,
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
      const session = requireAuth(req, res);
      if (!session) return;

      let doc = await collection.findOne({ _id: 'call_center_options' });

      if (!doc) {
        await collection.insertOne({ ...DEFAULT_SETTINGS });
        doc = DEFAULT_SETTINGS;
      }

      const currentRevision = typeof doc.revision === 'number' ? doc.revision : 1;
      const fieldRevisions = (doc.fieldRevisions && typeof doc.fieldRevisions === 'object') ? doc.fieldRevisions : {};

      // Extract clean data without _id
      const { _id, ...cleanData } = doc;
      cleanData.revision = currentRevision;
      cleanData.fieldRevisions = fieldRevisions;

      if (!cleanData.salesOutcomeOptions) {
        cleanData.salesOutcomeOptions = DEFAULT_SALES_OUTCOME_OPTIONS;
      }
      if (!cleanData.sourceOptions) {
        cleanData.sourceOptions = DEFAULT_SOURCE_OPTIONS;
      }
      if (!cleanData.calledForOptions) {
        cleanData.calledForOptions = DEFAULT_CALLED_FOR_OPTIONS;
      }
      if (!cleanData.statusOptions) {
        cleanData.statusOptions = DEFAULT_SETTINGS.statusOptions;
      }

      // Check for sinceRevision query parameter (with req.url fallback for all proxy environments)
      const sinceRevisionRaw = req.query?.sinceRevision || (req.url && req.url.includes('?') ? new URL(req.url, 'http://localhost').searchParams.get('sinceRevision') : null);
      const hasSinceRev = sinceRevisionRaw !== undefined && sinceRevisionRaw !== null && sinceRevisionRaw !== '' && !isNaN(Number(sinceRevisionRaw));
      const sinceRevision = hasSinceRev ? parseInt(sinceRevisionRaw, 10) : null;

      // 1. Initial Load / Invalid / Stale Future Revision -> Return full settings document
      if (sinceRevision === null || sinceRevision < 1 || sinceRevision > currentRevision) {
        return res.status(200).json({
          success: true,
          modified: true,
          revision: currentRevision,
          updatedAt: cleanData.updatedAt,
          data: cleanData
        });
      }

      // 2. Refresh with No Changes -> Return tiny modified: false response
      if (sinceRevision === currentRevision) {
        return res.status(200).json({
          success: true,
          modified: false,
          revision: currentRevision,
          updatedAt: cleanData.updatedAt
        });
      }

      // 3. Differential Sync: Find which fields changed since client's revision
      const changedData = {};
      for (const [field, rev] of Object.entries(fieldRevisions)) {
        if (typeof rev === 'number' && rev > sinceRevision && cleanData[field] !== undefined) {
          changedData[field] = cleanData[field];
        }
      }

      // If document revision was bumped but fieldRevisions was empty (legacy doc), return full data
      if (Object.keys(changedData).length === 0) {
        return res.status(200).json({
          success: true,
          modified: true,
          revision: currentRevision,
          updatedAt: cleanData.updatedAt,
          data: cleanData
        });
      }

      // Return ONLY changed fields
      return res.status(200).json({
        success: true,
        modified: true,
        revision: currentRevision,
        updatedAt: cleanData.updatedAt,
        data: changedData
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const session = requireAdmin(req, res);
      if (!session) return;

      const { _id, revision: ignoredRev, fieldRevisions: ignoredFr, updatedAt: ignoredUpd, ...updates } = req.body || {};
      const updatedKeys = Object.keys(updates);

      let currentDoc = await collection.findOne({ _id: 'call_center_options' });
      if (!currentDoc) {
        await collection.insertOne({ ...DEFAULT_SETTINGS });
        currentDoc = await collection.findOne({ _id: 'call_center_options' });
      }

      if (updatedKeys.length === 0) {
        const { _id: unusedId, ...cleanData } = currentDoc || {};
        return res.status(200).json({
          success: true,
          message: 'No updates provided',
          revision: cleanData.revision || 1,
          data: cleanData
        });
      }

      const now = new Date().toISOString();
      const currentRevision = typeof currentDoc?.revision === 'number' ? currentDoc.revision : 1;
      const nextRevision = currentRevision + 1;

      const setFields = {
        ...updates,
        revision: nextRevision,
        updatedAt: now
      };

      for (const key of updatedKeys) {
        setFields[`fieldRevisions.${key}`] = nextRevision;
      }

      const updatedDoc = await collection.findOneAndUpdate(
        { _id: 'call_center_options' },
        { $set: setFields },
        { returnDocument: 'after', upsert: true }
      );

      const { _id: unusedId, ...cleanData } = updatedDoc || {};

      return res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        revision: cleanData.revision || nextRevision,
        data: cleanData
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
