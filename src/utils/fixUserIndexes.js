const User = require('../models/User');

// The User schema declares email_1 / phone_1 as unique only when the value is
// a real string (partialFilterExpression). Databases created before that change
// still have the old unique index, which treats a missing phone/email as null —
// so a second Google/Facebook account without a phone fails with
// "E11000 duplicate key ... index: phone_1 dup key: { phone: null }".
// MongoDB never replaces an existing index on its own, so on startup we drop
// any old-style version and let Mongoose create the schema's index.
// Safe to run on every start: once the indexes are correct it changes nothing.
const FIELDS = ['email', 'phone'];

async function fixUserIndexes() {
  let indexes;
  try {
    indexes = await User.collection.indexes();
  } catch (err) {
    if (err.codeName === 'NamespaceNotFound') return; // no users collection yet
    throw err;
  }

  for (const field of FIELDS) {
    const name = `${field}_1`;
    const idx  = indexes.find(i => i.name === name);
    if (!idx) continue;
    const ok = idx.unique && idx.partialFilterExpression?.[field]?.$type === 'string';
    if (ok) continue;
    console.log(`🔧 Replacing outdated users index ${name}`);
    await User.collection.dropIndex(name);
  }

  // Builds any missing schema indexes (including the ones dropped above)
  await User.createIndexes();
  console.log('✅ User indexes OK');
}

module.exports = fixUserIndexes;
