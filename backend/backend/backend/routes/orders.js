const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");

const JWT_SECRET = process.env.JWT_SECRET;

// ==========================
// AUTH MIDDLEWARE
// ==========================
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token gerekli",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token geçersiz veya süresi dolmuş",
    });
  }
}

// ==========================
// CREATE ORDER (POST /api/orders)
// ==========================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, shippingAddressId, invoiceAddressId, paymentMethod } =
      req.body;

    // ✅ 1. Kullanıcı kontrol
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    // ✅ 2. Sepet kontrol
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Sipariş oluşturmak için sepet boş olamaz",
      });
    }

    // ✅ 3. Address doğrulama
    const shippingAddress = user.addresses.id(shippingAddressId);
    const invoiceAddress = user.addresses.id(invoiceAddressId);

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Teslimat adresi bulunamadı",
      });
    }

    if (!invoiceAddress) {
      return res.status(400).json({
        success: false,
        message: "Fatura adresi bulunamadı",
      });
    }

    // ✅ 4. Total hesapla
    let subtotal = 0;

    const orderItems = items.map((item) => {
      subtotal += item.price * item.quantity;

      return {
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      };
    });

    const kdv = subtotal * 0.2;
    const total = subtotal + kdv;

    // ✅ 5. Sipariş oluştur
    const newOrder = await Order.create({
      userId: user._id,

      items: orderItems,

      shippingAddress: {
        title: shippingAddress.title,
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        city: shippingAddress.city,
        district: shippingAddress.district,
        address: shippingAddress.address,
      },

      invoiceAddress: {
        title: invoiceAddress.title,
        fullName: invoiceAddress.fullName,
        phone: invoiceAddress.phone,
        city: invoiceAddress.city,
        district: invoiceAddress.district,
        address: invoiceAddress.address,
      },

      paymentMethod: paymentMethod || "Kapıda Ödeme",

      subtotal,
      kdv,
      total,

      status: "Hazırlanıyor",
      createdAt: new Date(),
    });

    return res.json({
      success: true,
      message: "Sipariş başarıyla oluşturuldu",
      orderId: newOrder._id,
    });
  } catch (err) {
    console.error("ORDER ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: "Sipariş oluşturulurken hata oluştu",
    });
  }
});

// ==========================
// GET MY ORDERS
// ==========================
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      orders,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Siparişler alınamadı",
    });
  }
});

module.exports = router;
