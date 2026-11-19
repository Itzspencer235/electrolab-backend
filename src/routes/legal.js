// Public pages the App Store and Google Play ask for:
//   /privacy         — privacy policy (link it in both store listings)
//   /delete-account  — how to delete an account (Google Play "Data deletion" URL)
// ?lang=fr|en|ar picks the language (default French).
const router = require('express').Router();

const CONTACT_EMAIL = () => process.env.EMAIL_REPLY_TO || 'contact@ipelectrolab.com';
const WHATSAPP      = () => (process.env.CONTACT_WHATSAPP || '+23566823123').trim();
const UPDATED       = '2026-11-19';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const L = (q) => (['fr', 'en', 'ar'].includes(q) ? q : 'fr');

function page(lang, title, sections, path) {
  const langLinks = ['fr', 'en', 'ar']
    .map(l => `<a href="${path}?lang=${l}"${l === lang ? ' aria-current="page"' : ''}>${{ fr: 'Français', en: 'English', ar: 'العربية' }[l]}</a>`)
    .join(' · ');
  const body = sections.map(([h, items]) =>
    `<h2>${esc(h)}</h2>${items.map(p => Array.isArray(p)
      ? `<ul>${p.map(li => `<li>${li}</li>`).join('')}</ul>`
      : `<p>${p}</p>`).join('')}`).join('');
  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · IP ElectroLab</title>
<style>
:root{color-scheme:light dark;--bg:#f6f8fc;--card:#fff;--text:#14213d;--sub:#5b6478;--accent:#1d4ed8}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#111a2e;--text:#e6ebf5;--sub:#9aa6bd;--accent:#7aa2ff}}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}
.card{background:var(--card);border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.1rem;margin:28px 0 8px}
.meta,.langs{color:var(--sub);font-size:.9rem}.langs{margin-bottom:16px}
a{color:var(--accent)}a[aria-current]{font-weight:700;text-decoration:none}
li{margin:4px 0}
</style></head>
<body><main><div class="langs">${langLinks}</div><div class="card">
<h1>${esc(title)}</h1><div class="meta">IP ElectroLab · ${UPDATED}</div>
${body}
</div></main></body></html>`;
}

const contactLine = (lang) => {
  const mail = `<a href="mailto:${esc(CONTACT_EMAIL())}">${esc(CONTACT_EMAIL())}</a>`;
  const wa   = `<a href="https://wa.me/${WHATSAPP().replace(/[^\d]/g, '')}">WhatsApp ${esc(WHATSAPP())}</a>`;
  return { fr: `Email : ${mail} · ${wa}`, en: `Email: ${mail} · ${wa}`, ar: `البريد: ${mail} · ${wa}` }[lang];
};

const PRIVACY = {
  fr: (c) => ['Politique de confidentialité', [
    ['Qui sommes-nous', ['IP ElectroLab est une boutique d\'électronique à N\'Djamena (Tchad). Cette politique couvre l\'application mobile IP ElectroLab et le site web.', c]],
    ['Données que nous collectons', [[
      '<b>Compte</b> : nom, email et/ou numéro de téléphone, mot de passe (chiffré), photo de profil si vous en ajoutez une.',
      '<b>Connexion Google, Facebook ou Apple</b> : nom, email et photo fournis par ce service. Avec Apple, vous pouvez masquer votre email.',
      '<b>Commandes</b> : produits, nom, téléphone et lieu de livraison.',
      '<b>Demandes de produits</b> : description et photo que vous envoyez.',
      '<b>Panier et favoris</b>, enregistrés sur votre compte.',
      '<b>Notifications</b> : un identifiant technique de l\'appareil pour vous envoyer des notifications, si vous les acceptez.',
      '<b>Assistant IA</b> : les messages que vous écrivez à l\'assistant.',
    ]]],
    ['Ce que nous ne faisons pas', [[
      'Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité.',
      'Nous ne vous suivons pas dans d\'autres applications ou sites.',
      'Le verrouillage par empreinte / Face ID reste sur votre téléphone : nous ne recevons jamais vos données biométriques.',
    ]]],
    ['Pourquoi nous les utilisons', [[
      'Créer et gérer votre compte, traiter et livrer vos commandes.',
      'Répondre à vos demandes de produits et à vos messages.',
      'Vous envoyer des notifications (commandes, réponses, annonces) — désactivables dans Paramètres.',
    ]]],
    ['Services tiers', ['Ces prestataires traitent des données pour nous :', [
      'Google (connexion Google, Firebase Cloud Messaging pour les notifications, Gemini pour l\'assistant IA)',
      'Meta (connexion Facebook) · Apple (Sign in with Apple)',
      'MongoDB Atlas (base de données) · Render (serveur) · Cloudinary (images) · Resend (emails)',
    ]]],
    ['Durée de conservation', ['Vos données sont conservées tant que votre compte existe. Quand vous le supprimez, nous effaçons le compte, le panier, les favoris, les notifications et les demandes de produits. Les commandes passées sont conservées pour la comptabilité de la boutique, sans lien avec votre compte.']],
    ['Vos droits et suppression du compte', [`Vous pouvez consulter et modifier vos informations dans l\'application (Profil). Pour supprimer votre compte : Paramètres → Supprimer mon compte. Sans l\'application : voir <a href="/delete-account?lang=fr">cette page</a>.`]],
    ['Enfants', ['L\'application ne s\'adresse pas aux enfants de moins de 13 ans.']],
    ['Contact', [c]],
  ]],
  en: (c) => ['Privacy Policy', [
    ['Who we are', ['IP ElectroLab is an electronics shop in N\'Djamena, Chad. This policy covers the IP ElectroLab mobile app and website.', c]],
    ['Data we collect', [[
      '<b>Account</b>: name, email and/or phone number, password (encrypted), profile photo if you add one.',
      '<b>Google, Facebook or Apple sign-in</b>: name, email and photo given by that service. With Apple you can hide your email.',
      '<b>Orders</b>: products, name, phone and delivery location.',
      '<b>Product requests</b>: the description and photo you send.',
      '<b>Cart and wishlist</b>, saved to your account.',
      '<b>Notifications</b>: a technical device identifier to send you notifications, if you allow them.',
      '<b>AI assistant</b>: the messages you write to the assistant.',
    ]]],
    ['What we don\'t do', [[
      'We do not sell your data or use it for advertising.',
      'We do not track you across other apps or websites.',
      'Fingerprint / Face ID app lock stays on your phone: we never receive biometric data.',
    ]]],
    ['Why we use it', [[
      'To create and run your account, and to process and deliver your orders.',
      'To answer your product requests and messages.',
      'To send you notifications (orders, replies, announcements) — you can turn them off in Settings.',
    ]]],
    ['Third-party services', ['These providers process data for us:', [
      'Google (Google sign-in, Firebase Cloud Messaging for notifications, Gemini for the AI assistant)',
      'Meta (Facebook login) · Apple (Sign in with Apple)',
      'MongoDB Atlas (database) · Render (server) · Cloudinary (images) · Resend (email)',
    ]]],
    ['How long we keep it', ['We keep your data while your account exists. When you delete it, we erase the account, cart, wishlist, notifications and product requests. Past orders are kept for the shop\'s accounting, no longer linked to your account.']],
    ['Your rights and account deletion', [`You can see and edit your information in the app (Profile). To delete your account: Settings → Delete my account. Without the app: see <a href="/delete-account?lang=en">this page</a>.`]],
    ['Children', ['The app is not meant for children under 13.']],
    ['Contact', [c]],
  ]],
  ar: (c) => ['سياسة الخصوصية', [
    ['من نحن', ['IP ElectroLab متجر إلكترونيات في إنجامينا، تشاد. تشمل هذه السياسة تطبيق IP ElectroLab والموقع الإلكتروني.', c]],
    ['البيانات التي نجمعها', [[
      '<b>الحساب</b>: الاسم، البريد و/أو رقم الهاتف، كلمة المرور (مشفّرة)، صورة الملف الشخصي إن أضفتها.',
      '<b>تسجيل الدخول عبر Google أو Facebook أو Apple</b>: الاسم والبريد والصورة من تلك الخدمة. مع Apple يمكنك إخفاء بريدك.',
      '<b>الطلبات</b>: المنتجات، الاسم، الهاتف ومكان التوصيل.',
      '<b>طلبات المنتجات</b>: الوصف والصورة التي ترسلها.',
      '<b>السلة والمفضلة</b> المحفوظة في حسابك.',
      '<b>الإشعارات</b>: معرّف تقني للجهاز لإرسال الإشعارات إذا سمحت بها.',
      '<b>المساعد الذكي</b>: الرسائل التي تكتبها للمساعد.',
    ]]],
    ['ما لا نفعله', [[
      'لا نبيع بياناتك ولا نستخدمها للإعلانات.',
      'لا نتتبعك في تطبيقات أو مواقع أخرى.',
      'قفل البصمة / Face ID يبقى على هاتفك: لا نستلم أي بيانات بيومترية.',
    ]]],
    ['لماذا نستخدمها', [[
      'لإنشاء حسابك وإدارته، ومعالجة طلباتك وتوصيلها.',
      'للرد على طلبات المنتجات ورسائلك.',
      'لإرسال الإشعارات (الطلبات، الردود، الإعلانات) — يمكن إيقافها من الإعدادات.',
    ]]],
    ['خدمات خارجية', ['يعالج هؤلاء المزوّدون البيانات لصالحنا:', [
      'Google (تسجيل الدخول، Firebase Cloud Messaging للإشعارات، Gemini للمساعد الذكي)',
      'Meta (تسجيل الدخول عبر Facebook) · Apple (Sign in with Apple)',
      'MongoDB Atlas (قاعدة البيانات) · Render (الخادم) · Cloudinary (الصور) · Resend (البريد)',
    ]]],
    ['مدة الاحتفاظ', ['نحتفظ ببياناتك ما دام حسابك موجوداً. عند حذفه نمسح الحساب والسلة والمفضلة والإشعارات وطلبات المنتجات. تُحفظ الطلبات السابقة لمحاسبة المتجر دون ربطها بحسابك.']],
    ['حقوقك وحذف الحساب', [`يمكنك رؤية معلوماتك وتعديلها في التطبيق (الملف الشخصي). لحذف حسابك: الإعدادات ← حذف حسابي. بدون التطبيق: راجع <a href="/delete-account?lang=ar">هذه الصفحة</a>.`]],
    ['الأطفال', ['التطبيق غير موجّه للأطفال دون 13 سنة.']],
    ['تواصل', [c]],
  ]],
};

