// Create in-app notifications and send them by push and/or email.
// Titles/bodies can be plain strings or { fr, en, ar } — each user gets their language.
const User         = require('../models/User');
const Notification = require('../models/Notification');
const { sendPush } = require('./push');
const { sendEmail, welcomeEmail, messageEmail, SITE_URL } = require('./mailer');

const pick = (v, lang) => (v && typeof v === 'object' ? (v[lang] || v.fr || v.en || '') : (v || ''));
const langOf = (u) => (['fr', 'en', 'ar'].includes(u?.language) ? u.language : 'fr');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function pushToUser(user, msg) {
  if (!user.notifyPush || !user.fcmTokens?.length) return 0;
  try {
    const { sent, invalidTokens } = await sendPush(user.fcmTokens, msg);
    if (invalidTokens.length) {
      await User.updateOne({ _id: user._id }, { $pull: { fcmTokens: { $in: invalidTokens } } });
    }
    return sent;
  } catch (err) {
    console.error('Push error:', err.message);
    return 0;
  }
}

/**
 * Notify one user. channels: { inApp=true, push=true, email=false }.
 * Never throws — notification problems must not break the action that caused them.
 */
async function notifyUser(userOrId, { type = 'announcement', title, body = '', data = {}, ctaPath }, channels = {}) {
  const { inApp = true, push = true, email = false } = channels;
  try {
    // A full User document, or just an id (note: an ObjectId also has `._id`)
    const user = userOrId instanceof User ? userOrId
      : await User.findById(userOrId).select('name email language fcmTokens notifyPush');
    if (!user) return { inApp: 0, push: 0, email: 0 };
    const lang = langOf(user);
    const t = pick(title, lang).slice(0, 140);
    const b = pick(body, lang).slice(0, 2000);
    const out = { inApp: 0, push: 0, email: 0 };

    if (inApp) {
      const n = await Notification.create({ user: user._id, type, title: t, body: b, data });
      out.inApp = 1;
      data = { ...data, notificationId: String(n._id) };
    }
    if (push) out.push = await pushToUser(user, { title: t, body: b, data: { type, ...data } });
    if (email && user.email) {
      const m = messageEmail({ lang, title: t, body: b, ctaLabel: 'IP ElectroLab', ctaUrl: `${SITE_URL()}${ctaPath || '/'}` });
      out.email = (await sendEmail({ to: user.email, ...m })).sent ? 1 : 0;
    }
    return out;
  } catch (err) {
    console.error('notifyUser error:', err.message);
    return { inApp: 0, push: 0, email: 0 };
  }
}

/**
 * Admin announcement to many users. In-app + push are done before returning;
 * emails go out in the background (paced so the email provider's rate limit isn't hit).
 */
async function notifyMany(filter, { title, body, data = {} }, channels = {}) {
  const { inApp = true, push = true, email = false } = channels;
  const users = await User.find(filter).select('name email language fcmTokens notifyPush');
  const out = { users: users.length, inApp: 0, push: 0, emailQueued: 0 };

  if (inApp && users.length) {
    const docs = users.map(u => ({
      user: u._id, type: 'announcement',
      title: pick(title, langOf(u)).slice(0, 140), body: pick(body, langOf(u)).slice(0, 2000), data,
    }));
    out.inApp = (await Notification.insertMany(docs)).length;
  }
  if (push) {
    for (const u of users) out.push += await pushToUser(u, {
      title: pick(title, langOf(u)), body: pick(body, langOf(u)), data: { type: 'announcement', ...data },
    });
  }
  if (email) {
    const withEmail = users.filter(u => u.email);
    out.emailQueued = withEmail.length;
    (async () => {
      let ok = 0;
      for (const u of withEmail) {
        const lang = langOf(u);
        const m = messageEmail({ lang, title: pick(title, lang), body: pick(body, lang), ctaLabel: 'IP ElectroLab', ctaUrl: SITE_URL() });
        if ((await sendEmail({ to: u.email, ...m })).sent) ok++;
        await sleep(600);
      }
      console.log(`📧 Announcement emails sent: ${ok}/${withEmail.length}`);
    })().catch(err => console.error('Announcement email error:', err.message));
  }
  return out;
}

/**
 * Welcome: one in-app welcome item per account, plus the welcome email.
 * The email is retried on later sign-ins until it actually goes out
 * (e.g. before BREVO_API_KEY was configured).
 */
async function welcomeUser(user) {
  try {
    const lang = langOf(user);
    if (!(await Notification.exists({ user: user._id, type: 'welcome' }))) {
      await Notification.create({
        user: user._id, type: 'welcome',
        title: { fr: 'Bienvenue chez IP ElectroLab 👋', en: 'Welcome to IP ElectroLab 👋', ar: 'مرحباً بك في IP ElectroLab 👋' }[lang],
        body: {
          fr: 'Découvrez nos composants, tutoriels gratuits et l\'assistant IA. Vous ne trouvez pas un produit ? Demandez-le !',
          en: 'Explore our components, free tutorials and AI assistant. Can\'t find a product? Request it!',
          ar: 'اكتشف مكوناتنا ودروسنا المجانية والمساعد الذكي. لم تجد منتجاً؟ اطلبه!',
        }[lang],
      });
    }
    if (user.email && !user.welcomeEmailSentAt) {
      const r = await sendEmail({ to: user.email, ...welcomeEmail(user) });
      if (r.sent) await User.updateOne({ _id: user._id }, { $set: { welcomeEmailSentAt: new Date() } });
    }
  } catch (err) {
    console.error('Welcome error:', err.message);
  }
}

module.exports = { notifyUser, notifyMany, welcomeUser };
