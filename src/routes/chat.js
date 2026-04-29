const router = require('express').Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');

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
  fr: (productList, context) => `Tu es l'assistant IA de IP ElectroLab, boutique d'électronique au Tchad. 🇹🇩
Aide sur: Arduino, ESP32, capteurs, GSM, soudure.
Réponds en FRANÇAIS, de façon concise et pédagogique. 🎓
Code : Utilise des blocs avec commentaires.
${context ? `Contexte: ${context}` : ''}

Produits disponibles:
${productList}

Si dispo: Mentionne-le et invite à commander via WhatsApp (+23566823123).
Format: Max 3 paragraphes.`,

  en: (productList, context) => `You are the AI assistant of IP ElectroLab, electronics shop in Chad. 🇹🇩
Help with Arduino, ESP32, sensors, robotics.
Reply in ENGLISH, clearly and concisely.
Code: Use commented blocks.
${context ? `Context: ${context}` : ''}

Available products:
${productList}

If available: Mention it and encourage WhatsApp orders (+23566823123).`,
};

// Route POST principale
router.post('/', async (req, res) => {
  try {
    const { message, lang = 'fr', history = [], context = null } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message requis' });
    }

    const productList = await getProductList();
    const systemPromptText = (systemPrompts[lang] || systemPrompts.fr)(productList, context);

    // Configuration du modèle
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash', // ✅ Modèle correct
      systemInstruction: {     // ✅ Format corrigé (Object avec parts)
        parts: [{ text: systemPromptText }],
      },
    });

    // Formatage de l'historique pour Gemini
    const chatHistory = history.slice(-10).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    res.json({ reply });

  } catch (err) {
    console.error('❌ Erreur Gemini:', err.message);
    const errorMsg = {
      fr: '❌ Service temporairement indisponible. Réessayez.',
      en: '❌ Service unavailable. Please try again.'
    };
    res.status(500).json({ reply: errorMsg[req.body.lang || 'fr'] });
  }
});

module.exports = router;