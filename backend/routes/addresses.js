const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

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
// GET ADDRESSES
// ==========================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    res.json({
      success: true,
      addresses: user.addresses || [],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Adresler alınamadı",
    });
  }
});

// ==========================
// ADD ADDRESS
// ==========================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    user.addresses.push(req.body);
    await user.save();

    res.json({
      success: true,
      message: "Adres başarıyla eklendi",
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Adres eklenemedi",
    });
  }
});

// ==========================
// UPDATE ADDRESS
// ==========================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId || req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const addr = user.addresses.id(req.params.id);
    if (!addr) {
      return res.status(404).json({ success: false, message: "Adres bulunamadı" });
    }

    const { title, fullName, phone, city, district, address, postalCode } = req.body;
    if (title !== undefined) addr.baslik = title;
    if (fullName !== undefined) addr.adSoyad = fullName;
    if (phone !== undefined) addr.telefon = phone;
    if (city !== undefined) addr.sehir = city;
    if (district !== undefined) addr.ilce = district;
    if (address !== undefined) addr.acikAdres = address;
    if (postalCode !== undefined) addr.postaKodu = postalCode;

    await user.save();

    res.json({
      success: true,
      message: "Adres güncellendi",
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Adres güncellenemedi" });
  }
});

module.exports = router;
