const router = require('express').Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
const { chatLimiter } = require('../middleware/security');

const MAX_MESSAGE = 2000;   // characters per message
const MAX_CONTEXT = 1000;   // characters of page context (tutorial / product)

// Initialisation de l'IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// Cache simple pour les produits (évite de saturer la DB)
let _productCache = null;
let _productCacheTime = 0;

async function getProductList() {
  const now = Date.now();
  if (_productCache && (now - _productCacheTime < 5 * 60 * 1000)) {
    return _productCache;
  }
  
  try {
    const products = await Product.find({}, 'name category price stock').limit(40);
    _productCache = products.length > 0
      ? products.map(p => `- ${p.name?.fr || p.name} (${p.category}) : ${p.price} FCFA, Stock: ${p.stock}`).join('\n')
      : 'Aucun produit en stock actuellement.';
    _productCacheTime = now;
    return _productCache;
  } catch (err) {
    console.error("Erreur DB Produits:", err);
    return "Liste des produits indisponible.";
  }
}

// Prompts système par langue
const systemPrompts = {
  fr: (productList) => `Tu es l'assistant IA de IP ElectroLab, boutique d'électronique au Tchad. 🇹🇩
Aide sur: Arduino, ESP32, capteurs, GSM, soudure.
Réponds en FRANÇAIS, de façon concise et pédagogique. 🎓
Code : Utilise des blocs avec commentaires.

Produits disponibles:
${productList}

Si dispo: Mentionne-le et invite à commander via WhatsApp (+23566823123).
Format: Max 3 paragraphes.`,

  en: (productList) => `You are the AI assistant of IP ElectroLab, electronics shop in Chad. 🇹🇩
Help with Arduino, ESP32, sensors, robotics.
Reply in ENGLISH, clearly and concisely.
Code: Use commented blocks.

Available products:
${productList}

If available: Mention it and encourage WhatsApp orders (+23566823123).`,
};

// Route POST principale
router.post('/', chatLimiter, async (req, res) => {
  try {
    const b       = req.body || {};
    const lang    = b.lang === 'en' ? 'en' : 'fr';
    const message = typeof b.message === 'string' ? b.message.trim() : '';
    const context = typeof b.context === 'string' ? b.context.trim().slice(0, MAX_CONTEXT) : '';
    const history = Array.isArray(b.history) ? b.history : [];

    if (!message) {
      return res.status(400).json({ message: 'Message requis' });
    }
    if (message.length > MAX_MESSAGE) {
      return res.status(400).json({ message: 'Message trop long' });
    }

    const productList = await getProductList();
    // The page context comes from the client, so it goes in the user's turn,
    // never in the system instructions.
    const userText = context ? `[${lang === 'en' ? 'Context' : 'Contexte'}: ${context}]\n\n${message}` : message;
    const systemPromptText = systemPrompts[lang](productList);

    // Configuration du modèle
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash', // ✅ Modèle correct
      systemInstruction: {     // ✅ Format corrigé (Object avec parts)
        parts: [{ text: systemPromptText }],
      },
    });

    // Formatage de l'historique pour Gemini
    const chatHistory = history.slice(-10)
      .filter(h => typeof h?.text === 'string' && h.text.trim())
      .map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text.slice(0, MAX_MESSAGE) }],
      }));
    // Gemini requires the history to start with a user turn
    while (chatHistory.length && chatHistory[0].role !== 'user') chatHistory.shift();

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(userText);
    const reply = result.response.text();

    res.json({ reply });

  } catch (err) {
    console.error('❌ Erreur Gemini:', err.message);
    const errorMsg = {
      fr: '❌ Service temporairement indisponible. Réessayez.',
      en: '❌ Service unavailable. Please try again.'
    };
    res.status(500).json({ reply: errorMsg[req.body?.lang === 'en' ? 'en' : 'fr'] });
  }
});

module.exports = router;