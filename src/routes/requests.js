const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  createRequest, getMyRequests, deleteMyRequest,
  getAllRequests, updateRequest, adminDeleteRequest,
} = require('../controllers/requestController');

// Customer (must be logged in)
router.post('/',     authMiddleware, createRequest);
router.get('/my',    authMiddleware, getMyRequests);   // before /:id routes
router.delete('/:id', authMiddleware, deleteMyRequest);

// Admin
router.get('/',               adminMiddleware, getAllRequests);
router.put('/:id',            adminMiddleware, updateRequest);
router.delete('/:id/admin',   adminMiddleware, adminDeleteRequest);

module.exports = router;
