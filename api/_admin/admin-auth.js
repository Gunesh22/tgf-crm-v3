// api/_admin/admin-auth.js
import clientPromise from '../lib/mongodb.js';
import crypto from 'crypto';

const SALT = 'tgf_crm_admin_salt_v1';
const DEFAULT_INITIAL_PASS = '198219';

function hashPassword(password) {
  return crypto.pbkdf2Sync(String(password), SALT, 10000, 64, 'sha512').toString('hex');
}

function verifyPassword(inputPassword, storedHash) {
  if (!inputPassword || !storedHash) return false;
  const calculated = hashPassword(inputPassword);
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

async function getOrCreateAdminAuth(collection) {
  let doc = await collection.findOne({ _id: 'admin_auth' });
  if (!doc) {
    const initialHash = hashPassword(DEFAULT_INITIAL_PASS);
    const newDoc = {
      _id: 'admin_auth',
      username: 'admin',
      passwordHash: initialHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await collection.insertOne(newDoc);
    doc = newDoc;
  }
  return doc;
}

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db('tgf_crm');
    const collection = db.collection('settings');

    const adminDoc = await getOrCreateAdminAuth(collection);

    if (req.method === 'POST') {
      const { action, password, currentPassword, newPassword, username } = req.body || {};

      // ── ACTION 1: ADMIN LOGIN ───────────────────────────────────────────────
      if (action === 'login' || (!action && password && !newPassword)) {
        const inputPass = password || '';
        const isValid = verifyPassword(inputPass, adminDoc.passwordHash);

        if (isValid) {
          return res.status(200).json({
            success: true,
            user: { id: 'admin_01', name: 'Super Admin', role: 'admin' }
          });
        } else {
          return res.status(401).json({ success: false, error: 'Invalid admin password' });
        }
      }

      // ── ACTION 2: CHANGE ADMIN PASSWORD ──────────────────────────────────
      if (action === 'change-password' || (newPassword && currentPassword)) {
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ success: false, error: 'Current password and new password are required' });
        }

        const isCurrentValid = verifyPassword(currentPassword, adminDoc.passwordHash);
        if (!isCurrentValid) {
          return res.status(401).json({ success: false, error: 'Incorrect current password' });
        }

        const trimmedNew = String(newPassword).trim();
        if (trimmedNew.length < 4) {
          return res.status(400).json({ success: false, error: 'New password must be at least 4 characters' });
        }

        const newHash = hashPassword(trimmedNew);
        await collection.updateOne(
          { _id: 'admin_auth' },
          {
            $set: {
              passwordHash: newHash,
              updatedAt: new Date().toISOString()
            }
          }
        );

        return res.status(200).json({
          success: true,
          message: 'Admin password updated successfully'
        });
      }
    }

    if (req.method === 'GET') {
      // Returns status without exposing password hash
      return res.status(200).json({
        success: true,
        configured: true,
        updatedAt: adminDoc.updatedAt
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
