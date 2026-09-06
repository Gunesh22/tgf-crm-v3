// api/auth/login.js
// Server-side authentication endpoint handling password verification and session cookie generation.
import clientPromise from '../lib/mongodb.js';
import crypto from 'crypto';
import { createSessionToken, setSessionCookie, clearSessionCookie, sanitizeString, getSession } from '../lib/auth.js';

const ADMIN_SALT = 'tgf_crm_admin_salt_v1';
const DEFAULT_INITIAL_PASS = '198219';

function hashAdminPassword(password) {
  return crypto.pbkdf2Sync(String(password), ADMIN_SALT, 10000, 64, 'sha512').toString('hex');
}

function verifyAdminPassword(inputPassword, storedHash) {
  if (!inputPassword || !storedHash) return false;
  const calculated = hashAdminPassword(inputPassword);
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

const FALLBACK_ATTENDERS = [
  { id: "9VZZnV00X63PzUSaGTgq", name: "Manisha", role: "attender", password: "629001" },
  { id: "E5Vy71mpJ7cQIw3acQgEm", name: "Sheetal Marne", role: "attender", password: "121313" },
  { id: "VN6h9vevwXpXU0UXm5IQ", name: "Aparna Mule", role: "attender", password: "121312" },
  { id: "WbND9Oa4yPUuWXVyibb3", name: "Geeta", role: "attender", password: "198291" },
  { id: "ZJQsev2aLqi2Ispr3j74", name: "Priyanka", role: "attender", password: "706321" },
  { id: "a82GcDWY69r6k936b4GC", name: "Vaishali Golande", role: "attender", password: "121314" },
  { id: "IrAgizMZzxqzUbJjHIBI", name: "Rakhi", role: "attender", password: "697984" },
  { id: "o1FPWNvI7HO4O2ylSuZm", name: "Sreeja", role: "attender", password: "646080" },
  { id: "pKfAHuc7UODJ8aOB1luFY", name: "Dipika", role: "attender", password: "121311" }
];

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = getSession(req);
    if (!session) {
      return res.status(200).json({ success: true, authenticated: false, user: null });
    }
    return res.status(200).json({ success: true, authenticated: true, user: session });
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const inputIdRaw = req.body?.attenderId || req.body?.username || req.body?.id || '';
    const inputPassRaw = req.body?.password || '';

    const inputId = sanitizeString(inputIdRaw);
    const inputPass = sanitizeString(inputPassRaw);

    if (!inputId || !inputPass) {
      return res.status(400).json({ success: false, error: 'Name/ID and Password are required' });
    }

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    // 1. ADMIN AUTHENTICATION
    if (inputId.toLowerCase().includes('admin')) {
      const settingsColl = db.collection('settings');
      let adminDoc = await settingsColl.findOne({ _id: 'admin_auth' });

      if (!adminDoc) {
        const initialHash = hashAdminPassword(DEFAULT_INITIAL_PASS);
        adminDoc = {
          _id: 'admin_auth',
          username: 'admin',
          passwordHash: initialHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await settingsColl.insertOne(adminDoc);
      }

      const isPassValid = verifyAdminPassword(inputPass, adminDoc.passwordHash);
      if (!isPassValid) {
        return res.status(401).json({ success: false, error: 'Invalid admin password' });
      }

      const adminUser = { id: 'admin_01', name: 'Super Admin', role: 'admin' };
      const token = createSessionToken(adminUser);
      setSessionCookie(res, token);

      return res.status(200).json({
        success: true,
        user: adminUser,
        token
      });
    }

    // 2. ATTENDER AUTHENTICATION
    const attendersColl = db.collection('attenders');
    let dbAttenders = await attendersColl.find({
      role: { $ne: 'admin' },
      name: { $nin: [/admin/i, /super admin/i, /administrator/i] }
    }).toArray();

    if (!dbAttenders || dbAttenders.length === 0) {
      dbAttenders = FALLBACK_ATTENDERS;
    }

    const inputLower = inputId.toLowerCase();
    let matched = dbAttenders.find(a =>
      String(a.id || '').toLowerCase() === inputLower ||
      String(a.name || '').toLowerCase() === inputLower ||
      String(a.name || '').toLowerCase().startsWith(inputLower) ||
      String(a.name || '').toLowerCase().includes(inputLower)
    );

    if (!matched) {
      matched = FALLBACK_ATTENDERS.find(a =>
        String(a.id || '').toLowerCase() === inputLower ||
        String(a.name || '').toLowerCase() === inputLower ||
        String(a.name || '').toLowerCase().startsWith(inputLower) ||
        String(a.name || '').toLowerCase().includes(inputLower)
      );
    }

    if (!matched) {
      return res.status(404).json({ success: false, error: 'Attender not found. Check your ID or Name.' });
    }

    const fallbackMatched = FALLBACK_ATTENDERS.find(a =>
      String(a.id || '').toLowerCase() === inputLower ||
      String(a.name || '').toLowerCase() === inputLower ||
      String(a.name || '').toLowerCase().startsWith(inputLower) ||
      String(a.name || '').toLowerCase().includes(inputLower)
    );

    const expectedPassword = matched.password || fallbackMatched?.password;

    if (expectedPassword && expectedPassword !== inputPass) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Please try again.' });
    }

    const attenderUser = {
      id: matched.id || matched._id.toString(),
      name: matched.name,
      role: 'attender'
    };

    const token = createSessionToken(attenderUser);
    setSessionCookie(res, token);

    return res.status(200).json({
      success: true,
      user: attenderUser,
      token
    });

  } catch (error) {
    console.error('[LOGIN API ERROR]', error);
    return res.status(500).json({ success: false, error: 'Authentication service error' });
  }
}
