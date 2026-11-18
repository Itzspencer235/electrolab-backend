// Email through Resend (https://resend.com).
// Render env:
//   RESEND_API_KEY  — from resend.com → API Keys
//   EMAIL_FROM      — e.g. "IP ElectroLab <bonjour@yourdomain.com>" (needs a verified
//                     domain). Without a domain Resend only delivers to your own
//                     Resend account email, from onboarding@resend.dev.
//   SITE_URL        — public website URL used in email buttons (optional)
const FROM     = () => process.env.EMAIL_FROM || 'IP ElectroLab <onboarding@resend.dev>';
const SITE_URL = () => (process.env.SITE_URL || 'https://ipelectrolab.com').replace(/\/$/, '');

const emailConfigured = () => !!process.env.RESEND_API_KEY;

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function sendEmail({ to, subject, html, text }) {
  if (!emailConfigured()) {
    console.log(`ℹ️  RESEND_API_KEY not set — email "${subject}" not sent`);
    return { sent: false, reason: 'not_configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM(), to: Array.isArray(to) ? to : [to], subject, html, text }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`❌ Email to ${to} failed (${res.status}): ${err.slice(0, 300)}`);
    return { sent: false, reason: `http_${res.status}` };
  }
  return { sent: true };
}

// ── Layout shared by every email (brand blue, works in light/dark clients) ───
function layout({ lang, heading, bodyHtml, cta }) {
  const rtl = lang === 'ar';
  const footer = {
    fr: 'IP ElectroLab · Composants électroniques & tutoriels · N\'Djamena, Tchad',
    en: 'IP ElectroLab · Electronic components & tutorials · N\'Djamena, Chad',
    ar: 'IP ElectroLab · مكونات إلكترونية ودروس · نجامينا، تشاد',
  }[lang] || '';
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#F4F7FF;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FF;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E3F2FD;">
  <tr><td style="background:#1565C0;padding:28px 28px 24px;text-align:${rtl ? 'right' : 'left'};">
    <div style="color:#BBDEFB;font-size:13px;font-weight:bold;letter-spacing:1px;">IP ELECTROLAB</div>
    <div style="color:#ffffff;font-size:24px;font-weight:bold;margin-top:8px;line-height:1.3;">${esc(heading)}</div>
  </td></tr>
  <tr><td style="padding:28px;color:#1A237E;font-size:15px;line-height:1.6;text-align:${rtl ? 'right' : 'left'};">
    ${bodyHtml}
    ${cta ? `<div style="margin-top:28px;text-align:center;">
      <a href="${esc(cta.url)}" style="display:inline-block;background:#1565C0;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;font-size:15px;">${esc(cta.label)}</a>
    </div>` : ''}
  </td></tr>
  <tr><td style="padding:18px 28px;background:#F4F7FF;color:#78909C;font-size:12px;text-align:center;">${esc(footer)}</td></tr>
</table>
</td></tr></table></body></html>`;
}

// ── Welcome ───────────────────────────────────────────────────────────────────
function welcomeEmail(user) {
  const lang = ['fr', 'en', 'ar'].includes(user.language) ? user.language : 'fr';
  const name = esc((user.name || '').split(' ')[0] || '');
  const c = {
    fr: {
      subject: 'Bienvenue chez IP ElectroLab 👋',
      heading: `Bienvenue, ${user.name || ''} !`,
      intro: `Merci d'avoir rejoint IP ElectroLab${name ? `, ${name}` : ''}. Votre compte est prêt.`,
      list: ['🛒 Commandez des composants électroniques livrés à N\'Djamena',
             '📚 Suivez nos tutoriels gratuits Arduino, ESP32 et IoT',
             '🤖 Posez vos questions à notre assistant IA 24h/24',
             '🔎 Vous ne trouvez pas un composant ? Demandez-le, nous le cherchons pour vous'],
      cta: 'Découvrir la boutique',
      outro: 'Une question ? Répondez simplement à cet email ou écrivez-nous sur WhatsApp.',
    },
    en: {
      subject: 'Welcome to IP ElectroLab 👋',
      heading: `Welcome, ${user.name || ''}!`,
      intro: `Thanks for joining IP ElectroLab${name ? `, ${name}` : ''}. Your account is ready.`,
      list: ['🛒 Order electronic components delivered in N\'Djamena',
             '📚 Follow our free Arduino, ESP32 and IoT tutorials',
             '🤖 Ask our AI assistant anything, 24/7',
             '🔎 Can\'t find a component? Request it and we\'ll look for it'],
      cta: 'Visit the shop',
      outro: 'Questions? Just reply to this email or message us on WhatsApp.',
    },
    ar: {
      subject: 'مرحباً بك في IP ElectroLab 👋',
      heading: `مرحباً، ${user.name || ''}!`,
      intro: 'شكراً لانضمامك إلى IP ElectroLab. حسابك جاهز.',
      list: ['🛒 اطلب مكونات إلكترونية مع التوصيل في نجامينا',
             '📚 تابع دروسنا المجانية في Arduino و ESP32 و IoT',
             '🤖 اسأل مساعدنا الذكي على مدار الساعة',
             '🔎 لم تجد مكوناً؟ اطلبه وسنبحث عنه لك'],
      cta: 'تصفح المتجر',
      outro: 'لديك سؤال؟ رد على هذه الرسالة أو راسلنا على واتساب.',
    },
  }[lang];
  const bodyHtml = `<p style="margin:0 0 16px;">${esc(c.intro)}</p>
    <ul style="margin:0;padding-${lang === 'ar' ? 'right' : 'left'}:20px;">
      ${c.list.map(li => `<li style="margin:6px 0;">${esc(li)}</li>`).join('')}
    </ul>
    <p style="margin:20px 0 0;color:#78909C;font-size:13px;">${esc(c.outro)}</p>`;
  return {
    subject: c.subject,
    html: layout({ lang, heading: c.heading, bodyHtml, cta: { label: c.cta, url: `${SITE_URL()}/boutique` } }),
    text: `${c.heading}\n\n${c.intro}\n\n${c.list.join('\n')}\n\n${c.cta}: ${SITE_URL()}/boutique\n\n${c.outro}`,
  };
}

// ── Generic message (admin announcements, order/request updates) ────────────
function messageEmail({ lang = 'fr', title, body, ctaLabel, ctaUrl }) {
  const bodyHtml = esc(body).split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 14px;">${p.replace(/\n/g, '<br>')}</p>`).join('');
  return {
    subject: title,
    html: layout({ lang, heading: title, bodyHtml, cta: ctaUrl ? { label: ctaLabel || 'IP ElectroLab', url: ctaUrl } : null }),
    text: `${title}\n\n${body}${ctaUrl ? `\n\n${ctaUrl}` : ''}`,
  };
}

module.exports = { sendEmail, welcomeEmail, messageEmail, emailConfigured, SITE_URL };
