// api/lib/auth.js
// Server-side Session Signing, Cookie Handling, Role-based Authorization & Query Sanitization
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.MONGODB_URI || 'tgf_crm_session_sec_key_v1_2026';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const ID_ALIASES = {
  'priyanka': 'ZJQsev2aLqi2ispr3j74',
  'attender_3': 'ZJQsev2aLqi2ispr3j74',
  'zjqsev2alqi2ispr3j74': 'ZJQsev2aLqi2ispr3j74',
  'manisha': '9VZZnV00X63PzUSaGTgq',
  'attender_4': '9VZZnV00X63PzUSaGTgq',
  '9vzznv00x63pzusagtgq': '9VZZnV00X63PzUSaGTgq',
  'geeta': 'WbND9Oa4yPUuWXVyibb3',
  'attender_5': 'WbND9Oa4yPUuWXVyibb3',
  'wbnd9oa4ypuuwxvyibb3': 'WbND9Oa4yPUuWXVyibb3',
  'rakhi': 'IrAgizMZzxqzUbJjHIBI',
  'iragizmzzxqzubjjhibi': 'IrAgizMZzxqzUbJjHIBI',
};

/**
 * Sign a payload object into a secure base64.signature token
 */
export function createSessionToken(user) {
  const payload = {
    id: String(user.id || ''),
    name: String(user.name || ''),
    role: String(user.role || 'attender'),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr).toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(base64Payload);
  const signature = hmac.digest('base64url');
  return `${base64Payload}.${signature}`;
}

/**
 * Verify token and return user payload or null if invalid/expired
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }
  const [base64Payload, signature] = token.split('.');
  if (!base64Payload || !signature) return null;

  try {
    const hmac = crypto.createHmac('sha256', SESSION_SECRET);
    hmac.update(base64Payload);
    const expectedSig = hmac.digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);

    if (!payload || !payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      role: payload.role,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Parse incoming HTTP Cookie header
 */
export function parseCookies(req) {
  const list = {};
  const cookieHeader = req?.headers?.cookie || req?.headers?.Cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

/**
 * Get authenticated user session from Cookie or Authorization header
 */
export function getSession(req) {
  if (!req) return null;
  // 1. Check Authorization header: Bearer <token>
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }

  // 2. Check crm_session cookie
  const cookies = parseCookies(req);
  if (cookies.crm_session) {
    const user = verifySessionToken(cookies.crm_session);
    if (user) return user;
  }

  return null;
}

/**
 * Set HTTP-Only Session Cookie on response
 */
export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieStr = `crm_session=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieStr);
}

/**
 * Clear Session Cookie on response
 */
export function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieStr = `crm_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieStr);
}

/**
 * Require authenticated session (any valid user role)
 */
export function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    if (res && !res.headersSent) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
    }
    return null;
  }
  return session;
}

/**
 * Require admin session
 */
export function requireAdmin(req, res) {
  const session = getSession(req);
  if (!session) {
    if (res && !res.headersSent) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
    }
    return null;
  }
  if (session.role !== 'admin' && !session.id.toLowerCase().includes('admin')) {
    if (res && !res.headersSent) {
      res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
    }
    return null;
  }
  return session;
}

/**
 * Coerce input values to primitive string to prevent MongoDB operator injection ({ $ne: ... })
 */
export function sanitizeString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return fallback;
  return String(val).trim();
}

/**
 * Verify if target attender matches authenticated session user (or admin)
 */
export function isSameAttender(targetAttender, session) {
  if (!session) return false;
  if (session.role === 'admin' || (session.id && session.id.toLowerCase().includes('admin'))) return true;
  if (!targetAttender) return true;

  const targetLower = String(targetAttender).toLowerCase().trim();
  const sessIdLower = String(session.id || '').toLowerCase().trim();
  const sessNameLower = String(session.name || '').toLowerCase().trim();

  const canonicalTarget = (ID_ALIASES[targetLower] || targetLower);
  const canonicalSessId = (ID_ALIASES[sessIdLower] || sessIdLower);

  if (canonicalTarget === canonicalSessId) return true;
  if (targetLower === sessIdLower || targetLower === sessNameLower) return true;
  if (sessNameLower && sessNameLower.includes(targetLower)) return true;
  if (sessIdLower && sessIdLower.includes(targetLower)) return true;

  return false;
}
