// api/_admin/programs.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db('tgf_crm');
    const collection = db.collection('programs');

    if (req.method === 'GET') {
      // Fetch explicitly created programs from programs collection (Fast indexed query)
      const dbPrograms = await collection.find({}).sort({ name: 1 }).toArray();

      const programMap = new Map();

      dbPrograms.forEach(p => {
        const id = p.id || p._id.toString();
        programMap.set(id, {
          id,
          name: p.name,
          createdAt: p.createdAt
        });
      });

      // Optional distinct scan only if requested with ?includeDistinct=true
      if (req.query.includeDistinct === 'true') {
        try {
          const [distinctSources, distinctPrograms] = await Promise.all([
            db.collection('contacts').distinct('source'),
            db.collection('contacts').distinct('programId')
          ]);
          const allDistinct = Array.from(new Set([...(distinctSources || []), ...(distinctPrograms || [])])).filter(Boolean);
          allDistinct.forEach(name => {
            const id = name.toLowerCase().replace(/\s+/g, '_');
            if (!programMap.has(id) && !programMap.has(name)) {
              programMap.set(id, {
                id,
                name: name,
                createdAt: new Date().toISOString()
              });
            }
          });
        } catch (e) {
          console.warn("[programs distinct scan skipped]", e);
        }
      }

      const resultList = Array.from(programMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      return res.status(200).json({ success: true, data: resultList });
    }

    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Program name is required' });
      }

      const cleanName = name.trim();
      const id = 'prog_' + cleanName.toLowerCase().replace(/\s+/g, '_');

      const newProg = {
        id,
        name: cleanName,
        createdAt: new Date().toISOString()
      };

      await collection.updateOne(
        { id },
        { $setOnInsert: newProg },
        { upsert: true }
      );

      return res.status(200).json({ success: true, data: newProg, id });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'id query parameter is required' });
      }

      await collection.deleteOne({ $or: [{ id }, { _id: id }] });

      return res.status(200).json({ success: true, message: 'Program deleted' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
