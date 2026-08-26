// api/admin/attenders.js
import clientPromise from '../lib/mongodb.js';

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
      let attenders = await collection.find({}).sort({ name: 1 }).toArray();

      // Seed initial default attenders if empty
      if (attenders.length === 0) {
        await collection.insertMany(DEFAULT_ATTENDERS);
        attenders = await collection.find({}).sort({ name: 1 }).toArray();
      }

      const formatted = attenders.map(a => ({
        id: a.id || a._id.toString(),
        name: a.name,
        role: a.role || 'attender',
        password: a.password || 'pass123'
      }));

      return res.status(200).json({ success: true, data: formatted });
    }

    if (req.method === 'POST') {
      const { name, password } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const cleanName = name.trim();
      const id = 'attender_' + Date.now();
      const generatedPassword = password || Math.random().toString(36).slice(-8);

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
        data: newAttender,
        password: generatedPassword
      });
    }

    if (req.method === 'PUT') {
      const { id, name, password, updates } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const fieldsToSet = {
        updatedAt: new Date().toISOString(),
        ...(updates || {})
      };
      if (name) fieldsToSet.name = name.trim();
      if (password) fieldsToSet.password = password.trim();

      await collection.updateOne(
        { $or: [{ id }, { _id: id }] },
        { $set: fieldsToSet }
      );

      return res.status(200).json({ success: true, message: 'Attender updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'id query parameter is required' });
      }

      await collection.deleteOne({ $or: [{ id }, { _id: id }] });

      return res.status(200).json({ success: true, message: 'Attender deleted' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
