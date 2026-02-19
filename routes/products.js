const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Product = require("../models/Product");

const JWT_SECRET = process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";

// ============================================
// MIDDLEWARE: Admin Kontrolü
// ============================================
function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token gerekli" });
  }

  const token = authHeader.startsWith("Bearer ") 
    ? authHeader.split(" ")[1] 
    : authHeader;

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

// ============================================
// TÜM ÜRÜNLERİ GETİR
// ============================================
router.get("/", adminOnly, async (req, res) => {
  try {
    const { category, lowStock, search } = req.query;
    let query = {};
    
    if (category && category !== 'all') query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    if (lowStock === 'true') {
      query.$expr = { $lte: ["$stock", "$minStock"] };
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      products,
      count: products.length,
      lowStockCount: products.filter(p => p.stock <= p.minStock).length
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// TEK ÜRÜN GETİR
// ============================================
router.get("/:id", adminOnly, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Ürün bulunamadı" });
    }

    res.json({ success: true, product });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// YENİ ÜRÜN EKLE
// ============================================
router.post("/", adminOnly, async (req, res) => {
  try {
    const { name, sku, price, stock, minStock, category, description, unit } = req.body;

    // SKU kontrolü
    const existing = await Product.findOne({ sku });
    if (existing) {
      return res.status(400).json({ success: false, message: "Bu SKU zaten kullanılıyor" });
    }

    const product = await Product.create({
      name,
      sku,
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 10,
      category: category || 'Diğer',
      description: description || '',
      unit: unit || 'Adet',
      movements: [{
        type: 'giris',
        quantity: parseInt(stock) || 0,
        oldStock: 0,
        newStock: parseInt(stock) || 0,
        reason: 'İlk stok girişi',
        userId: req.user.id || req.user.userId
      }]
    });

    res.json({ success: true, message: "Ürün eklendi", product });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// ÜRÜN GÜNCELLE
// ============================================
router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { name, price, minStock, category, description, unit, isActive } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { 
        name, 
        price: parseFloat(price), 
        minStock: parseInt(minStock), 
        category, 
        description, 
        unit,
        isActive,
        updatedAt: new Date() 
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Ürün bulunamadı" });
    }

    res.json({ success: true, message: "Ürün güncellendi", product });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// STOK GÜNCELLE (Giriş/Çıkış)
// ============================================
router.post("/:id/stock", adminOnly, async (req, res) => {
  try {
    const { type, quantity, reason } = req.body;
    const qty = parseInt(quantity);
    
    if (!['giris', 'cikis'].includes(type)) {
      return res.status(400).json({ success: false, message: "Geçersiz hareket tipi" });
    }

    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: "Geçersiz miktar" });
    }

    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Ürün bulunamadı" });
    }

    const oldStock = product.stock;
    let newStock;

    if (type === 'giris') {
      newStock = oldStock + qty;
    } else {
      newStock = oldStock - qty;
      if (newStock < 0) {
        return res.status(400).json({ success: false, message: "Yetersiz stok" });
      }
    }

    product.stock = newStock;
    product.movements.push({
      type,
      quantity: qty,
      oldStock,
      newStock,
      reason: reason || 'Manuel düzeltme',
      userId: req.user.id || req.user.userId,
      date: new Date()
    });

    await product.save();

    res.json({
      success: true,
      message: `Stok ${type === 'giris' ? 'girişi' : 'çıkışı'} yapıldı`,
      product
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// ÜRÜN SİL
// ============================================
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Ürün bulunamadı" });
    }

    res.json({ success: true, message: "Ürün silindi" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// STOK RAPORU
// ============================================
router.get("/report/summary", adminOnly, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      isActive: true,
      $expr: { $lte: ["$stock", "$minStock"] }
    });
    
    const totalStockValue = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: { $multiply: ["$stock", "$price"] } } } }
    ]);

    const categoryStats = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 }, totalStock: { $sum: "$stock" } } }
    ]);

    res.json({
      success: true,
      report: {
        totalProducts,
        lowStockProducts,
        totalStockValue: totalStockValue[0]?.total || 0,
        categoryStats
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;