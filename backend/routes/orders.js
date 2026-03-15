const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");
const { sendOrderToERP } = require("../services/erpService");
const emailService = require("../services/emailService");
const { JWT_SECRET } = require('../config/jwt');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Token gerekli" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token geçersiz veya süresi dolmuş" });
  }
}

// ==========================
// CREATE ORDER (POST /api/orders) - ERP'ye otomatik gönderim
// ==========================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, shippingAddressId, invoiceAddressId, paymentMethod } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Sepet boş olamaz" });
    }

    // Bayi alt limit: ürün en az 5, paket en az 3 adet
    const BAYI_MIN_URUN = 5;
    const BAYI_MIN_PAKET = 3;
    if (user.rol === 'bayi') {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const adet = parseInt(it.quantity || it.qty || it.adet || 1);
        const tip = (it.itemType || it.tip || '').toLowerCase();
        if (tip === 'package' || tip === 'paket') {
          if (adet < BAYI_MIN_PAKET) {
            return res.status(400).json({
              success: false,
              message: `Bayi için paket alımında en az ${BAYI_MIN_PAKET} adet olmalıdır. (${it.name || it.ad || 'Ürün'})`
            });
          }
        } else {
          if (adet < BAYI_MIN_URUN) {
            return res.status(400).json({
              success: false,
              message: `Bayi için ürün alımında en az ${BAYI_MIN_URUN} adet olmalıdır. (${it.name || it.ad || 'Ürün'})`
            });
          }
        }
      }
    }

    // Adres doğrulama
    let shippingAddress = shippingAddressId ? user.addresses.id(shippingAddressId) : null;
    let invoiceAddress = invoiceAddressId ? user.addresses.id(invoiceAddressId) : null;

    if (!shippingAddress) {
      shippingAddress = user.teslimatAdresi || user.faturaAdresi || {};
    }
    if (!invoiceAddress) {
      invoiceAddress = user.faturaAdresi || user.teslimatAdresi || {};
    }

    // Toplam hesapla
    let subtotal = 0;
    const orderItems = items.map((item) => {
      const fiyat = parseFloat(item.price || item.fiyat || 0);
      const adet = parseInt(item.quantity || item.qty || item.adet || 1);
      subtotal += fiyat * adet;
      return {
        ad: item.name || item.ad || 'Ürün',
        fiyat: fiyat,
        adet: adet,
        itemType: item.itemType || item.tip || null,
      };
    });

    const kdv = subtotal * 0.2;
    const toplam = subtotal + kdv;

    const orderType = (user.rol === 'bayi') ? 'b2b' : 'b2c';
    const newOrder = await Order.create({
      userId: user._id,
      email: user.email,
      firmaAdi: user.firma || '',
      orderType,
      items: orderItems,
      shippingAddress: {
        title: shippingAddress.baslik || shippingAddress.title || 'Teslimat Adresi',
        fullName: shippingAddress.adSoyad || shippingAddress.fullName || user.ad || '',
        phone: shippingAddress.telefon || shippingAddress.phone || user.telefon || '',
        city: shippingAddress.sehir || shippingAddress.city || '',
        district: shippingAddress.ilce || shippingAddress.district || '',
        address: shippingAddress.acikAdres || shippingAddress.address || '',
      },
      invoiceAddress: {
        title: invoiceAddress.baslik || invoiceAddress.title || 'Fatura Adresi',
        fullName: invoiceAddress.adSoyad || invoiceAddress.fullName || user.ad || '',
        phone: invoiceAddress.telefon || invoiceAddress.phone || user.telefon || '',
        city: invoiceAddress.sehir || invoiceAddress.city || '',
        district: invoiceAddress.ilce || invoiceAddress.district || '',
        address: invoiceAddress.acikAdres || invoiceAddress.address || '',
      },
      paymentMethod: paymentMethod || "Kapıda Ödeme",
      subtotal,
      kdv,
      toplam,
      status: "Hazırlanıyor",
      erpStatus: 'pending', // Başlangıçta beklemede
      createdAt: new Date(),
    });

    // Sipariş onay e-postası gönder
    const orderDataForEmail = {
      siparisNo: newOrder._id.toString().slice(-8).toUpperCase(),
      items: orderItems,
      toplam: toplam
    };
    emailService.sendOrderConfirmation(user.email, user.ad || user.firma || 'Müşteri', orderDataForEmail).catch(err => {
      console.warn("Sipariş onay e-postası gönderilemedi:", err.message);
    });

    // 🚀 Otomatik ERP'ye gönder (async, kullanıcıyı bekleme)
    sendOrderToERP(newOrder, user).then(async (erpResult) => {
      if (erpResult.success) {
        newOrder.erpStatus = 'synced';
        newOrder.erpOrderId = erpResult.erpOrderId;
        newOrder.erpSyncDate = new Date();
        console.log(`✅ Sipariş ${newOrder._id} ERP'ye aktarıldı: ${erpResult.erpOrderId}`);
      } else {
        newOrder.erpStatus = 'failed';
        newOrder.erpError = erpResult.error;
        console.error(`❌ Sipariş ${newOrder._id} ERP'ye aktarılamadı:`, erpResult.error);
      }
      await newOrder.save();
    }).catch(err => {
      console.error('ERP gönderim hatası:', err);
    });

    return res.json({
      success: true,
      message: "Sipariş başarıyla oluşturuldu",
      orderId: newOrder._id,
      erpSync: 'pending' // Kullanıcıya async olduğunu bildir
    });
  } catch (err) {
    console.error("ORDER ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Sipariş oluşturulurken hata: " + err.message });
  }
});

