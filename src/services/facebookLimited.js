// Facebook "Limited Login" (iOS when the user doesn't allow tracking): the app
// gets a signed JWT instead of a Graph API access token. We verify it with
// Facebook's public keys, our app ID as audience, and Facebook as issuer.
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');

const JWKS_URL = 'https://limited.facebook.com/.well-known/oauth/openid/jwks/';
const ISSUERS  = ['https://www.facebook.com', 'https://limited.facebook.com'];
let jwks = { at: 0, keys: [] };

async function keyFor(kid) {
  if (Date.now() - jwks.at > 60 * 60 * 1000 || !jwks.keys.some(k => k.kid === kid)) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error('Cannot load Facebook keys');
    jwks = { at: Date.now(), keys: (await res.json()).keys || [] };
  }
  const jwk = jwks.keys.find(k => k.kid === kid);
  if (!jwk) throw new Error('Unknown Facebook key');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

const looksLikeJwt = (t) => typeof t === 'string' && t.split('.').length === 3;

/** Returns { id, name, email, picture } or throws. */
async function verifyLimitedToken(token, appId) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Invalid token');
  const key = await keyFor(decoded.header.kid);
  const p = jwt.verify(token, key, { algorithms: ['RS256'], audience: String(appId), issuer: ISSUERS });
  if (!p.sub) throw new Error('Invalid token');
  return { id: String(p.sub), name: p.name || '', email: p.email || undefined, picture: p.picture || '' };
}

module.exports = { verifyLimitedToken, looksLikeJwt };
