// api/version.js - Exposes live deployment build commit SHA for auto-update detection
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev_build';
  return res.status(200).json({
    version,
    timestamp: Date.now()
  });
}
