const Product = require('../models/Product');

// Safe multilang field extractor
const localize = (field, lang) => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.fr || '';
};

exports.getProducts = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const filter = {};
    if (req.query.category) filter.category = req.query.category;

    const products = await Product.find(filter);
    const result = products.map(p => ({
      _id:      p._id,
      name:     localize(p.name, lang),   // ← was `loc()` — typo crashing the route
      description: localize(p.description, lang),
      price:    p.price,
      category: p.category,
      stock:    p.stock,
      imageUrl: p.imageUrl,
      images:   p.images,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Produit introuvable' });
    res.json({
      _id:              p._id,
      name:             localize(p.name, lang),
      description:      localize(p.description, lang),
      workingPrinciple: localize(p.workingPrinciple, lang),
      features:         localize(p.features, lang),
      specifications:   localize(p.specifications, lang),
      applications:     localize(p.applications, lang),
      howToUse:         localize(p.howToUse, lang),
      parameters:       p.parameters || [],
      sampleCode:       p.sampleCode || '',
      codeLanguage:     p.codeLanguage || 'cpp',
      price:            p.price,
      category:         p.category,
      stock:            p.stock,
      imageUrl:         p.imageUrl || '',
      images:           p.images || [],
      circuitImages:    p.circuitImages || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
