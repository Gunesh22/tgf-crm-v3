// api/lib/mongodb.js
import { MongoClient } from 'mongodb';

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please add MONGODB_URI to your Vercel Environment Variables');
  }
  return uri;
}

// Safe diagnostic logger (never exposes credentials or password)
function logSafeMongoStatus(uri) {
  try {
    const hasUri = Boolean(uri);
    const host = uri ? (uri.match(/@([^/?]+)/)?.[1] || 'hidden-host') : 'none';
    const dbName = uri ? (uri.match(/\.net\/([^?]+)/)?.[1] || 'default') : 'none';
    console.log(`[MONGODB INIT] env: ${process.env.NODE_ENV || 'production'} | URI Configured: ${hasUri} | Host: ${host} | DB: ${dbName}`);
  } catch (e) {
    console.log('[MONGODB INIT] Initialized');
  }
}

const options = {};

function getClientPromise() {
  const uri = getMongoUri();
  
  if (!global._mongoClientPromise) {
    logSafeMongoStatus(uri);
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().then(c => {
      console.log('[MONGODB CONNECTED] Active instance connected successfully');
      return c;
    }).catch(err => {
      console.error('[MONGODB ERROR] Connection attempt failed:', err.message);
      global._mongoClientPromise = null; // Clear immediately on error
      throw err;
    });
  }

  // If cached promise rejects, clear cache so subsequent request reconnects with fresh credentials
  return global._mongoClientPromise.catch(err => {
    global._mongoClientPromise = null;
    throw err;
  });
}

// Thenable wrapper to maintain transparent `await clientPromise` compatibility
const clientPromise = {
  then(onFulfilled, onRejected) {
    return getClientPromise().then(onFulfilled, onRejected);
  },
  catch(onRejected) {
    return getClientPromise().catch(onRejected);
  }
};

let indexesPromise = null;

export const ensureIndexes = (db) => {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      try {
        const contacts      = db.collection('contacts');
        const registrations = db.collection('registrations');
        const attenders     = db.collection('attenders');
        const programs      = db.collection('programs');

        await Promise.all([
          // ── Contact core indexes ──────────────────────────────────────────
          contacts.createIndex({ attenderId: 1, isAssigned: 1, updatedAt: -1 }),
          contacts.createIndex({ phone: 1 }),
          contacts.createIndex({ normalizedPhone: 1 }),
          contacts.createIndex({ name: 1 }),
          contacts.createIndex({ pipelineStage: 1 }),
          contacts.createIndex({ status: 1 }),
          contacts.createIndex({ createdAt: -1 }),
          contacts.createIndex({ updatedAt: -1 }),

          // ── V2: Lead ownership indexes ────────────────────────────────────
          contacts.createIndex({ leadOwner: 1 }),
          contacts.createIndex({ leadOwner: 1, pipelineStage: 1 }),

          // ── V2: Program relationships ─────────────────────────────────────
          contacts.createIndex({ 'programRelationships.program': 1 }),
          contacts.createIndex({ 'programRelationships.status': 1 }),
          contacts.createIndex({ 'programRelationships.calledForKey': 1 }),

          // ── V2: Call analytics indexes (query history[] by purpose/direction) ─
          contacts.createIndex({ 'history.callPurpose': 1 }),
          contacts.createIndex({ 'history.callDirection': 1 }),
          contacts.createIndex({ 'history.callId': 1 }),

          // ── Registrations indexes ─────────────────────────────────────────
          registrations.createIndex({ contactId: 1, calledForKey: 1 }, { unique: true, sparse: true }),
          registrations.createIndex({ contactId: 1, programId: 1 }),
          registrations.createIndex({ calledForKey: 1 }),
          registrations.createIndex({ status: 1 }),
          registrations.createIndex({ createdAt: -1 }),
          registrations.createIndex({ updatedAt: -1 }),
          registrations.createIndex({ attenderId: 1 }),
          registrations.createIndex({ leadOwner: 1 }),

          // ── Attenders & Programs ──────────────────────────────────────────
          attenders.createIndex({ name: 1 }),
          programs.createIndex({ name: 1 }),
        ]);

        console.log('[MONGODB] V2 CRM Index suite verified successfully.');
      } catch (err) {
        console.warn('[MONGODB] Index creation warning:', err.message);
        indexesPromise = null;
      }
    })();
  }
  return indexesPromise;
};

export default clientPromise;
