const Tutorial = require('../models/Tutorial');

const loc = (f, lang) => {
  if (!f) return '';
  if (typeof f === 'string') return f;
  return f[lang] || f.fr || f.en || f.ar || '';
};

// Helper — works with BOTH old schema (productId) and new schema (product)
function _mapComponent(c, lang) {
  // Support both old field name (productId) and new field name (product)
  const pop = c.product || c.productId;

  // Name: try component's own name field first, then populated product name
  const name =
    loc(c.name, lang) ||
    (pop && typeof pop === 'object' ? loc(pop.name, lang) : '') ||
    '';

  // Product ID for Flutter navigation
  const productId =
    (pop && typeof pop === 'object' ? pop._id?.toString() : '') ||
    (pop && typeof pop === 'string' ? pop : '') ||
    c.product?.toString() ||
    c.productId?.toString() ||
    '';

  return {
    _id:      c._id,
    name,
    product:  productId,
    imageUrl: (pop && typeof pop === 'object' ? pop.imageUrl : '') || c.imageUrl || '',
    category: (pop && typeof pop === 'object' ? pop.category : '') || c.category || '',
    price:    (pop && typeof pop === 'object' ? pop.price    : 0)  || c.price    || 0,
    stock:    (pop && typeof pop === 'object' ? pop.stock    : 0)  || 0,
    quantity: c.quantity || 1,
  };
}

// ── GET all tutorials ──────────────────────────────────────────────────────────

exports.getTutorials = async (req, res) => {
  try {
    const lang     = req.query.lang     || 'fr';
    const level    = req.query.level    || null;
    const category = req.query.category || null;

    const filter = {};
    if (level)    filter.level    = level;
    if (category) filter.category = category;

    // Try to populate both field names — old and new schema
    let tutorials;
    try {
      tutorials = await Tutorial.find(filter)
        .populate('components.product',   'name price imageUrl category')
        .populate('components.productId', 'name price imageUrl category')
        .sort({ createdAt: -1 });
    } catch (_) {
      // If populate fails, load without populate
      tutorials = await Tutorial.find(filter).sort({ createdAt: -1 });
    }

    const result = tutorials.map(t => ({
      _id:        t._id,
      title:      loc(t.title, lang),
      description:loc(t.description, lang),
      level:      t.level,
      category:   t.category,
      imageUrl:   t.imageUrl,
      youtubeUrl: t.youtubeUrl,
      duration:   t.duration,
      views:      t.views,
      components: (t.components || []).map(c => _mapComponent(c, lang)),
      createdAt:  t.createdAt,
    }));

    res.json(result);
  } catch (err) {
    console.error('getTutorials error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── GET single tutorial ────────────────────────────────────────────────────────

exports.getTutorial = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';

    let t;
    try {
      t = await Tutorial.findById(req.params.id)
        .populate('components.product',   'name price imageUrl category stock')
        .populate('components.productId', 'name price imageUrl category stock');
    } catch (_) {
      t = await Tutorial.findById(req.params.id);
    }

    if (!t) return res.status(404).json({ message: 'Tutoriel introuvable' });

    // Increment views silently
    Tutorial.findByIdAndUpdate(req.params.id,
        { $inc: { views: 1 } }).exec().catch(() => {});

    res.json({
      _id:          t._id,
      title:        loc(t.title, lang),
      description:  loc(t.description, lang),
      content:      loc(t.content, lang),
      level:        t.level,
      category:     t.category,
      imageUrl:     t.imageUrl    || '',
      youtubeUrl:   t.youtubeUrl  || '',
      images:       t.images      || [],
      duration:     t.duration    || 0,
      views:        t.views       || 0,
      codeSnippet:  t.codeSnippet  || '',
      codeLanguage: t.codeLanguage || 'cpp',
      steps: (t.steps || []).map(s => ({
        title:   s.title   || '',
        content: s.content || '',
      })),
      components: (t.components || []).map(c => _mapComponent(c, lang)),
      createdAt: t.createdAt,
    });
  } catch (err) {
    console.error('getTutorial error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── CREATE tutorial ────────────────────────────────────────────────────────────

exports.createTutorial = async (req, res) => {
  try {
    const b = req.body;

    const tutorial = new Tutorial({
      title: {
        fr: b.title?.fr || '',
        en: b.title?.en || b.title?.fr || '',
        ar: b.title?.ar || b.title?.fr || '',
      },
      description: {
        fr: b.description?.fr || '',
        en: b.description?.en || '',
        ar: b.description?.ar || '',
      },
      content: {
        fr: b.content?.fr || '',
        en: b.content?.en || '',
        ar: b.content?.ar || '',
      },
      level:        b.level        || 'beginner',
      category:     b.category     || 'General',
      imageUrl:     b.imageUrl     || '',
      youtubeUrl:   b.youtubeUrl   || '',
      images:       b.images       || [],
      codeSnippet:  b.codeSnippet  || '',
      codeLanguage: b.codeLanguage || 'cpp',
      duration:     Number(b.duration) || 0,
      steps: (b.steps || []).map(s => ({
        title:   s.title   || '',
        content: s.content || '',
      })),
      // Support both old (productId) and new (product) field names from Flutter
      components: (b.components || []).map(c => {
        const ref = c.product || c.productId;
        return {
          // Store name as multilang object
          name: typeof c.name === 'string'
            ? { fr: c.name, en: c.name, ar: c.name }
            : {
                fr: c.name?.fr || '',
                en: c.name?.en || c.name?.fr || '',
                ar: c.name?.ar || c.name?.fr || '',
              },
          // Store with new field name 'product'
          product:  ref || undefined,
          imageUrl: c.imageUrl || '',
          category: c.category || '',
          price:    Number(c.price)    || 0,
          quantity: Number(c.quantity) || 1,
        };
      }),
    });

    await tutorial.save();
    res.status(201).json(tutorial);
  } catch (err) {
    console.error('createTutorial error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

// ── UPDATE tutorial ────────────────────────────────────────────────────────────

exports.updateTutorial = async (req, res) => {
  try {
    const b = req.body;

    const updated = await Tutorial.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          title:        b.title,
          description:  b.description,
          content:      b.content,
          level:        b.level,
          category:     b.category,
          imageUrl:     b.imageUrl     || '',
          youtubeUrl:   b.youtubeUrl   || '',
          images:       b.images       || [],
          codeSnippet:  b.codeSnippet  || '',
          codeLanguage: b.codeLanguage || 'cpp',
          duration:     Number(b.duration) || 0,
          steps: (b.steps || []).map(s => ({
            title:   s.title   || '',
            content: s.content || '',
          })),
          components: (b.components || []).map(c => {
            const ref = c.product || c.productId;
            return {
              name: typeof c.name === 'string'
                ? { fr: c.name, en: c.name, ar: c.name }
                : {
                    fr: c.name?.fr || '',
                    en: c.name?.en || c.name?.fr || '',
                    ar: c.name?.ar || c.name?.fr || '',
                  },
              product:  ref || undefined,
              imageUrl: c.imageUrl || '',
              category: c.category || '',
              price:    Number(c.price)    || 0,
              quantity: Number(c.quantity) || 1,
            };
          }),
        },
      },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error('updateTutorial error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

// ── DELETE tutorial ────────────────────────────────────────────────────────────

exports.deleteTutorial = async (req, res) => {
  try {
    await Tutorial.findByIdAndDelete(req.params.id);
    res.json({ message: 'Tutoriel supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};