// Push notifications through Firebase Cloud Messaging.
// Needs FIREBASE_SERVICE_ACCOUNT on Render: the service-account JSON from
// Firebase console → Project settings → Service accounts → Generate new private key
// (paste the whole JSON, or its base64). Without it, push is skipped (in-app
// notifications still work).
const admin = require('firebase-admin');

let ready = null; // null = not tried yet, false = not configured

function init() {
  if (ready !== null) return ready;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.log('ℹ️  FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
    return (ready = false);
  }
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
    console.log('✅ Firebase push ready');
    return (ready = true);
  } catch (err) {
    console.error('❌ Firebase init failed:', err.message);
    return (ready = false);
  }
}

const INVALID = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Send one notification to several device tokens.
 * Returns { sent, invalidTokens } — the caller removes invalid tokens.
 */
async function sendPush(tokens, { title, body, data = {} }) {
  if (!tokens?.length || !init()) return { sent: 0, invalidTokens: [] };
  const strData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')]));
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: strData,
    android: { priority: 'high', notification: { channelId: 'general', color: '#1565C0' } },
    apns: { payload: { aps: { sound: 'default' } } },
  });
  const invalidTokens = [];
  res.responses.forEach((r, i) => {
    if (!r.success && INVALID.has(r.error?.code)) invalidTokens.push(tokens[i]);
  });
  return { sent: res.successCount, invalidTokens };
}

module.exports = { sendPush, pushConfigured: () => init() };
