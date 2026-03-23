const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/jwt");

const uploadsDir = path.join(__dirname, "..", "..", "public", "uploads", "products");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || ".jpg";
    const safeName = (file.originalname || "image").replace(/[^a-zA-Z0-9.-]/g, "").slice(0, 30);
    cb(null, Date.now() + "-" + safeName + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error("Sadece resim dosyaları (JPEG, PNG, GIF, WebP) yüklenebilir."));
  }
});

function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: "Token gerekli" });
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.rol !== "admin" && decoded.role !== "admin")
      return res.status(403).json({ success: false, message: "Admin yetkisi gerekli" });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token geçersiz" });
  }
}

router.post("/product-image", adminOnly, upload.single("image"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Resim dosyası seçilmedi." });
    const url = "/uploads/products/" + req.file.filename;
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, message: "Dosya 5 MB'dan küçük olmalı." });
  res.status(400).json({ success: false, message: err.message || "Yükleme hatası." });
});

module.exports = router;
