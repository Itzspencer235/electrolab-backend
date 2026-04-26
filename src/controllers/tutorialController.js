const Tutorial = require('../models/Tutorial');

exports.getTutorials = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const tutorials = await Tutorial.find().populate('components', 'name price imageUrl');

    const localized = tutorials.map(t => ({
      _id:         t._id,
      title:       t.title[lang]   || t.title.fr,
      content:     t.content[lang] || t.content.fr,
      level:       t.level,
      imageUrl:    t.imageUrl,
      codeSnippet: t.codeSnippet,
      components:  t.components,
    }));

    res.json(localized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTutorial = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const t = await Tutorial.findById(req.params.id).populate('components');
    if (!t) return res.status(404).json({ message: 'Tutorial not found' });

    res.json({
      _id:         t._id,
      title:       t.title[lang]   || t.title.fr,
      content:     t.content[lang] || t.content.fr,
      level:       t.level,
      imageUrl:    t.imageUrl,
      codeSnippet: t.codeSnippet,
      components:  t.components,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createTutorial = async (req, res) => {
  try {
    const tutorial = new Tutorial(req.body);
    await tutorial.save();
    res.status(201).json(tutorial);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};