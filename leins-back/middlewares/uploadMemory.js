const multer = require('multer');
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const ok = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  if (ok.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Solo .xlsx / .xls'));
};

const uploadMemory = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

module.exports = { uploadMemory };