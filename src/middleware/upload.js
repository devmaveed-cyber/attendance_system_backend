const multer = require('multer');
const ApiError = require('../utils/ApiError');

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls');

    if (!allowed) {
      return cb(new ApiError(400, 'Only Excel files (.xlsx, .xls) are allowed'));
    }

    return cb(null, true);
  },
});

module.exports = { excelUpload };
