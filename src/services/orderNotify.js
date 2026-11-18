// Everything that should happen when an order is placed or changes status:
// in-app + push notifications and emails, for the customer and the shop team.
// Never throws: a failed email must not break the order.
const User = require('../models/User');
const { notifyUser } = require('./notify');
const { sendEmail, orderEmail, adminOrderEmail, money, orderNo } = require('./mailer');

const langOf = (u) => (['fr', 'en', 'ar'].includes(u?.language) ? u.language : 'fr');
const fill = (ml, vars) => Object.fromEntries(Object.entries(ml).map(([k, v]) =>
  [k, Object.entries(vars).reduce((s, [a, b]) => s.replaceAll(`{${a}}`, b), v)]));

const MSG = {
  received: {
    title: { fr: 'Commande reçue 🛒', en: 'Order received 🛒', ar: 'تم استلام طلبك 🛒' },
    body:  { fr: 'Votre commande #{n} ({total}) est bien reçue. Nous vous contactons pour la livraison.',
             en: 'Your order #{n} ({total}) has been received. We will contact you about delivery.',
             ar: 'تم استلام طلبك #{n} ({total}). سنتواصل معك بخصوص التوصيل.' },
  },
  confirmed: {
    title: { fr: 'Commande confirmée ✅', en: 'Order confirmed ✅', ar: 'تم تأكيد طلبك ✅' },
    body:  { fr: 'Votre commande #{n} est confirmée. Nous vous contacterons pour la livraison.',
             en: 'Your order #{n} is confirmed. We will contact you about delivery.',
             ar: 'تم تأكيد طلبك #{n}. سنتواصل معك بخصوص التوصيل.' },
  },
  delivered: {
    title: { fr: 'Commande livrée 📦', en: 'Order delivered 📦', ar: 'تم تسليم طلبك 📦' },
    body:  { fr: 'Votre commande #{n} a été livrée. Merci pour votre confiance !',
             en: 'Your order #{n} has been delivered. Thank you!',
             ar: 'تم تسليم طلبك #{n}. شكراً لثقتك!' },
  },
  cancelled: {
    title: { fr: 'Commande annulée', en: 'Order cancelled', ar: 'تم إلغاء الطلب' },
    body:  { fr: 'Votre commande #{n} a été annulée. Contactez-nous pour toute question.',
             en: 'Your order #{n} was cancelled. Contact us if you have any questions.',
             ar: 'تم إلغاء طلبك #{n}. تواصل معنا لأي استفسار.' },
  },
};

async function customerOf(order) {
  if (!order.user?.userId) return null;
  return User.findById(order.user.userId).select('name email language fcmTokens notifyPush');
}

async function emailCustomer(order, kind, user) {
  const to = user?.email;
  if (!to) return false;
  const m = orderEmail(order, kind, langOf(user));
  return m ? (await sendEmail({ to, ...m })).sent : false;
}

/** Shop team: ADMIN_EMAILS if set, otherwise every admin account's email. */
async function adminEmails() {
  const env = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (env.length) return env;
  return (await User.find({ role: 'admin', email: { $type: 'string' } }).select('email').lean()).map(u => u.email);
}

async function onOrderPlaced(order) {
  try {
    const n = orderNo(order);
    const vars = { n, total: money(order.totalPrice) };

    // Customer
    const user = await customerOf(order);
    if (user) {
      await notifyUser(user, { type: 'order', title: MSG.received.title, body: fill(MSG.received.body, vars),
        data: { orderId: String(order._id) } });
      await emailCustomer(order, 'received', user);
    }

    // Shop team: in-app + push for admin accounts, email to the team
    const admins = await User.find({ role: 'admin' }).select('name email language fcmTokens notifyPush');
    const count = (order.products || []).reduce((s, p) => s + (p.quantity || 1), 0);
    for (const a of admins) {
      await notifyUser(a, {
        type: 'admin',
        title: `🛒 Nouvelle commande #${n}`,
        body: `${order.user?.name || ''} · ${count} article(s) · ${money(order.totalPrice)} · ${order.user?.phone || ''}`,
        data: { orderId: String(order._id), admin: '1' },
      });
    }
    const to = await adminEmails();
    if (to.length) await sendEmail({ to, ...adminOrderEmail(order) });
  } catch (err) {
    console.error('onOrderPlaced error:', err.message);
  }
}

async function onOrderStatus(order) {
  try {
    const msg = MSG[order.status];
    if (!msg) return;
    const user = await customerOf(order);
    if (!user) return;
    const vars = { n: orderNo(order), total: money(order.totalPrice) };
    await notifyUser(user, { type: 'order', title: msg.title, body: fill(msg.body, vars),
      data: { orderId: String(order._id) } });
    await emailCustomer(order, order.status, user);
  } catch (err) {
    console.error('onOrderStatus error:', err.message);
  }
}

module.exports = { onOrderPlaced, onOrderStatus };