// ==========================
// GET MY ORDERS
// ==========================
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('email');
    
    const query = user
      ? { $or: [{ userId: req.user.id }, { email: user.email }] }
      : { userId: req.user.id };

    const orders = await Order.find(query)
      .select('-erpError') // Hata mesajını gizle
      .sort({ createdAt: -1 });
      
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================
// GET ALL ORDERS (Admin)
// ==========================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100);

    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      const o = order.toObject();
      if (!o.email && o.userId) {
        const user = await User.findById(o.userId).select('email firma telefon');
        if (user) {
          o.email = user.email;
          o.firmaAdi = o.firmaAdi || user.firma || '';
        }
      }
      if (!o.toplam && (o.total || o.subtotal)) {
        o.toplam = o.total || (o.subtotal + (o.kdv || 0));
      }
      return o;
    }));

    res.json({ success: true, orders: enrichedOrders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================
// GET SINGLE ORDER
// ==========================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Sipariş bulunamadı" });

    const o = order.toObject();
    if (!o.email && o.userId) {
      const user = await User.findById(o.userId).select('email firma telefon');
      if (user) {
        o.email = user.email;
        o.firmaAdi = o.firmaAdi || user.firma || '';
      }
    }
    if (!o.toplam && (o.total || o.subtotal)) {
      o.toplam = o.total || (o.subtotal + (o.kdv || 0));
    }

    res.json({ success: true, order: o });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================
// UPDATE ORDER STATUS
// ==========================
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: "Sipariş bulunamadı" });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================
// MANUEL ERP SENKRONİZASYONU (Admin)
// ==========================
router.post("/:id/sync-erp", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Sipariş bulunamadı" });
    }

    const user = await User.findById(order.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const result = await sendOrderToERP(order, user);
    
    if (result.success) {
      order.erpStatus = 'synced';
      order.erpOrderId = result.erpOrderId;
      order.erpSyncDate = new Date();
      order.erpError = null;
    } else {
      order.erpStatus = 'failed';
      order.erpError = result.error;
    }
    
    await order.save();

    res.json({
      success: result.success,
      message: result.success ? 'ERP\'ye senkronize edildi' : 'Senkronizasyon başarısız',
      erpOrderId: result.erpOrderId,
      error: result.error
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;