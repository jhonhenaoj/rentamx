const multer = require("multer");

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo no permitido: ${file.mimetype}. Solo JPG, PNG o HEIC.`), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});

module.exports = upload;
