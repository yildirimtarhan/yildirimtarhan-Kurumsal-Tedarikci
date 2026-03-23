const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Product = require("../models/Product");
const { generateUniqueBarcode } = require("../utils/barcodeGenerator");

const { JWT_SECRET } = require('../config/jwt');

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
// MÜŞTERİ İÇİN ÜRÜN LİSTESİ (Auth gerektirmez; Bayi token ile toptan fiyat döner)
// ============================================
router.get("/public", async (req, res) => {
  try {
    let isBayi = false;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
        const decoded = jwt.verify(token, JWT_SECRET);
        isBayi = decoded.rol === "bayi";
      } catch (_) {}
    }
    const select = "name sku price category description unit barcode kdvDahil kdvOrani image";
    const selectBayi = select + " wholesalePrice minQuantityWholesale";
    const products = await Product.find({ isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .select(isBayi ? selectBayi : select)
      .lean();
    if (isBayi && products.length) {
      products.forEach((p) => {
        const wholesale = p.wholesalePrice != null && p.wholesalePrice > 0 ? p.wholesalePrice : null;
        p.effectivePrice = wholesale != null ? wholesale : p.price;
        p.isWholesale = wholesale != null;
      });
    }
    res.json({ success: true, products, isBayi: isBayi });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// TÜM ÜRÜNLERİ GETİR (Admin)
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
    const { name, sku, price, stock, minStock, category, description, unit, kdvDahil, kdvOrani, wholesalePrice, minQuantityWholesale, image } = req.body;

    // SKU kontrolü
    const existing = await Product.findOne({ sku });
    if (existing) {
      return res.status(400).json({ success: false, message: "Bu SKU zaten kullanılıyor" });
    }

    const barcode = req.body.barcode && String(req.body.barcode).trim()
      ? String(req.body.barcode).trim()
      : await generateUniqueBarcode(Product);

    const categoryStr = (category != null && String(category).trim()) ? String(category).trim() : 'Diğer';

    const product = await Product.create({
      name,
      sku,
      barcode,
      price: parseFloat(price) || 0,
      wholesalePrice: wholesalePrice != null && wholesalePrice !== '' ? parseFloat(wholesalePrice) : null,
      minQuantityWholesale: minQuantityWholesale != null && minQuantityWholesale !== '' ? parseInt(minQuantityWholesale) : 1,
      kdvDahil: req.body.kdvDahil === true || req.body.kdvDahil === 'true',
      kdvOrani: Math.min(100, Math.max(0, parseFloat(kdvOrani) || 20)),
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 10,
      category: categoryStr,
      description: description || '',
      unit: unit || 'Adet',
      image: (image && String(image).trim()) || '',
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
    const { name, price, minStock, category, description, unit, isActive, kdvDahil, kdvOrani, wholesalePrice, minQuantityWholesale, image } = req.body;

    const updates = {
      name,
      price: parseFloat(price),
      minStock: parseInt(minStock),
      category,
      description,
      unit,
      isActive,
      updatedAt: new Date()
    };
    if (wholesalePrice !== undefined) updates.wholesalePrice = (wholesalePrice === '' || wholesalePrice == null) ? null : parseFloat(wholesalePrice);
    if (minQuantityWholesale !== undefined) updates.minQuantityWholesale = minQuantityWholesale === '' || minQuantityWholesale == null ? 1 : parseInt(minQuantityWholesale);
    if (kdvDahil !== undefined) updates.kdvDahil = kdvDahil === true || kdvDahil === 'true';
    if (kdvOrani !== undefined) updates.kdvOrani = Math.min(100, Math.max(0, parseFloat(kdvOrani) || 20));
    if (category !== undefined) updates.category = String(category).trim() || 'Diğer';
    if (image !== undefined) updates.image = String(image).trim() || '';

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
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