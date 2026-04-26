const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const { uploadTutorial, cloudinary } = require('../middleware/upload');
const Tutorial = require('../models/Tutorial');
const { getTutorials, getTutorial } = require('../controllers/tutorialController');

router.get('/',    getTutorials);
router.get('/:id', getTutorial);

// Create tutorial WITH thumbnail upload + YouTube link
router.post('/', adminMiddleware, uploadTutorial.single('image'), async (req, res) => {
  try {
    const tutorialData = {
      ...req.body,
      title:   JSON.parse(req.body.title),
      content: JSON.parse(req.body.content),
    };

    if (req.file) {
      tutorialData.imageUrl     = req.file.path;
      tutorialData.cloudinaryId = req.file.filename;
    }

    // youtubeUrl comes directly from req.body
    const tutorial = new Tutorial(tutorialData);
    await tutorial.save();
    res.status(201).json(tutorial);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete tutorial AND its Cloudinary image
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const tutorial = await Tutorial.findById(req.params.id);
    if (tutorial.cloudinaryId) {
      await cloudinary.uploader.destroy(tutorial.cloudinaryId);
    }
    await Tutorial.findByIdAndDelete(req.params.id);
    res.json({ message: 'Tutorial deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;