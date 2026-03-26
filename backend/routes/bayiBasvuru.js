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
      firmaAdi, vergiDairesi, vergiNo, tcNo, telefon, email, mesaj,
      faturaIl, faturaIlce, faturaMahalle, faturaSokak, faturaAdres,
      teslimatIl, teslimatIlce, teslimatMahalle, teslimatSokak, teslimatAdres,
    } = req.body;
    if (!firmaAdi || !firmaAdi.trim()) {
      return res.status(400).json({ success: false, message: "Firma adı zorunludur." });
    }
    if (!vergiDairesi || !vergiDairesi.trim()) {
      return res.status(400).json({ success: false, message: "Vergi dairesi zorunludur." });
    }
    const vergiNoVal = vergiNo ? String(vergiNo).trim() : "";
    const tcNoVal = tcNo ? String(tcNo).trim() : "";
    if (!vergiNoVal && !tcNoVal) {
      return res.status(400).json({ success: false, message: "Vergi numarası (VKN) veya TC kimlik numarası zorunludur." });
    }
    const user = await User.findById(req.user.id).select("ad email telefon");
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    const basvuruEmail = (email && String(email).trim() && String(email).includes("@"))
      ? String(email).trim()
      : (user.email || "");
    if (!basvuruEmail) {
      return res.status(400).json({ success: false, message: "E-posta adresi zorunludur." });
    }
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
      email: basvuruEmail,
      ad: user.ad || "",
      firmaAdi: firmaAdi.trim(),
      vergiDairesi: vergiDairesi.trim(),
      vergiNo: vergiNoVal || "",
      tcNo: tcNoVal || "",
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
    try {
      const emailService = require("../services/emailService");
      await emailService.sendBayilikBasvuruAlindi(basvuru.email, basvuru.firmaAdi || basvuru.ad);
      console.log("✅ Bayilik başvuru e-postası gönderildi:", basvuru.email);
    } catch (emailErr) {
      console.warn("Bayilik başvuru e-postası gönderilemedi:", emailErr.message);
    }
    console.log("✅ Bayilik başvurusu kaydedildi, admin panelde listelenecek. ID:", basvuru._id);
    res.json({ success: true, message: "Bayilik başvurunuz alındı. Admin onayından sonra toptan fiyatlara erişebilirsiniz.", basvuru });
  } catch (err) {
    console.error("Bayilik başvuru hatası:", err.message);
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
