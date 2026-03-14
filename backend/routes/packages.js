const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Package = require("../models/Package");

const JWT_SECRET = process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";

function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token gerekli" });
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const isAdmin = decoded.rol === "admin" || decoded.role === "admin";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin yetkisi gerekli" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token geçersiz" });
  }
}

// Müşteri için paket listesi (Auth yok)
router.get("/public", async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select("name subtitle price period features featuresExcluded isPopular accentColor");
    res.json({ success: true, packages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Tüm paketler
router.get("/", adminOnly, async (req, res) => {
  try {
    const packages = await Package.find().sort({ sortOrder: 1, createdAt: 1 });
    res.json({ success: true, packages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Tek paket
router.get("/:id", adminOnly, async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: "Paket bulunamadı" });
    res.json({ success: true, package: pkg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Yeni paket
router.post("/", adminOnly, async (req, res) => {
  try {
    const { name, subtitle, price, period, features, featuresExcluded, isPopular, accentColor, sortOrder } = req.body;
    const pkg = await Package.create({
      name: name || "Yeni Paket",
      subtitle: subtitle || "",
      price: parseFloat(price) || 0,
      period: period || "ay",
      features: Array.isArray(features) ? features : (features ? features.split("\n").filter(Boolean) : []),
      featuresExcluded: Array.isArray(featuresExcluded) ? featuresExcluded : (featuresExcluded ? featuresExcluded.split("\n").filter(Boolean) : []),
      isPopular: !!isPopular,
      accentColor: accentColor || "#6366f1",
      sortOrder: parseInt(sortOrder) || 0,
    });
    res.json({ success: true, message: "Paket eklendi", package: pkg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Paket güncelle
router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { name, subtitle, price, period, features, featuresExcluded, isPopular, accentColor, sortOrder, isActive } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (subtitle !== undefined) updates.subtitle = subtitle;
    if (price !== undefined) updates.price = parseFloat(price);
    if (period !== undefined) updates.period = period;
    if (features !== undefined) {
      updates.features = Array.isArray(features) ? features : (features ? String(features).split("\n").filter(Boolean) : []);
    }
    if (featuresExcluded !== undefined) {
      updates.featuresExcluded = Array.isArray(featuresExcluded) ? featuresExcluded : (featuresExcluded ? String(featuresExcluded).split("\n").filter(Boolean) : []);
    }
    if (isPopular !== undefined) updates.isPopular = !!isPopular;
    if (accentColor !== undefined) updates.accentColor = accentColor;
    if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder);
    if (isActive !== undefined) updates.isActive = !!isActive;
    updates.updatedAt = new Date();

    const pkg = await Package.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: "Paket bulunamadı" });
    res.json({ success: true, message: "Paket güncellendi", package: pkg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Paket sil
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const pkg = await Package.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: "Paket bulunamadı" });
    res.json({ success: true, message: "Paket silindi" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
