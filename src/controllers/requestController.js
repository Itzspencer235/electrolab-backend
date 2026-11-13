const mongoose       = require('mongoose');
const ProductRequest = require('../models/ProductRequest');
const Product        = require('../models/Product');
const User           = require('../models/User');

const STATUSES        = ['pending', 'in_progress', 'available', 'rejected'];
const MAX_OPEN_PER_USER = 10; // simple anti-spam limit

// Product fields sent along with a request (enough to show a card and open it)
const PRODUCT_FIELDS = 'name price imageUrl category stock';

const toNumberOrUndefined = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// POST /api/requests — logged-in user creates a request
exports.createRequest = async (req, res) => {
  try {
    const b    = req.body || {};
    const name = (b.name || '').toString().trim();
    if (!name) return res.status(400).json({ message: 'Product name is required' });

    const intendedPrice = toNumberOrUndefined(b.intendedPrice);
    const quantity      = toNumberOrUndefined(b.quantity);
    if (Number.isNaN(intendedPrice) || intendedPrice < 0) {
      return res.status(400).json({ message: 'Invalid price' });
    }
    if (Number.isNaN(quantity) || (quantity !== undefined && quantity < 1)) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    const imageUrl = (b.imageUrl || '').toString().trim();
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
      return res.status(400).json({ message: 'Invalid image URL' });
    }

    const open = await ProductRequest.countDocuments({
      'user.userId': req.user.id,
      status: { $in: ['pending', 'in_progress'] },
    });
    if (open >= MAX_OPEN_PER_USER) {
      return res.status(429).json({
        message: `You already have ${MAX_OPEN_PER_USER} open requests. Please wait for a reply.`,
      });
    }

    const user = await User.findById(req.user.id).select('name email phone');
    if (!user) return res.status(401).json({ message: 'User not found' });

    const request = await ProductRequest.create({
      user: {
        userId:  user._id,
        name:    user.name || '',
        contact: user.email || user.phone || '',
      },
      name,
      description: (b.description || '').toString(),
      imageUrl,
      intendedPrice,
      quantity: quantity ?? 1,
      searchQuery: (b.searchQuery || '').toString().slice(0, 120),
      source: b.source === 'web' ? 'web' : 'app',
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET /api/requests/my — the user's own requests, newest first
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await ProductRequest.find({ 'user.userId': req.user.id })
      .populate('product', PRODUCT_FIELDS)
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/requests/:id — user cancels their own request while it's still pending
exports.deleteMyRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const request = await ProductRequest.findOne({
      _id: req.params.id, 'user.userId': req.user.id,
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be cancelled' });
    }
    await request.deleteOne();
    res.json({ message: 'Request cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/requests?status=pending — admin: all requests
exports.getAllRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    const requests = await ProductRequest.find(filter)
      .populate('product', PRODUCT_FIELDS)
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/requests/:id — admin: set status, reply message and/or linked product
exports.updateRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const b       = req.body || {};
    const updates = {};

    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      updates.status = b.status;
    }
    if (b.adminMessage !== undefined) {
      updates.adminMessage = (b.adminMessage || '').toString();
    }
    if (b.product !== undefined) {
      if (b.product === null || b.product === '') {
        updates.product = null;
      } else {
        if (!mongoose.isValidObjectId(b.product) || !(await Product.exists({ _id: b.product }))) {
          return res.status(400).json({ message: 'Linked product not found' });
        }
        updates.product = b.product;
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    updates.respondedAt = new Date();

    const request = await ProductRequest.findByIdAndUpdate(
      req.params.id, updates, { new: true, runValidators: true },
    ).populate('product', PRODUCT_FIELDS);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    res.json(request);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/requests/:id/admin — admin removes any request
exports.adminDeleteRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const request = await ProductRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
