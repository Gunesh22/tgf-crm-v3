// api/_admin/attenders.js
import clientPromise from '../lib/mongodb.js';
import { requireAuth, requireAdmin, sanitizeString } from '../lib/auth.js';

const DEFAULT_ATTENDERS = [
  { id: "9VZZnV00X63PzUSaGTgq", name: "Manisha", role: "attender", password: "629001", isActive: true },
  { id: "E5Vy71mpJ7cQIw3acQgEm", name: "Sheetal Marne", role: "attender", password: "121313", isActive: true },
  { id: "VN6h9vevwXpXU0UXm5IQ", name: "Aparna Mule", role: "attender", password: "121312", isActive: true },
  { id: "WbND9Oa4yPUuWXVyibb3", name: "Geeta", role: "attender", password: "198291", isActive: true },
  { id: "ZJQsev2aLqi2Ispr3j74", name: "Priyanka", role: "attender", password: "706321", isActive: true },
  { id: "a82GcDWY69r6k936b4GC", name: "Vaishali Golande", role: "attender", password: "121314", isActive: true },
  { id: "IrAgizMZzxqzUbJjHIBI", name: "Rakhi", role: "attender", password: "697984", isActive: true },
  { id: "o1FPWNvI7HO4O2ylSuZm", name: "Sreeja", role: "attender", password: "646080", isActive: true },
  { id: "pKfAHuc7UODJ8aOB1luFY", name: "Dipika", role: "attender", password: "121311", isActive: true }
];

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db('tgf_crm');
    const collection = db.collection('attenders');

    if (req.method === 'GET') {
      const session = requireAuth(req, res);
      if (!session) return;

      // ── Sub-query: Count assigned contacts for an attender ─────────────
      if (req.query.countId) {
        const attenderId = sanitizeString(req.query.countId);
        const contactsColl = db.collection('contacts');
        const count = await contactsColl.countDocuments({
          $or: [
            { assignedTo: attenderId },
            { assignedTo: { $in: [attenderId] } },
            { [`attenderStates.${attenderId}`]: { $exists: true } }
          ]
        });
        return res.status(200).json({ success: true, attenderId, count });
      }

      let attenders = await collection.find({
        role: { $ne: 'admin' },
        name: { $nin: [/admin/i, /super admin/i, /administrator/i] }
      }).sort({ name: 1 }).toArray();

      // Seed initial default attenders if empty
      if (attenders.length === 0) {
        await collection.insertMany(DEFAULT_ATTENDERS);
        attenders = await collection.find({
          role: { $ne: 'admin' },
          name: { $nin: [/admin/i, /super admin/i, /administrator/i] }
        }).sort({ name: 1 }).toArray();
      }

      const formatted = attenders.map(a => ({
        id: a.id || a._id.toString(),
        name: a.name,
        role: a.role || 'attender'
      }));

      return res.status(200).json({ success: true, data: formatted });
    }

    if (req.method === 'POST') {
      const session = requireAdmin(req, res);
      if (!session) return;

      const { name, password } = req.body || {};
      const cleanName = sanitizeString(name);
      if (!cleanName) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const id = 'attender_' + Date.now();
      const generatedPassword = sanitizeString(password) || Math.floor(100000 + Math.random() * 900000).toString();

      const newAttender = {
        id,
        name: cleanName,
        role: 'attender',
        password: generatedPassword,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await collection.insertOne(newAttender);

      return res.status(200).json({
        success: true,
        data: {
          id: newAttender.id,
          name: newAttender.name,
          role: newAttender.role
        },
        password: generatedPassword
      });
    }

    if (req.method === 'PUT') {
      const session = requireAdmin(req, res);
      if (!session) return;

      const { id, name, password, updates } = req.body || {};
      const cleanId = sanitizeString(id);
      if (!cleanId) {
        return res.status(400).json({ error: 'id is required' });
      }

      const fieldsToSet = {
        updatedAt: new Date().toISOString(),
        ...(updates || {})
      };
      if (name) fieldsToSet.name = sanitizeString(name);
      if (password) fieldsToSet.password = sanitizeString(password);

      await collection.updateOne(
        { $or: [{ id: cleanId }, { _id: cleanId }] },
        { $set: fieldsToSet }
      );

      return res.status(200).json({ success: true, message: 'Attender updated' });
    }

    if (req.method === 'DELETE') {
      const session = requireAdmin(req, res);
      if (!session) return;

      const cleanId = sanitizeString(req.query?.id);
      if (!cleanId) {
        return res.status(400).json({ error: 'id query parameter is required' });
      }

      await collection.deleteOne({ $or: [{ id: cleanId }, { _id: cleanId }] });

      return res.status(200).json({ success: true, message: 'Attender deleted' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
