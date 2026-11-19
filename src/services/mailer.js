// Email through Brevo (https://www.brevo.com).
// Render env:
//   BREVO_API_KEY    — Brevo → SMTP & API → API Keys (starts with "xkeysib-")
//   EMAIL_FROM       — e.g. "IP ElectroLab <bonjour@yourdomain.com>". The address
//                      must be a verified sender in Brevo (Senders, Domains &
//                      Dedicated IPs → Senders) — a single verified address is enough.
//   EMAIL_REPLY_TO   — where customer replies go (optional, e.g. contact@ipelectrolab.com)
//   SITE_URL         — public website URL used in buttons (optional)
//   CONTACT_WHATSAPP — WhatsApp number shown in emails (optional, default +23566823123)
//   ADMIN_EMAILS     — comma-separated addresses that get "new order" alerts
//                      (optional; default: the email of every admin account)
// RESEND_API_KEY still works as a fallback when BREVO_API_KEY is not set.
const FROM      = () => process.env.EMAIL_FROM || 'IP ElectroLab <contact@ipelectrolab.com>';
const SITE_URL  = () => (process.env.SITE_URL || 'https://ipelectrolab.com').replace(/\/$/, '');
const WHATSAPP  = () => (process.env.CONTACT_WHATSAPP || '+23566823123').trim();
const REPLY_TO  = () => (process.env.EMAIL_REPLY_TO || '').trim();

const provider = () => (process.env.BREVO_API_KEY ? 'brevo' : process.env.RESEND_API_KEY ? 'resend' : null);
const emailConfigured = () => !!provider();

// "Name <email@x.com>" → { name, email }
function parseAddress(v) {
  const m = String(v || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(v || '').trim() };
}

function request({ to, subject, html, text }) {
  const list = Array.isArray(to) ? to : [to];
  if (provider() === 'brevo') {
    const sender = parseAddress(FROM());
    return fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: list.map(email => ({ email })),
        subject,
        htmlContent: html,
        ...(text ? { textContent: text } : {}),
        ...(REPLY_TO() ? { replyTo: parseAddress(REPLY_TO()) } : {}),
      }),
    });
  }
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM(), to: list, subject, html, text,
      ...(REPLY_TO() ? { reply_to: REPLY_TO() } : {}),
    }),
  });
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const L = (lang) => (['fr', 'en', 'ar'].includes(lang) ? lang : 'fr');
const money = (n) => `${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
const orderNo = (o) => String(o._id).slice(-8).toUpperCase();

async function sendEmail({ to, subject, html, text }) {
  if (!emailConfigured()) {
    console.log(`ℹ️  BREVO_API_KEY not set — email "${subject}" not sent`);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const res = await request({ to, subject, html, text });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`❌ Email "${subject}" failed (${provider()} ${res.status}): ${err.slice(0, 300)}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error(`❌ Email "${subject}" failed: ${err.message}`);
    return { sent: false, reason: 'network' };
  }
}

// ── Layout shared by every email ──────────────────────────────────────────────
// Table-based + inline styles so it renders the same in Gmail, Outlook, phones.
const C = { blue: '#1565C0', dark: '#0D47A1', text: '#1A237E', grey: '#5F7280', bg: '#EEF3FB', line: '#E3ECF8' };

