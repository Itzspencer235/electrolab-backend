const Product = require('../models/Product');
const { activeSales, priceInfo } = require('../services/pricing');

// Discount fields every product response carries (price = original price)
const pricing = (p, sales, lang) => {
  const i = priceInfo(p, sales);
  return {
    price: i.price, finalPrice: i.finalPrice,
    discountPercent: i.discountPercent, discountEndsAt: i.discountEndsAt,
    saleTitle: i.saleTitle ? (i.saleTitle[lang] || i.saleTitle.fr || '') : '',
  };
};

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

    const [products, sales] = await Promise.all([Product.find(filter), activeSales()]);
    const result = products.map(p => ({
      _id:      p._id,
      name:     localize(p.name, lang),   // ← was `loc()` — typo crashing the route
      description: localize(p.description, lang),
      ...pricing(p, sales, lang),
      category: p.category,
      stock:    p.stock,
      imageUrl: p.imageUrl,
      images:   p.images,
    }));
    res.json(result);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const [p, sales] = await Promise.all([Product.findById(req.params.id), activeSales()]);
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
      ...pricing(p, sales, lang),
      category:         p.category,
      stock:            p.stock,
      imageUrl:         p.imageUrl || '',
      images:           p.images || [],
      circuitImages:    p.circuitImages || [],
    });
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};
