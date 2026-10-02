const multer = require('multer');
const path = require('path');
const boom = require('@hapi/boom');

const fs = require('fs');

const storage = multer.diskStorage({
   destination: function (req, file, cb) {
      const uploadPath = path.join(__dirname, '../public/avatars');
      if (!fs.existsSync(uploadPath)) {
         fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath); // La carpeta donde se guardan
   },
   filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
   }
});

const fileFilter = (req, file, cb) => {
   if (file.mimetype.startsWith('image/')) cb(null, true);
   else cb(boom.badRequest('Solo imágenes'), false);
};

const uploadImage = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

module.exports = { uploadImage };