function button(label, url, color = C.blue) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="border-radius:12px;background:${color};">
    <a href="${esc(url)}" style="display:inline-block;padding:14px 30px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;border-radius:12px;">${esc(label)}</a>
  </td></tr></table>`;
}

function layout({ lang, preheader = '', heading, sub = '', bodyHtml, badge }) {
  lang = L(lang);
  const rtl = lang === 'ar';
  const align = rtl ? 'right' : 'left';
  const f = {
    fr: { tag: 'Composants électroniques · Tutoriels · Assistant IA', shop: 'Boutique', tuto: 'Tutoriels', contact: 'Contact',
          why: 'Vous recevez cet email car vous avez un compte ou une commande chez IP ElectroLab.' },
    en: { tag: 'Electronic components · Tutorials · AI assistant', shop: 'Shop', tuto: 'Tutorials', contact: 'Contact',
          why: 'You are receiving this email because you have an account or an order with IP ElectroLab.' },
    ar: { tag: 'مكونات إلكترونية · دروس · مساعد ذكي', shop: 'المتجر', tuto: 'الدروس', contact: 'تواصل',
          why: 'تتلقى هذا البريد لأن لديك حساباً أو طلباً لدى IP ElectroLab.' },
  }[lang];
  const wa = WHATSAPP();
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Segoe UI',Roboto,Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
  <!-- Brand -->
  <tr><td style="padding:0 6px 14px;text-align:${align};">
    <span style="font-size:20px;font-weight:900;color:${C.blue};letter-spacing:-0.3px;">IP&nbsp;Electro<span style="color:#F57C00;">Lab</span></span>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(21,101,192,0.10);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <!-- Hero -->
      <tr><td style="background:${C.blue};background-image:linear-gradient(135deg,#1E88E5,${C.blue},${C.dark});padding:34px 32px 30px;text-align:${align};">
        ${badge ? `<div style="display:inline-block;background:rgba(255,255,255,0.18);color:#ffffff;font-size:12px;font-weight:bold;letter-spacing:0.6px;padding:5px 12px;border-radius:20px;margin-bottom:14px;">${esc(badge)}</div>` : ''}
        <div style="color:#ffffff;font-size:26px;font-weight:800;line-height:1.25;">${esc(heading)}</div>
        ${sub ? `<div style="color:#D6E6FB;font-size:15px;line-height:1.5;margin-top:8px;">${esc(sub)}</div>` : ''}
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:30px 32px 34px;color:${C.text};font-size:15px;line-height:1.6;text-align:${align};">
        ${bodyHtml}
      </td></tr>
    </table>
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:22px 12px 0;text-align:center;color:${C.grey};font-size:12.5px;line-height:1.7;">
    <a href="${SITE_URL()}/boutique" style="color:${C.blue};text-decoration:none;font-weight:bold;">${esc(f.shop)}</a> &nbsp;·&nbsp;
    <a href="${SITE_URL()}/tutoriels" style="color:${C.blue};text-decoration:none;font-weight:bold;">${esc(f.tuto)}</a> &nbsp;·&nbsp;
    <a href="${SITE_URL()}/contact" style="color:${C.blue};text-decoration:none;font-weight:bold;">${esc(f.contact)}</a>
    ${wa ? `<br>WhatsApp : <a href="https://wa.me/${esc(wa.replace(/[^\d]/g, ''))}" style="color:${C.grey};">${esc(wa)}</a>` : ''}
    <br>IP ElectroLab · ${esc(f.tag)} · N'Djamena
    <br><span style="color:#9AA9B4;font-size:11.5px;">${esc(f.why)}</span>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

const para = (s, style = '') => `<p style="margin:0 0 14px;${style}">${esc(s)}</p>`;

// ── Welcome ───────────────────────────────────────────────────────────────────
function welcomeEmail(user) {
  const lang = L(user.language);
  const first = ((user.name || '').trim().split(/\s+/)[0] || '').replace(/^./, c => c.toUpperCase());
  const c = {
    fr: {
      subject: `Bienvenue chez IP ElectroLab${first ? `, ${first}` : ''} 👋`,
      pre: 'Votre compte est prêt : boutique, tutoriels gratuits et assistant IA.',
      heading: `Bienvenue${first ? `, ${first}` : ''} !`,
      sub: 'Votre compte IP ElectroLab est prêt.',
      intro: 'Merci de nous avoir rejoints. Voici ce que vous pouvez faire dès maintenant :',
      items: [
        ['🛒', 'Commander vos composants', 'Arduino, ESP32, capteurs, modules GSM… livrés à N\'Djamena, paiement à la livraison.'],
        ['📚', 'Apprendre avec nos tutoriels', 'Des projets pas à pas, gratuits, du débutant à l\'avancé.'],
        ['🤖', 'Demander à l\'assistant IA', 'Câblage, code, choix de composants : réponse en quelques secondes, 24h/24.'],
        ['🔎', 'Demander un produit introuvable', 'Il n\'est pas dans la boutique ? Faites une demande, nous le cherchons pour vous.'],
      ],
      cta: 'Découvrir la boutique', cta2: 'Voir les tutoriels',
      outro: 'Une question ? Répondez simplement à cet email, nous sommes là pour vous aider.',
      sign: 'L\'équipe IP ElectroLab',
    },
    en: {
      subject: `Welcome to IP ElectroLab${first ? `, ${first}` : ''} 👋`,
      pre: 'Your account is ready: shop, free tutorials and an AI assistant.',
      heading: `Welcome${first ? `, ${first}` : ''}!`,
      sub: 'Your IP ElectroLab account is ready.',
      intro: 'Thanks for joining us. Here is what you can do right away:',
      items: [
        ['🛒', 'Order your components', 'Arduino, ESP32, sensors, GSM modules… delivered in N\'Djamena, cash on delivery.'],
        ['📚', 'Learn with our tutorials', 'Free step-by-step projects, from beginner to advanced.'],
        ['🤖', 'Ask the AI assistant', 'Wiring, code, choosing parts: answers in seconds, 24/7.'],
        ['🔎', 'Request a missing product', 'Not in the shop? Send a request and we\'ll look for it.'],
      ],
      cta: 'Visit the shop', cta2: 'See the tutorials',
      outro: 'Questions? Just reply to this email, we\'re happy to help.',
      sign: 'The IP ElectroLab team',
    },
    ar: {
      subject: 'مرحباً بك في IP ElectroLab 👋',
      pre: 'حسابك جاهز: المتجر والدروس المجانية والمساعد الذكي.',
      heading: `مرحباً${first ? ` ${first}` : ''}!`,
      sub: 'حسابك في IP ElectroLab جاهز.',
      intro: 'شكراً لانضمامك إلينا. إليك ما يمكنك فعله الآن:',
      items: [
        ['🛒', 'اطلب مكوناتك', 'Arduino و ESP32 وحساسات ووحدات GSM… مع التوصيل في نجامينا والدفع عند الاستلام.'],
        ['📚', 'تعلّم مع دروسنا', 'مشاريع مجانية خطوة بخطوة من المبتدئ إلى المتقدم.'],
        ['🤖', 'اسأل المساعد الذكي', 'التوصيل والكود واختيار المكونات: إجابة خلال ثوانٍ على مدار الساعة.'],
        ['🔎', 'اطلب منتجاً غير موجود', 'غير متوفر في المتجر؟ أرسل طلباً وسنبحث عنه لك.'],
      ],
      cta: 'تصفح المتجر', cta2: 'شاهد الدروس',
      outro: 'لديك سؤال؟ رد على هذا البريد ببساطة، نحن هنا لمساعدتك.',
      sign: 'فريق IP ElectroLab',
    },
  }[lang];
  const rtl = lang === 'ar';
  const rows = c.items.map(([icon, title, desc]) => `
    <tr><td style="padding:0 0 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border-radius:16px;">
        <tr>
          <td width="40" style="padding:14px 0 14px ${rtl ? '0' : '16px'};font-size:26px;vertical-align:top;${rtl ? 'padding-right:16px;' : ''}">${icon}</td>
          <td style="padding:14px 16px 14px 10px;">
            <div style="font-weight:800;color:${C.text};font-size:15px;">${esc(title)}</div>
            <div style="color:${C.grey};font-size:13.5px;line-height:1.5;margin-top:2px;">${esc(desc)}</div>
          </td>
        </tr>
      </table>
    </td></tr>`).join('');
  const bodyHtml = `${para(c.intro)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">${rows}</table>
    <div style="margin:24px 0 10px;">${button(c.cta, `${SITE_URL()}/boutique`)}</div>
    <div style="text-align:center;margin-bottom:22px;"><a href="${SITE_URL()}/tutoriels" style="color:${C.blue};font-weight:bold;text-decoration:none;font-size:14px;">${esc(c.cta2)} →</a></div>
    ${para(c.outro, `color:${C.grey};font-size:14px;`)}
    <p style="margin:0;font-weight:bold;">${esc(c.sign)}</p>`;
  return {
    subject: c.subject,
    html: layout({ lang, preheader: c.pre, heading: c.heading, sub: c.sub, bodyHtml }),
    text: `${c.heading}\n${c.sub}\n\n${c.intro}\n${c.items.map(i => `- ${i[1]}: ${i[2]}`).join('\n')}\n\n${c.cta}: ${SITE_URL()}/boutique\n\n${c.outro}\n${c.sign}`,
  };
}

// ── Orders ────────────────────────────────────────────────────────────────────
const ORDER_COPY = {
  received: {
    fr: { badge: 'COMMANDE REÇUE', subject: 'Nous avons bien reçu votre commande #{n}', heading: 'Merci pour votre commande !',
          sub: 'Commande #{n} · nous vous contactons très vite pour confirmer la livraison.',
          intro: 'Bonjour {name}, voici le récapitulatif de votre commande. Le paiement se fait à la livraison.' },
    en: { badge: 'ORDER RECEIVED', subject: 'We received your order #{n}', heading: 'Thank you for your order!',
          sub: 'Order #{n} · we will contact you shortly to confirm delivery.',
          intro: 'Hello {name}, here is the summary of your order. You pay on delivery.' },
    ar: { badge: 'تم استلام الطلب', subject: 'استلمنا طلبك #{n}', heading: 'شكراً على طلبك!',
          sub: 'الطلب #{n} · سنتواصل معك قريباً لتأكيد التوصيل.',
          intro: 'مرحباً {name}، إليك ملخص طلبك. الدفع عند الاستلام.' },
  },
  confirmed: {
    fr: { badge: 'COMMANDE CONFIRMÉE', subject: 'Votre commande #{n} est confirmée ✅', heading: 'Commande confirmée',
          sub: 'Commande #{n} · elle est en préparation.', intro: 'Bonne nouvelle {name} ! Votre commande est confirmée. Nous vous contacterons pour la livraison.' },
    en: { badge: 'ORDER CONFIRMED', subject: 'Your order #{n} is confirmed ✅', heading: 'Order confirmed',
          sub: 'Order #{n} · it is being prepared.', intro: 'Good news {name}! Your order is confirmed. We will contact you about delivery.' },
    ar: { badge: 'تم تأكيد الطلب', subject: 'تم تأكيد طلبك #{n} ✅', heading: 'تم تأكيد الطلب',
          sub: 'الطلب #{n} · قيد التحضير.', intro: 'خبر سار {name}! تم تأكيد طلبك وسنتواصل معك بخصوص التوصيل.' },
  },
  delivered: {
    fr: { badge: 'COMMANDE LIVRÉE', subject: 'Votre commande #{n} a été livrée 📦', heading: 'Commande livrée',
          sub: 'Commande #{n} · merci pour votre confiance !', intro: 'Bonjour {name}, votre commande a été livrée. Bons projets ! Besoin d\'aide pour démarrer ? Nos tutoriels et l\'assistant IA sont là.' },
    en: { badge: 'ORDER DELIVERED', subject: 'Your order #{n} has been delivered 📦', heading: 'Order delivered',
          sub: 'Order #{n} · thank you for your trust!', intro: 'Hello {name}, your order has been delivered. Enjoy building! Need help getting started? Our tutorials and AI assistant are here.' },
    ar: { badge: 'تم التسليم', subject: 'تم تسليم طلبك #{n} 📦', heading: 'تم تسليم الطلب',
          sub: 'الطلب #{n} · شكراً لثقتك!', intro: 'مرحباً {name}، تم تسليم طلبك. مشاريع موفقة! دروسنا والمساعد الذكي متاحون لمساعدتك.' },
  },
  cancelled: {
    fr: { badge: 'COMMANDE ANNULÉE', subject: 'Votre commande #{n} a été annulée', heading: 'Commande annulée',
          sub: 'Commande #{n}', intro: 'Bonjour {name}, votre commande a été annulée. Si c\'est une erreur ou si vous avez une question, répondez à cet email.' },
    en: { badge: 'ORDER CANCELLED', subject: 'Your order #{n} was cancelled', heading: 'Order cancelled',
          sub: 'Order #{n}', intro: 'Hello {name}, your order was cancelled. If this is a mistake or you have a question, just reply to this email.' },
    ar: { badge: 'تم إلغاء الطلب', subject: 'تم إلغاء طلبك #{n}', heading: 'تم إلغاء الطلب',
          sub: 'الطلب #{n}', intro: 'مرحباً {name}، تم إلغاء طلبك. إذا كان ذلك خطأ أو لديك سؤال، رد على هذا البريد.' },
  },
};

const LBL = {
  fr: { items: 'Articles', qty: 'Qté', total: 'Total', pay: 'Paiement à la livraison', delivery: 'Livraison',
        name: 'Nom', phone: 'Téléphone', address: 'Adresse', note: 'Note', track: 'Suivre ma commande',
        steps: ['Reçue', 'Confirmée', 'Livrée'] },
  en: { items: 'Items', qty: 'Qty', total: 'Total', pay: 'Cash on delivery', delivery: 'Delivery',
        name: 'Name', phone: 'Phone', address: 'Address', note: 'Note', track: 'Track my order',
        steps: ['Received', 'Confirmed', 'Delivered'] },
  ar: { items: 'المنتجات', qty: 'الكمية', total: 'المجموع', pay: 'الدفع عند الاستلام', delivery: 'التوصيل',
        name: 'الاسم', phone: 'الهاتف', address: 'العنوان', note: 'ملاحظة', track: 'تتبع طلبي',
        steps: ['تم الاستلام', 'مؤكد', 'تم التسليم'] },
};

function orderDetailsHtml(order, lang, { showSteps = true } = {}) {
  const l = LBL[lang];
  const rtl = lang === 'ar';
  const far = rtl ? 'left' : 'right';
  const lines = (order.products || []).map(p => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.line};color:${C.text};font-size:14px;">${esc(p.name || '—')}
        <span style="color:${C.grey};"> × ${Number(p.quantity) || 1}</span></td>
      <td style="padding:10px 0;border-bottom:1px solid ${C.line};text-align:${far};white-space:nowrap;font-size:14px;font-weight:bold;color:${C.text};">${money((p.price || 0) * (p.quantity || 1))}</td>
    </tr>`).join('');

  const stepIndex = { pending: 0, confirmed: 1, delivered: 2 }[order.status];
  const steps = showSteps && stepIndex !== undefined ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>
      ${l.steps.map((s, i) => `<td align="center" style="width:33%;">
        <div style="width:26px;height:26px;line-height:26px;border-radius:13px;margin:0 auto 6px;font-size:13px;font-weight:bold;
          background:${i <= stepIndex ? C.blue : C.line};color:${i <= stepIndex ? '#fff' : C.grey};">${i < stepIndex || stepIndex === 2 ? '✓' : i + 1}</div>
        <div style="font-size:12px;font-weight:bold;color:${i <= stepIndex ? C.blue : C.grey};">${esc(s)}</div></td>`).join('')}
    </tr></table>` : '';

  const info = (k, v) => v ? `<tr><td style="padding:3px 0;color:${C.grey};font-size:13px;width:110px;vertical-align:top;">${esc(k)}</td>
    <td style="padding:3px 0;color:${C.text};font-size:13.5px;font-weight:600;">${esc(v)}</td></tr>` : '';

  return `${steps}
    <div style="font-size:12px;font-weight:800;letter-spacing:0.8px;color:${C.grey};text-transform:uppercase;margin-bottom:4px;">${esc(l.items)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}
      <tr>
        <td style="padding:14px 0 4px;font-size:16px;font-weight:800;color:${C.text};">${esc(l.total)}</td>
        <td style="padding:14px 0 4px;text-align:${far};font-size:20px;font-weight:900;color:${C.blue};white-space:nowrap;">${money(order.totalPrice)}</td>
      </tr>
      <tr><td colspan="2" style="color:${C.grey};font-size:12.5px;">💵 ${esc(l.pay)}</td></tr>
    </table>
    <div style="background:${C.bg};border-radius:16px;padding:16px 18px;margin:22px 0 0;">
      <div style="font-size:12px;font-weight:800;letter-spacing:0.8px;color:${C.grey};text-transform:uppercase;margin-bottom:6px;">🚚 ${esc(l.delivery)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0">
        ${info(l.name, order.user?.name)}${info(l.phone, order.user?.phone)}${info(l.address, order.user?.location)}${info(l.note, order.note)}
      </table>
    </div>`;
}

/** Email to the customer. kind: received | confirmed | delivered | cancelled */
function orderEmail(order, kind, langIn) {
  const lang = L(langIn);
  const c = ORDER_COPY[kind]?.[lang];
  if (!c) return null;
  const n = orderNo(order);
  const first = ((order.user?.name || '').trim().split(/\s+/)[0] || '');
  const fill = (s) => s.replace('{n}', n).replace('{name}', first);
  const ctaUrl = `${SITE_URL()}/profil?tab=orders`;
  const bodyHtml = `${para(fill(c.intro))}
    ${orderDetailsHtml(order, lang, { showSteps: kind !== 'cancelled' })}
    <div style="margin:26px 0 0;">${button(LBL[lang].track, ctaUrl)}</div>`;
  const lines = (order.products || []).map(p => `- ${p.name} x${p.quantity}: ${money(p.price * p.quantity)}`).join('\n');
  return {
    subject: fill(c.subject),
    html: layout({ lang, preheader: fill(c.sub), heading: c.heading, sub: fill(c.sub), badge: c.badge, bodyHtml }),
    text: `${c.heading}\n${fill(c.sub)}\n\n${fill(c.intro)}\n\n${lines}\n${LBL[lang].total}: ${money(order.totalPrice)}\n\n${LBL[lang].track}: ${ctaUrl}`,
  };
}

/** Alert to the shop team: a new order to handle (always in French). */
function adminOrderEmail(order) {
  const n = orderNo(order);
  const count = (order.products || []).reduce((s, p) => s + (p.quantity || 1), 0);
  const phoneDigits = String(order.user?.phone || '').replace(/[^\d]/g, '');
  const bodyHtml = `${para(`Nouvelle commande de ${order.user?.name || '—'} : ${count} article(s), ${money(order.totalPrice)}.`)}
    ${orderDetailsHtml(order, 'fr', { showSteps: false })}
    <div style="margin:26px 0 10px;">${button('Ouvrir dans l\'admin', `${SITE_URL()}/admin/commandes`)}</div>
    ${phoneDigits ? `<div style="text-align:center;"><a href="https://wa.me/${phoneDigits}" style="color:#1B9E4B;font-weight:bold;text-decoration:none;">💬 Écrire au client sur WhatsApp</a></div>` : ''}`;
  return {
    subject: `🛒 Nouvelle commande #${n} · ${money(order.totalPrice)}`,
    html: layout({ lang: 'fr', preheader: `${order.user?.name} · ${money(order.totalPrice)}`, heading: `Nouvelle commande #${n}`,
      sub: `${order.user?.name || ''} · ${order.user?.phone || ''}`, badge: 'À TRAITER', bodyHtml }),
    text: `Nouvelle commande #${n}\n${order.user?.name} · ${order.user?.phone} · ${order.user?.location}\nTotal: ${money(order.totalPrice)}\n${SITE_URL()}/admin/commandes`,
  };
}

// ── Generic message (admin announcements, request updates) ───────────────────
function messageEmail({ lang = 'fr', title, body, ctaLabel, ctaUrl }) {
  lang = L(lang);
  const bodyHtml = esc(body).split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 14px;">${p.replace(/\n/g, '<br>')}</p>`).join('')
    + (ctaUrl ? `<div style="margin:24px 0 0;">${button(ctaLabel || 'IP ElectroLab', ctaUrl)}</div>` : '');
  return {
    subject: title,
    html: layout({ lang, preheader: String(body || '').slice(0, 120), heading: title, bodyHtml }),
    text: `${title}\n\n${body}${ctaUrl ? `\n\n${ctaUrl}` : ''}`,
  };
}

module.exports = {
  sendEmail, welcomeEmail, messageEmail, orderEmail, adminOrderEmail,
  emailConfigured, SITE_URL, money, orderNo,
};
