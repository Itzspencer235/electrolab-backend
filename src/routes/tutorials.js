const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const {
  getTutorials,
  getTutorial,
  createTutorial,
  updateTutorial,
  deleteTutorial,
} = require('../controllers/tutorialController');

router.get('/',       getTutorials);
router.get('/:id',    getTutorial);
router.post('/',      adminMiddleware, createTutorial);
router.put('/:id',    adminMiddleware, updateTutorial);
router.delete('/:id', adminMiddleware, deleteTutorial);

module.exports = router;