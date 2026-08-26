// api/lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  throw new Error('Please add MONGODB_URI to your Vercel Environment Variables');
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

let indexesPromise = null;

export const ensureIndexes = (db) => {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      try {
        const contacts = db.collection('contacts');
        const registrations = db.collection('registrations');
        const attenders = db.collection('attenders');
        const programs = db.collection('programs');

        await Promise.all([
          // Contacts Indexes
          contacts.createIndex({ assignedTo: 1, updatedAt: -1 }),
          contacts.createIndex({ assignedTo: 1, status: 1, updatedAt: -1 }),
          contacts.createIndex({ createdAt: -1 }),
          contacts.createIndex({ lastCalledAt: -1 }),
          contacts.createIndex({ updatedAt: -1 }),
          contacts.createIndex({ status: 1 }),
          contacts.createIndex({ source: 1 }),
          contacts.createIndex({ programId: 1 }),
          contacts.createIndex({ normalizedPhone: 1 }),
          contacts.createIndex({ phone: 1 }),
          contacts.createIndex({ Phone: 1 }),
          contacts.createIndex({ mobile: 1 }),
          contacts.createIndex({ Mobile: 1 }),
          contacts.createIndex({ name: 1 }),

          // Registrations Indexes
          registrations.createIndex({ createdAt: -1 }),
          registrations.createIndex({ updatedAt: -1 }),
          registrations.createIndex({ attenderId: 1 }),

          // Attenders & Programs Indexes
          attenders.createIndex({ name: 1 }),
          programs.createIndex({ name: 1 })
        ]);
        console.log('[MONGODB] Complete CRM Index suite verified successfully.');
      } catch (err) {
        console.warn('[MONGODB] Index creation warning:', err.message);
        indexesPromise = null;
      }
    })();
  }
  return indexesPromise;
};

export default clientPromise;