const DELETION = {
  fr: (c) => ['Supprimer votre compte IP ElectroLab', [
    ['Depuis l\'application', [[
      'Ouvrez l\'application IP ElectroLab et connectez-vous.',
      'Allez dans <b>Paramètres</b> → <b>Supprimer mon compte</b>.',
      'Confirmez. Le compte est supprimé immédiatement.',
    ]]],
    ['Sans l\'application', [`Envoyez-nous une demande depuis l\'email ou le numéro de téléphone de votre compte. Nous supprimons le compte sous 7 jours et vous confirmons la suppression.`, c]],
    ['Ce qui est supprimé', [[
      'Le compte (nom, email, téléphone, mot de passe, photo, connexion Google/Facebook/Apple).',
      'Le panier, les favoris, les notifications et les demandes de produits.',
    ]]],
    ['Ce qui est conservé', ['Les commandes passées (produits, prix, nom, téléphone et lieu de livraison) sont conservées pour la comptabilité de la boutique, sans lien avec un compte.']],
  ]],
  en: (c) => ['Delete your IP ElectroLab account', [
    ['In the app', [[
      'Open the IP ElectroLab app and sign in.',
      'Go to <b>Settings</b> → <b>Delete my account</b>.',
      'Confirm. The account is deleted right away.',
    ]]],
    ['Without the app', ['Send us a request from the email or phone number of your account. We delete the account within 7 days and confirm when it\'s done.', c]],
    ['What is deleted', [[
      'The account (name, email, phone, password, photo, Google/Facebook/Apple link).',
      'Cart, wishlist, notifications and product requests.',
    ]]],
    ['What is kept', ['Past orders (products, prices, name, phone and delivery location) are kept for the shop\'s accounting, not linked to any account.']],
  ]],
  ar: (c) => ['حذف حسابك في IP ElectroLab', [
    ['من التطبيق', [[
      'افتح تطبيق IP ElectroLab وسجّل الدخول.',
      'اذهب إلى <b>الإعدادات</b> ← <b>حذف حسابي</b>.',
      'أكّد. يُحذف الحساب فوراً.',
    ]]],
    ['بدون التطبيق', ['أرسل لنا طلباً من البريد أو رقم الهاتف المرتبط بحسابك. نحذف الحساب خلال 7 أيام ونؤكد لك ذلك.', c]],
    ['ما يُحذف', [[
      'الحساب (الاسم، البريد، الهاتف، كلمة المرور، الصورة، ربط Google/Facebook/Apple).',
      'السلة والمفضلة والإشعارات وطلبات المنتجات.',
    ]]],
    ['ما يُحتفظ به', ['تُحفظ الطلبات السابقة (المنتجات، الأسعار، الاسم، الهاتف ومكان التوصيل) لمحاسبة المتجر دون ربطها بأي حساب.']],
  ]],
};

router.get('/privacy', (req, res) => {
  const lang = L(req.query.lang);
  const [title, sections] = PRIVACY[lang](contactLine(lang));
  res.type('html').send(page(lang, title, sections, '/privacy'));
});

router.get('/delete-account', (req, res) => {
  const lang = L(req.query.lang);
  const [title, sections] = DELETION[lang](contactLine(lang));
  res.type('html').send(page(lang, title, sections, '/delete-account'));
});

module.exports = router;
