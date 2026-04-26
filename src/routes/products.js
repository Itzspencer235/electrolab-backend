const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const { cloudinary } = require('../middleware/upload');
const Product = require('../models/Product');
const {
  getProducts,
  getProduct,
} = require('../controllers/productController');

router.get('/',    getProducts);
router.get('/:id', getProduct);

// POST — create product (JSON body from Flutter)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const {
      name, description, price,
      stock, category, imageUrl
    } = req.body;

    // Validate
    if (!name || !name.fr) {
      return res.status(400).json({ message: 'Nom en français requis' });
    }

    const product = new Product({
      name:        { fr: name.fr, en: name.en || name.fr, ar: name.ar || name.fr },
      description: { fr: description?.fr || '', en: description?.en || '', ar: description?.ar || '' },
      price:       Number(price)    || 0,
      stock:       Number(stock)    || 0,
      category:    category         || 'Accessories',
      imageUrl:    imageUrl         || '',
    });

    await product.save();
    console.log('✅ Product created:', product.name.fr);
    res.status(201).json(product);
  } catch (err) {
    console.error('❌ Create product error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// PUT — update product
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const {
      name, description, price,
      stock, category, imageUrl
    } = req.body;

    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    const updateData = {
      name: {
        fr: name?.fr || existing.name.fr,
        en: name?.en || existing.name.en,
        ar: name?.ar || existing.name.ar,
      },
      description: {
        fr: description?.fr ?? existing.description?.fr,
        en: description?.en ?? existing.description?.en,
        ar: description?.ar ?? existing.description?.ar,
      },
      price:    Number(price)    || existing.price,
      stock:    Number(stock)    || existing.stock,
      category: category         || existing.category,
      imageUrl: imageUrl         || existing.imageUrl,
    };

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    console.log('✅ Product updated:', product.name.fr);
    res.json(product);
  } catch (err) {
    console.error('❌ Update product error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// DELETE — product
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    // Delete image from Cloudinary if exists
    if (product.cloudinaryId) {
      await cloudinary.uploader.destroy(product.cloudinaryId);
    }

    await Product.findByIdAndDelete(req.params.id);
    console.log('✅ Product deleted');
    res.json({ message: 'Produit supprimé' });
  } catch (err) {
    console.error('❌ Delete product error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;