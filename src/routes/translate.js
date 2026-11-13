const router = require('express').Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { adminMiddleware } = require('../middleware/auth');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const LANGS = ['fr', 'en', 'ar'];

// POST /api/translate  { text, sourceLang, fieldContext } → { fr, en, ar }
// Admin-only, so the Gemini key stays on the server (used by the web admin).
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const text         = (req.body?.text || '').toString().trim();
    const sourceLang   = LANGS.includes(req.body?.sourceLang) ? req.body.sourceLang : 'fr';
    const fieldContext = (req.body?.fieldContext || 'text').toString().slice(0, 100);
    if (!text)              return res.status(400).json({ message: 'Text required' });
    if (text.length > 8000) return res.status(400).json({ message: 'Text too long' });

    const prompt = `You are a professional translator specialising in electronics and maker/DIY content.

Translate the following "${fieldContext}" text into French, English, and Arabic.
The source language is: ${sourceLang}.
Return ONLY a valid JSON object with exactly three keys: "fr", "en", "ar".
No markdown, no backticks, no explanation — just the raw JSON.

Text to translate:
"""
${text}
"""`;

    const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    const raw   = result.response.text().replace(/```json\s*|```/g, '').trim();
    const json  = JSON.parse(raw);
    const out   = {};
    for (const l of LANGS) out[l] = (json[l] || '').toString();
    out[sourceLang] = out[sourceLang] || text; // never lose the source text
    res.json(out);
  } catch (err) {
    console.error('Translate error:', err.message);
    res.status(502).json({ message: 'Translation failed' });
  }
});

module.exports = router;
