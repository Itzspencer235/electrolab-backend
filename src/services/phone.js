// Phone numbers are stored in one format so "+235 66 00 00 00" and
// "+23566000000" are the same account: optional leading +, digits only.
function normalizePhone(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  const plus = s.startsWith('+') ? '+' : '';
  const digits = s.replace(/[^\d]/g, '');
  if (digits.length < 6 || digits.length > 16) return null;
  return plus + digits;
}

module.exports = { normalizePhone };
