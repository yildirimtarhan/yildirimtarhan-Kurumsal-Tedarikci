const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const { JWT_SECRET } = require('../config/jwt');

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

    let addresses = user.addresses || [];

    // Adresler boşsa ama faturaAdresi/teslimatAdresi doluysa, onları addresses formatına çevir
    if (addresses.length === 0 && (user.faturaAdresi || user.teslimatAdresi)) {
      const fa = user.faturaAdresi;
      const ta = user.teslimatAdresi;
      if (fa && (typeof fa === 'object') && (fa.acikAdres || fa.sehir || fa.ilce)) {
        addresses.push({
          _id: 'addr_fatura',
          baslik: fa.baslik || 'Fatura Adresi',
          adSoyad: user.ad || '',
          telefon: user.telefon || '',
          sehir: fa.sehir || '',
          ilce: fa.ilce || '',
          mahalle: fa.mahalle || '',
          sokak: fa.sokak || '',
          postaKodu: fa.postaKodu || '',
          acikAdres: fa.acikAdres || '',
          tip: 'fatura',
          varsayilan: true
        });
      }
      if (ta && (typeof ta === 'object') && (ta.acikAdres || ta.sehir || ta.ilce) && JSON.stringify(ta) !== JSON.stringify(fa)) {
        addresses.push({
          _id: 'addr_teslimat',
          baslik: ta.baslik || 'Teslimat Adresi',
          adSoyad: user.ad || '',
          telefon: user.telefon || '',
          sehir: ta.sehir || '',
          ilce: ta.ilce || '',
          mahalle: ta.mahalle || '',
          sokak: ta.sokak || '',
          postaKodu: ta.postaKodu || '',
          acikAdres: ta.acikAdres || '',
          tip: 'teslimat',
          varsayilan: false
        });
      }
    }

    res.json({
      success: true,
      addresses,
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

    const b = req.body;
    const normalized = {
      baslik: b.baslik ?? b.title ?? "Adres",
      adSoyad: b.adSoyad ?? b.fullName ?? "",
      telefon: b.telefon ?? b.phone ?? "",
      sehir: b.sehir ?? b.city ?? "",
      ilce: b.ilce ?? b.district ?? "",
      mahalle: b.mahalle ?? "",
      sokak: b.sokak ?? "",
      postaKodu: b.postaKodu ?? b.postalCode ?? "",
      acikAdres: b.acikAdres ?? b.address ?? "",
      vergiDairesi: b.vergiDairesi ?? "",
      vergiNo: b.vergiNo ?? "",
      tip: b.tip ?? "teslimat",
      varsayilan: b.varsayilan ?? b.isDefault ?? false
    };
    user.addresses.push(normalized);
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

    const { title, fullName, phone, city, district, mahalle, sokak, address, postalCode } = req.body;
    if (title !== undefined) addr.baslik = title;
    if (fullName !== undefined) addr.adSoyad = fullName;
    if (phone !== undefined) addr.telefon = phone;
    if (city !== undefined) addr.sehir = city;
    if (district !== undefined) addr.ilce = district;
    if (mahalle !== undefined) addr.mahalle = mahalle;
    if (sokak !== undefined) addr.sokak = sokak;
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

// ==========================
// DELETE ADDRESS
// ==========================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId || req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const addr = user.addresses.id(req.params.id);
    if (!addr) {
      return res.status(404).json({ success: false, message: "Adres bulunamadı" });
    }

    addr.remove();
    await user.save();

    res.json({
      success: true,
      message: "Adres silindi",
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Adres silinemedi" });
  }
});

module.exports = router;
