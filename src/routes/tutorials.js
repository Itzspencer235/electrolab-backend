const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const Tutorial = require('../models/Tutorial');
const {
  getTutorials,
  getTutorial,
  createTutorial,
  updateTutorial,
  deleteTutorial,
} = require('../controllers/tutorialController');

router.get('/',       getTutorials);

// Admin: the full tutorial with every language (for edit forms)
router.get('/:id/full', adminMiddleware, async (req, res) => {
  try {
    const t = await Tutorial.findById(req.params.id)
      .populate('components.product',   'name price imageUrl category')
      .populate('components.productId', 'name price imageUrl category');
    if (!t) return res.status(404).json({ message: 'Not found' });
    res.json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id',    getTutorial);
router.post('/',      adminMiddleware, createTutorial);
router.put('/:id',    adminMiddleware, updateTutorial);
router.delete('/:id', adminMiddleware, deleteTutorial);

module.exports = router;