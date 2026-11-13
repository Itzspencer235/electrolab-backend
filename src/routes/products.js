const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const { cloudinary } = require('../middleware/upload');
const Product = require('../models/Product');
const { getProducts, getProduct } = require('../controllers/productController');

// ── /categories MUST be first — before both / and /:id ────────────────────
// Express matches top-to-bottom. If /:id appears before this, the string
// "categories" gets treated as a product ID and Mongo returns null.
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.filter(c => c && c.trim() !== '').sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/',    getProducts);

// Admin: the full product with every language (for edit forms)
router.get('/:id/full', adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', getProduct);

router.post('/', adminMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const product = new Product({
      name:             { fr: b.name?.fr, en: b.name?.en || b.name?.fr, ar: b.name?.ar || b.name?.fr },
      description:      { fr: b.description?.fr,      en: b.description?.en,      ar: b.description?.ar },
      workingPrinciple: { fr: b.workingPrinciple?.fr,  en: b.workingPrinciple?.en,  ar: b.workingPrinciple?.ar },
      features:         { fr: b.features?.fr,          en: b.features?.en,          ar: b.features?.ar },
      specifications:   { fr: b.specifications?.fr,    en: b.specifications?.en,    ar: b.specifications?.ar },
      applications:     { fr: b.applications?.fr,      en: b.applications?.en,      ar: b.applications?.ar },
      howToUse:         { fr: b.howToUse?.fr,          en: b.howToUse?.en,          ar: b.howToUse?.ar },
      parameters:       b.parameters  || [],
      sampleCode:       b.sampleCode  || '',
      codeLanguage:     b.codeLanguage || 'cpp',
      price:            Number(b.price) || 0,
      stock:            Number(b.stock) || 0,
      category:         b.category || '',
      imageUrl:         b.imageUrl || '',
      images:           b.images   || [],
      circuitImages:    b.circuitImages || [],
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });
    const update = {
      name:             b.name             || existing.name,
      description:      b.description      || existing.description,
      workingPrinciple: b.workingPrinciple  || existing.workingPrinciple,
      features:         b.features          || existing.features,
      specifications:   b.specifications    || existing.specifications,
      applications:     b.applications      || existing.applications,
      howToUse:         b.howToUse          || existing.howToUse,
      parameters:       b.parameters        ?? existing.parameters,
      sampleCode:       b.sampleCode        ?? existing.sampleCode,
      codeLanguage:     b.codeLanguage      || existing.codeLanguage,
      price:            b.price !== undefined && b.price !== '' ? Number(b.price) || 0 : existing.price,
      stock:            b.stock !== undefined && b.stock !== '' ? Number(b.stock) || 0 : existing.stock,
      category:         b.category          || existing.category,
      imageUrl:         b.imageUrl          ?? existing.imageUrl,
      images:           b.images            ?? existing.images,
      circuitImages:    b.circuitImages      ?? existing.circuitImages,
    };
    const product = await Product.findByIdAndUpdate(
        req.params.id, update, { new: true });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Not found' });
    if (product.cloudinaryId) {
      await cloudinary.uploader.destroy(product.cloudinaryId);
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;