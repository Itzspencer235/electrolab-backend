const cloudinary = require('cloudinary').v2;

// Images are uploaded by the clients straight to Cloudinary; the server only
// needs the SDK to delete them (see DELETE /api/products/:id).
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = { cloudinary };
