const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { JWT_SECRET } = require("../config/jwt");

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

// Müşteri: Kategorileri listele (sadece aktif, sıralı)
router.get("/public", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select("name sortOrder");
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Tüm kategoriler
router.get("/", adminOnly, async (req, res) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Tek kategori + içindeki ürünler
router.get("/:id", adminOnly, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Kategori bulunamadı" });
    const products = await Product.find({ category: category.name, isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .select("name sku price category stock");
    res.json({ success: true, category, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Yeni kategori
router.post("/", adminOnly, async (req, res) => {
  try {
    const { name, sortOrder, isActive } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Kategori adı gerekli" });
    }
    const category = await Category.create({
      name: name.trim(),
      sortOrder: parseInt(sortOrder) || 0,
      isActive: isActive !== false
    });
    res.json({ success: true, message: "Kategori eklendi", category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Kategori güncelle
router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { name, sortOrder, isActive } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder) || 0;
    if (isActive !== undefined) updates.isActive = isActive !== false;
    updates.updatedAt = new Date();
    const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!category) return res.status(404).json({ success: false, message: "Kategori bulunamadı" });
    res.json({ success: true, message: "Kategori güncellendi", category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Kategori sil
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Kategori bulunamadı" });
    res.json({ success: true, message: "Kategori silindi" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
