/**
 * Destek Soruları API - Müşteri tarafı
 */
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const SupportTicket = require("../models/SupportTicket");

const { JWT_SECRET } = require('../config/jwt');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Giriş yapmanız gerekiyor" });
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Oturum süresi doldu, lütfen tekrar giriş yapın" });
  }
}

// Listele
router.get("/", authMiddleware, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .select("konu durum siparisNo createdAt updatedAt");
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Tek talep detay
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Talep bulunamadı" });
    }
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Yeni talep oluştur
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { konu, mesaj, siparisNo } = req.body;
    if (!konu || !mesaj) {
      return res.status(400).json({ success: false, message: "Konu ve mesaj zorunludur" });
    }
    const ticket = await SupportTicket.create({
      userId: req.userId,
      konu: konu.trim(),
      siparisNo: (siparisNo || "").trim(),
      mesajlar: [{ from: "kullanici", text: mesaj.trim() }],
      durum: "açık"
    });
    res.json({ success: true, message: "Destek talebiniz alındı", ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kullanıcı ek mesaj ekler (yanıt)
router.post("/:id/mesaj", authMiddleware, async (req, res) => {
  try {
    const { mesaj } = req.body;
    if (!mesaj || !mesaj.trim()) {
      return res.status(400).json({ success: false, message: "Mesaj boş olamaz" });
    }
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Talep bulunamadı" });
    }
    if (ticket.durum === "kapalı") {
      return res.status(400).json({ success: false, message: "Bu talep kapatılmış, yeni mesaj ekleyemezsiniz" });
    }
    ticket.mesajlar.push({ from: "kullanici", text: mesaj.trim() });
    ticket.durum = "açık";
    ticket.updatedAt = new Date();
    await ticket.save();
    res.json({ success: true, message: "Mesajınız gönderildi", ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
