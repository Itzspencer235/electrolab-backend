// Sign in with Apple: the iPhone app receives an "identity token" (a JWT signed
// by Apple). We check it with Apple's public keys, Apple as issuer and our
// bundle ID as audience, so a token issued for another app is refused.
//
// Render env (optional):
//   APPLE_CLIENT_IDS — comma-separated bundle IDs / service IDs accepted as
//                      audience. Default: com.ipelectrolab.app
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');

const JWKS_URL = 'https://appleid.apple.com/auth/keys';
const ISSUER   = 'https://appleid.apple.com';
let jwks = { at: 0, keys: [] };

const audiences = () => (process.env.APPLE_CLIENT_IDS || 'com.ipelectrolab.app')
  .split(',').map(s => s.trim()).filter(Boolean);

async function keyFor(kid) {
  if (Date.now() - jwks.at > 60 * 60 * 1000 || !jwks.keys.some(k => k.kid === kid)) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error('Cannot load Apple keys');
    jwks = { at: Date.now(), keys: (await res.json()).keys || [] };
  }
  const jwk = jwks.keys.find(k => k.kid === kid);
  if (!jwk) throw new Error('Unknown Apple key');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

/** Returns { sub, email, emailVerified } or throws. */
async function verifyAppleToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Invalid token');
  const key = await keyFor(decoded.header.kid);
  const p = jwt.verify(token, key, { algorithms: ['RS256'], audience: audiences(), issuer: ISSUER });
  if (!p.sub) throw new Error('Invalid token');
  return {
    sub: String(p.sub),
    email: typeof p.email === 'string' ? p.email.toLowerCase() : undefined,
    // Apple sends true/false or "true"/"false"
    emailVerified: p.email_verified === true || p.email_verified === 'true',
  };
}

module.exports = { verifyAppleToken };
