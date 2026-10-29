const crypto = require('crypto');
require('dotenv').config();

// The old hardcoded fallback was public (it lived in the source code), so it must never be used.
const LEAKED_DEFAULT = 'supersecretcakeflowai2026key';

let secret = process.env.JWT_SECRET;

if (!secret || secret === LEAKED_DEFAULT) {
  // Random per-process secret: the app keeps working, but staff must re-login after every restart.
  secret = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️ JWT_SECRET missing or using the old public default. Using a temporary random secret. Set a strong JWT_SECRET in .env!');
}

module.exports = secret;
