const Product = require('../models/Product');

// GET all products
exports.getProducts = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { category } = req.query;

    const filter = category ? { category } : {};
    const products = await Product.find(filter);

    const localized = products.map(p => ({
      _id:         p._id,
      name:        p.name[lang]        || p.name.fr,
      description: p.description[lang] || p.description.fr,
      price:       p.price,
      category:    p.category,
      stock:       p.stock,
      imageUrl:    p.imageUrl,
      createdAt:   p.createdAt,
    }));

    res.json(localized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single product
exports.getProduct = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json({
      _id:         product._id,
      name:        product.name[lang]        || product.name.fr,
      description: product.description[lang] || product.description.fr,
      price:       product.price,
      category:    product.category,
      stock:       product.stock,
      imageUrl:    product.imageUrl,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create product (admin)
exports.createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update product (admin)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    );
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE product (admin)
exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};