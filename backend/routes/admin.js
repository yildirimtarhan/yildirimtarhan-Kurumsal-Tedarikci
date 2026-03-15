const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Order = require("../models/Order");
const BayiBasvuru = require("../models/BayiBasvuru");

const { JWT_SECRET } = require('../config/jwt');

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
// KULLANICI GÜNCELLE (rol: user / bayi / admin)
// ============================================
router.put("/users/:id", adminOnly, async (req, res) => {
  try {
    const { rol } = req.body;
    if (!rol || !['user', 'bayi', 'admin'].includes(rol)) {
      return res.status(400).json({ success: false, message: "Geçerli rol: user, bayi, admin" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { rol },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    res.json({ success: true, message: "Kullanıcı güncellendi", user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// BAYİLİK BAŞVURULARI LİSTE
// ============================================
router.get("/bayi-basvurulari", adminOnly, async (req, res) => {
  try {
    const { durum } = req.query;
    let query = {};
    if (durum && ["beklemede", "onaylandi", "reddedildi"].includes(durum)) query.durum = durum;
    const basvurular = await BayiBasvuru.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "ad email telefon firma");
    res.json({ success: true, basvurular });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// BAYİLİK BAŞVURUSU ONAYLA / REDDET
// ============================================
router.put("/bayi-basvurulari/:id", adminOnly, async (req, res) => {
  try {
    const { durum, adminNotu } = req.body;
    if (!durum || !["onaylandi", "reddedildi"].includes(durum)) {
      return res.status(400).json({ success: false, message: "Geçerli durum: onaylandi veya reddedildi" });
    }
    const basvuru = await BayiBasvuru.findById(req.params.id);
    if (!basvuru) return res.status(404).json({ success: false, message: "Başvuru bulunamadı" });
    if (basvuru.durum !== "beklemede") {
      return res.status(400).json({ success: false, message: "Bu başvuru zaten işlenmiş." });
    }
    basvuru.durum = durum;
    basvuru.adminNotu = adminNotu || "";
    basvuru.onaylayanId = req.userId;
    basvuru.onayTarihi = new Date();
    basvuru.updatedAt = new Date();
    await basvuru.save();
    if (durum === "onaylandi") {
      await User.findByIdAndUpdate(basvuru.userId, {
        rol: "bayi",
        vergiNo: basvuru.vergiNo,
        vergiDairesi: basvuru.vergiDairesi,
        tcNo: basvuru.tcNo,
        firma: basvuru.firmaAdi || undefined,
      });
    }
    res.json({ success: true, message: durum === "onaylandi" ? "Bayilik başvurusu onaylandı." : "Başvuru reddedildi.", basvuru });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    // Eski siparişlerde email/tutar yoksa userId'den kullanıcı bilgisi çek
    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      const o = order.toObject();
      if (!o.email && o.userId) {
        const user = await User.findById(o.userId).select('email firma telefon');
        if (user) {
          o.email = user.email;
          o.firmaAdi = o.firmaAdi || user.firma || '';
        }
      }
      // toplam yoksa total veya subtotal+kdv'den hesapla
      if (!o.toplam && (o.total || o.subtotal)) {
        o.toplam = o.total || (o.subtotal + (o.kdv || 0));
      }
      return o;
    }));

    res.json({
      success: true,
      orders: enrichedOrders
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

    // Takip no girilmişse otomatik e-posta bildirimi gönder
    if (order.kargoBilgisi.takipNo && order.email) {
      try {
        let userName = order.firmaAdi || order.shippingAddress?.fullName || 'Müşteri';
        const user = await User.findById(order.userId).select('ad firma');
        if (user) userName = user.ad || user.firma || userName;
        const emailService = require('../services/emailService');
        await emailService.sendShipmentNotification(
          order.email,
          userName,
          {
            siparisNo: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
            kargoFirma: order.kargoBilgisi.firma,
            takipNo: order.kargoBilgisi.takipNo,
            tahminiTeslimat: '2-3 iş günü'
          }
        );
        console.log('✅ Kargo bildirim e-postası gönderildi (otomatik):', order.email);
      } catch (e) {
        console.warn('Kargo e-posta gönderilemedi:', e.message);
      }
    }

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

    // Kullanıcı bilgisini al (siparişte veya User'dan)
    let userName = order.firmaAdi || order.shippingAddress?.fullName || 'Müşteri';
    if (order.userId) {
      const user = await User.findById(order.userId).select('ad firma');
      if (user) userName = user.ad || user.firma || userName;
    }

    const orderData = {
      siparisNo: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
      kargoFirma: order.kargoBilgisi.firma,
      takipNo: order.kargoBilgisi.takipNo,
      tahminiTeslimat: order.kargoBilgisi.kargolamaTarihi
        ? new Date(order.kargoBilgisi.kargolamaTarihi.getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')
        : '2-3 iş günü'
    };

    let emailSent = false;
    try {
      const emailService = require('../services/emailService');
      await emailService.sendShipmentNotification(order.email, userName, orderData);
      emailSent = true;
      console.log('✅ Kargo bildirim e-postası gönderildi:', order.email);
    } catch (emailErr) {
      console.error('Kargo e-posta hatası:', emailErr.message);
    }

    res.json({
      success: true,
      message: "Kargo bildirimi gönderildi",
      email: emailSent,
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
      { name: "E-Fatura Köntörü (1000 Adet)", sku: "EF-1000", price: 250.00, stock: 150, category: "E-Dönüşüm (E-Fatura Köntörü) Paketleri" },
      { name: "E-İmza Paketi (Yıllık)", sku: "EIMZA-1", price: 399.00, stock: 50, category: "E-İmza Paketleri" },
      { name: "KEP Paketi (Kurumsal)", sku: "KEP-001", price: 599.00, stock: 30, category: "KEP Paketleri" },
      { name: "Mali Mühür (Yeni)", sku: "MM-001", price: 450.00, stock: 25, category: "Mali Mühür Paketleri" },
      { name: "Zaman Damgası Paketi (1000 Adet)", sku: "ZD-1000", price: 199.00, stock: 100, category: "Zaman Damgası Paketleri" }
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

// ============================================
// CARİ YÖNETİMİ ENDPOINTLERİ
// ============================================

// İstatistikler
// ============================================
// CARİ YÖNETİMİ ENDPOINTLERİ - DÜZELTİLMİŞ
// ============================================

// İstatistikler - adminOnly EKLENDİ
router.get("/cari-stats", adminOnly, async (req, res) => {
  try {
    console.log('📊 Cari stats istendi');
    
    const total = await User.countDocuments();
    const kurumsal = await User.countDocuments({ uyelikTipi: 'kurumsal' });
    const bireysel = await User.countDocuments({ uyelikTipi: 'bireysel' });
    const pendingERP = await User.countDocuments({ 
      $or: [
        { erpSynced: false },
        { erpSynced: { $exists: false } }
      ]
    });
    
    console.log(`✅ Stats: Toplam=${total}, Kurumsal=${kurumsal}, Bireysel=${bireysel}`);
    
    res.json({
      success: true,
      total,
      kurumsal,
      bireysel,
      pendingERP
    });
  } catch (err) {
    console.error('❌ Cari stats hatası:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cari listesi - adminOnly EKLENDİ, FİLTRELER EKLENDİ
// Cari listesi - adminOnly EKLENDİ, FİLTRELER EKLENDİ
// Cari listesi - adminOnly EKLENDİ, FİLTRELER EKLENDİ
router.get("/cariler", adminOnly, async (req, res) => {
  try {
    const { search, tip, risk } = req.query;
    console.log('📋 Cari listesi istendi:', { search, tip, risk });
    
    let query = {};
    
    // Tip filtresi (kurumsal/bireysel)
    if (tip && tip !== '') {
      query.uyelikTipi = tip;
    }
    
    // Arama
    if (search && search !== '') {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { firma: searchRegex },
        { ad: searchRegex },
        { email: searchRegex },
        { vergiNo: searchRegex },
        { tcNo: searchRegex }
      ];
    }
    
    console.log('🔍 MongoDB query:', JSON.stringify(query));
    
    const cariler = await User.find(query)
      .select('ad email telefon firma uyelikTipi vergiNo tcNo erpSynced erpSyncDate erpCariId createdAt')
      .sort({ createdAt: -1 })
      .limit(100);
    
    console.log(`✅ ${cariler.length} cari bulundu`);
    
    // GÜVENLİ FORMATLAMA - Null/Undefined kontrolü eklendi
    const formatted = cariler.map(c => {
      // _id kontrolü - Güvenli dönüşüm
      let id = 'unknown';
      try {
        id = c._id ? c._id.toString() : 'unknown';
      } catch (e) {
        console.error('❌ _id dönüşüm hatası:', e);
        id = String(c._id) || 'unknown';
      }
      
      return {
        _id: id,
        cariKodu: 'C-' + (id.slice(-6).toUpperCase()),
        ad: c.ad || '',
        email: c.email || '',
        telefon: c.telefon || '',
        firma: c.firma || '',
        vergiNo: c.vergiNo || '',
        tcNo: c.tcNo || '',
        uyelikTipi: c.uyelikTipi || 'bireysel',
        erpStatus: c.erpSynced ? 'synced' : 'pending',
        erpCariId: c.erpCariId || '',
        bakiye: 0,
        riskDurumu: 'GÜVENLİ',
        createdAt: c.createdAt
      };
    });
    
    res.json({ success: true, cariler: formatted });
  } catch (err) {
    console.error('❌ Cari listesi hatası:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// Yeni Cari Oluştur - adminOnly EKLENDİ, DETAYLI LOG
// Yeni Cari Oluştur - adminOnly EKLENDİ, DETAYLI LOG
// Yeni Cari Oluştur - adminOnly EKLENDİ, DETAYLI LOG
router.post("/cari-olustur", adminOnly, async (req, res) => {
  try {
    console.log('📥 Cari oluşturma isteği:', JSON.stringify(req.body, null, 2));
    
    const {
      uyelikTipi, ad, email, telefon, password,
      firma, vergiNo, vergiDairesi, tcNo,
      sehir, ilce, faturaAdresi, teslimatAdresi,
      sendEmail, syncERP
    } = req.body;

    // Validasyon
    if (!ad || !email || !telefon || !password) {
      console.log('❌ Validasyon hatası: Zorunlu alanlar eksik');
      return res.status(400).json({ 
        success: false, 
        message: "Ad, email, telefon ve şifre zorunludur" 
      });
    }

    if (uyelikTipi === 'kurumsal' && (!firma || !vergiNo)) {
      console.log('❌ Validasyon hatası: Kurumsal alanlar eksik');
      return res.status(400).json({ 
        success: false, 
        message: "Kurumsal cari için firma ve vergi no zorunludur" 
      });
    }

    if (uyelikTipi === 'bireysel' && !tcNo) {
      console.log('❌ Validasyon hatası: TC No eksik');
      return res.status(400).json({ 
        success: false, 
        message: "Bireysel cari için TC Kimlik No zorunludur" 
      });
    }

    // Email kontrol
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log('❌ Email zaten kayıtlı:', email);
      return res.status(400).json({ 
        success: false, 
        message: "Bu email adresi zaten kayıtlı" 
      });
    }

    // Şifre hash
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('🔐 Şifre hashlendi');

    // Cari oluştur
    const newUser = new User({
      ad,
      email: email.toLowerCase(),
      telefon,
      password: hashedPassword,
      uyelikTipi: uyelikTipi || 'bireysel',
      rol: 'user',
      tcNo: tcNo || '',
      firma: firma || '',
      vergiNo: vergiNo || '',
      vergiDairesi: vergiDairesi || '',
      sehir: sehir || 'İstanbul',
      ilce: ilce || '',
      faturaAdresi: faturaAdresi || { acikAdres: '', sehir: sehir || 'İstanbul' },
      teslimatAdresi: teslimatAdresi || faturaAdresi || { acikAdres: '', sehir: sehir || 'İstanbul' },
      erpSynced: false,
      erpCariId: '',
      createdAt: new Date()
    });

    await newUser.save();
    console.log('✅ Kullanıcı MongoDB\'ye kaydedildi:', newUser._id);

    // ERP'ye gönder - DÜZELTİLDİ: sendCustomerToERP kullanılıyor
    // ERP'ye gönder - GEÇİCİ ÇÖZÜM
let erpResult = { success: false, error: 'ERP sync disabled' };

if (syncERP !== false) {
  try {
    console.log('🚀 ERP\'ye gönderiliyor...');
    
    // GEÇİCİ: sendOrderToERP kullan (sendCustomerToERP yerine)
    const { sendCustomerToERP } = require('../services/erpService');
    
    erpResult = await sendCustomerToERP(newUser);
        
        if (erpResult.success) {
          newUser.erpSynced = true;
          newUser.erpCariId = erpResult.erpCariId || '';
          newUser.erpSyncDate = new Date();
          await newUser.save();
          console.log('✅ ERP\'ye aktarıldı:', erpResult.erpCustomerId);
        } else {
          console.error('❌ ERP aktarım başarısız:', erpResult.error);
        }
      } catch (erpErr) {
        console.error('❌ ERP hatası:', erpErr.message);
        erpResult = { success: false, error: erpErr.message };
      }
    } else {
      console.log('ℹ️ ERP sync pasif');
    }

    // Email gönder (simülasyon)
    let emailSent = false;
    if (sendEmail) {
      console.log('📧 Email gönderimi simüle edildi:', email);
      emailSent = true;
    }

    res.json({
      success: true,
      message: "Cari başarıyla oluşturuldu",
      userId: newUser._id,
      erpSync: erpResult.success,
      erpError: erpResult.error,
      emailSent
    });

  } catch (err) {
    console.error('❌ Cari oluşturma hatası:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || "Sunucu hatası" 
    });
  }
});

// Manuel ERP Senkronizasyonu - adminOnly EKLENDİ
// Manuel ERP Senkronizasyonu - adminOnly EKLENDİ
// Manuel ERP Senkronizasyonu - adminOnly EKLENDİ
// Manuel ERP Senkronizasyonu - adminOnly EKLENDİ
router.post("/cari-sync-erp/:id", adminOnly, async (req, res) => {
  try {
    console.log('🔄 Manuel ERP sync:', req.params.id);

    if (!req.params.id || req.params.id === 'unknown' || req.params.id.length !== 24) {
      return res.status(400).json({ success: false, message: "Geçersiz cari ID" });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Cari bulunamadı" });
    }

    const { sendCustomerToERP } = require('../services/erpService');
    const erpResult = await sendCustomerToERP(user);

    if (erpResult.success) {
      user.erpSynced = true;
      user.erpCariId = erpResult.erpCariId || '';
      user.erpSyncDate = new Date();
      await user.save();
      console.log('✅ ERP sync başarılı:', erpResult.erpCariId);
    } else {
      console.error('❌ ERP sync başarısız:', erpResult.error);
    }

    res.json({
      success: erpResult.success,
      message: erpResult.success ? "ERP'ye aktarıldı" : "Aktarım başarısız",
      erpOrderId: erpResult.erpOrderId,
      error: erpResult.error
    });

  } catch (err) {
    console.error('❌ ERP sync hatası:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// 🔴 BU EN SONA EKLENMELİ!
module.exports = router;