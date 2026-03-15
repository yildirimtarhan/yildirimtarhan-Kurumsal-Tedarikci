const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const BayiBasvuru = require("../models/BayiBasvuru");
const User = require("../models/User");
const { JWT_SECRET } = require("../config/jwt");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Giriş yapmanız gerekiyor." });
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Oturum geçersiz veya süresi dolmuş." });
  }
}

// Kullanıcı kendi başvurusunu yapar (giriş zorunlu)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      firmaAdi, vergiDairesi, vergiNo, tcNo, telefon, mesaj,
      faturaIl, faturaIlce, faturaMahalle, faturaSokak, faturaAdres,
      teslimatIl, teslimatIlce, teslimatMahalle, teslimatSokak, teslimatAdres,
    } = req.body;
    if (!firmaAdi || !firmaAdi.trim()) {
      return res.status(400).json({ success: false, message: "Firma adı zorunludur." });
    }
    if (!vergiDairesi || !vergiDairesi.trim()) {
      return res.status(400).json({ success: false, message: "Vergi dairesi zorunludur." });
    }
    if (!vergiNo || !String(vergiNo).trim()) {
      return res.status(400).json({ success: false, message: "Vergi numarası (VKN) zorunludur." });
    }
    if (!tcNo || !String(tcNo).trim()) {
      return res.status(400).json({ success: false, message: "TC kimlik numarası zorunludur." });
    }
    const user = await User.findById(req.user.id).select("ad email telefon");
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    const bekleyen = await BayiBasvuru.findOne({ userId: user._id, durum: "beklemede" });
    if (bekleyen) {
      return res.status(400).json({ success: false, message: "Zaten beklemede bir bayilik başvurunuz var." });
    }
    const onayli = await BayiBasvuru.findOne({ userId: user._id, durum: "onaylandi" });
    if (onayli) {
      return res.status(400).json({ success: false, message: "Bayi üyeliğiniz zaten onaylı." });
    }
    const basvuru = await BayiBasvuru.create({
      userId: user._id,
      email: user.email,
      ad: user.ad || "",
      firmaAdi: firmaAdi.trim(),
      vergiDairesi: vergiDairesi.trim(),
      vergiNo: String(vergiNo).trim(),
      tcNo: String(tcNo).trim(),
      telefon: telefon || user.telefon || "",
      mesaj: mesaj || "",
      faturaIl: (faturaIl || "").trim(),
      faturaIlce: (faturaIlce || "").trim(),
      faturaMahalle: (faturaMahalle || "").trim(),
      faturaSokak: (faturaSokak || "").trim(),
      faturaAdres: (faturaAdres || "").trim(),
      teslimatIl: (teslimatIl || "").trim(),
      teslimatIlce: (teslimatIlce || "").trim(),
      teslimatMahalle: (teslimatMahalle || "").trim(),
      teslimatSokak: (teslimatSokak || "").trim(),
      teslimatAdres: (teslimatAdres || "").trim(),
      durum: "beklemede",
    });
    res.json({ success: true, message: "Bayilik başvurunuz alındı. Admin onayından sonra toptan fiyatlara erişebilirsiniz.", basvuru });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kullanıcı kendi başvurusunu görür
router.get("/benim", authMiddleware, async (req, res) => {
  try {
    const basvurular = await BayiBasvuru.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, basvurular });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
