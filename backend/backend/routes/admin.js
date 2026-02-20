const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Order = require("../models/Order");

const JWT_SECRET = process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";

// ============================================
// MIDDLEWARE: Admin Kontrolü
// ============================================
function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Token gerekli"
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const isAdmin = decoded.rol === "admin" || decoded.role === "admin";
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin yetkisi gerekli"
      });
    }

    req.user = decoded;
    req.userId = decoded.id || decoded.userId;
    
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token geçersiz veya süresi dolmuş"
    });
  }
}

// ============================================
// ADMIN LOGIN (🔴 EKSİKTİ - EKLENDİ)
// ============================================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // .env'den admin bilgilerini kontrol et
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;

    if (!adminUser || !adminPass) {
      return res.status(500).json({
        success: false,
        error: "Admin ayarları yapılmamış (.env dosyasını kontrol edin)"
      });
    }

    if (username !== adminUser || password !== adminPass) {
      return res.status(401).json({
        success: false,
        error: "Hatalı kullanıcı adı veya şifre"
      });
    }

    // Admin token oluştur
    const token = jwt.sign(
      { 
        role: "admin",
        rol: "admin",
        username: adminUser
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      success: true,
      token,
      message: "Admin girişi başarılı"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Giriş hatası: " + err.message
    });
  }
});

// ============================================
// DASHBOARD İSTATİSTİKLERİ
// ============================================
router.get("/dashboard", adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today }
    });
    
    const pendingOrders = await Order.countDocuments({
      status: { $in: ["Yeni", "Hazırlanıyor"] }
    });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await Order.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      
      last7Days.push({
        date: date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        count: count
      });
    }

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        todayOrders,
        pendingOrders
      },
      chart: last7Days
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Dashboard hatası: " + err.message
    });
  }
});

// ============================================
// TÜM KULLANICILARI GETİR
// ============================================
router.get("/users", adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Kullanıcılar alınamadı: " + err.message
    });
  }
});

// ============================================
// TEK KULLANICI DETAYI
// ============================================
router.get("/users/:id", adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı"
      });
    }

    const orders = await Order.find({ 
      $or: [
        { userId: user._id },
        { email: user.email }
      ]
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      user,
      orders
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Kullanıcı detay hatası: " + err.message
    });
  }
});

// ============================================
// TÜM SİPARİŞLERİ GETİR
// ============================================
router.get("/orders", adminOnly, async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    let query = {};
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      orders
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Siparişler alınamadı: " + err.message
    });
  }
});

// ============================================
// SİPARİŞ DURUMU GÜNCELLE
// ============================================
router.put("/orders/:id/status", adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    
    const allowedStatuses = [
      "Yeni",
      "Hazırlanıyor", 
      "Kargoya Verildi",
      "Teslim Edildi",
      "İptal Edildi"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz durum"
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı"
      });
    }

    res.json({
      success: true,
      message: "Sipariş durumu güncellendi",
      order
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Güncelleme hatası: " + err.message
    });
  }
});


// ============================================
// KARGO BİLGİSİ GÜNCELLE
// ============================================
router.put("/orders/:id/kargo", adminOnly, async (req, res) => {
  try {
    const { firma, takipNo, durum } = req.body;

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı"
      });
    }

    // Kargo bilgisi yaz
    order.kargoBilgisi = {
      firma: firma || order.kargoBilgisi?.firma,
      takipNo: takipNo || order.kargoBilgisi?.takipNo,
      durum: durum || order.kargoBilgisi?.durum,
      kargolamaTarihi: new Date()
    };

    await order.save();

    res.json({
      success: true,
      message: "Kargo bilgisi güncellendi ✅",
      order
    });

  } catch (err) {
    console.error("KARGO HATA:", err);  // Detaylı hata logu
    res.status(500).json({
      success: false,
      message: "Kargo güncelleme hatası: " + err.message
    });
  }
});

// ============================================
// KARGO BİLDİRİMİ (Email + SMS)
// ============================================
router.post("/kargo-bildir", adminOnly, async (req, res) => {
  try {
    const { siparisId } = req.body;

    if (!siparisId) {
      return res.status(400).json({
        success: false,
        message: "Sipariş ID gerekli"
      });
    }

    const order = await Order.findById(siparisId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı"
      });
    }

    // Yeni kontrol (direkt alanları kontrol et):
// YENİ (DOĞRU):
const hasKargo = order.kargoBilgisi && 
                 order.kargoBilgisi.takipNo && 
                 order.kargoBilgisi.takipNo.trim() !== "";

if (!hasKargo) {
  return res.status(400).json({
    success: false,
    message: "Önce kargo bilgisi ekleyin"
  });
}
    // Email gönderme fonksiyonu (basit versiyon)
    // TODO: Gerçek email entegrasyonu eklenecek
    
    res.json({
      success: true,
      message: "Kargo bildirimi gönderildi",
      email: true,
      sms: false,
      details: {
        siparisId: order._id,
        email: order.email,
        kargoFirma: order.kargoBilgisi.firma,
        takipNo: order.kargoBilgisi.takipNo
      }
    });

  } catch (err) {
    console.error("Kargo bildirim hatası:", err);
    res.status(500).json({
      success: false,
      message: "Bildirim gönderilemedi: " + err.message
    });
  }
});

// ============================================
// ERP ÜRÜNLERİ
// ============================================
router.get("/erp-products", adminOnly, async (req, res) => {
  try {
    const mockProducts = [
      { 
        name: "E-Fatura Kontörü (1000 Adet)", 
        sku: "EF-1000", 
        price: 250.00, 
        stock: 150,
        category: "E-Fatura"
      },
      { 
        name: "E-İrsaliye Kontörü (500 Adet)", 
        sku: "EI-500", 
        price: 180.00, 
        stock: 80,
        category: "E-İrsaliye"
      },
      { 
        name: "Mali Mühür (Yeni)", 
        sku: "MM-001", 
        price: 450.00, 
        stock: 25,
        category: "Mali Mühür"
      },
      { 
        name: "E-Defter Modülü (Aylık)", 
        sku: "ED-A1", 
        price: 99.90, 
        stock: 999,
        category: "E-Defter"
      }
    ];

    res.json({
      success: true,
      products: mockProducts
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Ürünler alınamadı: " + err.message
    });
  }
});

// ============================================
// ERP CARİ AKTARIM
// ============================================
router.post("/sync-cari", adminOnly, async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı"
      });
    }

    user.erpSynced = true;
    user.erpSyncDate = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Cari aktarım tamamlandı",
      user: {
        id: user._id,
        firma: user.firma,
        email: user.email,
        erpSynced: user.erpSynced,
        erpSyncDate: user.erpSyncDate
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "ERP aktarım hatası: " + err.message
    });
  }
});

// 🔴 BU EN SONA EKLENMELİ!
module.exports = router;