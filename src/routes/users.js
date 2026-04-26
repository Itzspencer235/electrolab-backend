const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const { register, login, getProfile } = require('../controllers/userController');

router.post('/register', register);
router.post('/login',    login);
router.get('/profile',   authMiddleware, getProfile);

module.exports = router;