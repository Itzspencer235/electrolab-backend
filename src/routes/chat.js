const router = require('express').Router();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

router.post('/', async (req, res) => {
  try {
    const { message, lang } = req.body;

    const systemPrompts = {
      fr: "Tu es l'assistant IA de IP ElectroLab, une boutique d'électronique au Tchad. Tu aides les clients avec Arduino, ESP32, capteurs, modules GSM et projets électroniques. Réponds toujours en français.",
      en: "You are the AI assistant of IP ElectroLab, an electronics shop in Chad. Help customers with Arduino, ESP32, sensors, GSM modules and electronics projects. Always reply in English.",
      ar: "أنت المساعد الذكي لـ IP ElectroLab، متجر إلكترونيات في تشاد. ساعد العملاء في Arduino وESP32 والمستشعرات ووحدات GSM ومشاريع الإلكترونيات. أجب دائماً بالعربية.",
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompts[lang] || systemPrompts.fr },
        { role: 'user',   content: message }
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;