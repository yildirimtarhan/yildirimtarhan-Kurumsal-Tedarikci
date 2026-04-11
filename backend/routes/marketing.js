const express = require('express');
const router = express.Router();
const MarketingLead = require('../models/MarketingLead');
const { generateBusinessProposal } = require('../services/marketingService');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

// Admin yetki kontrolü middleware
function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: "Token gerekli" });

  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.rol !== "admin" && decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin yetkisi gerekli" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Geçersiz token" });
  }
}

// Tüm route'ları koru
router.use(adminOnly);

// Tüm adayları getir
router.get('/leads', async (req, res) => {
  try {
    const leads = await MarketingLead.find().sort({ createdAt: -1 });
    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Yeni aday ekle
router.post('/leads', async (req, res) => {
  try {
    const lead = new MarketingLead(req.body);
    await lead.save();
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// AI ile teklif metni üret
router.post('/leads/:id/generate', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Aday bulunamadı" });

    const proposal = await generateBusinessProposal(lead);
    lead.sonTeklifMetni = proposal;
    lead.durum = 'teklif_hazirlandi';
    await lead.save();

    res.json({ success: true, proposal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Teklifi Brevo üzerinden gönder
router.post('/leads/:id/send', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.id);
    if (!lead || !lead.sonTeklifMetni) {
      return res.status(400).json({ success: false, message: "Teklif metni henüz hazır değil" });
    }

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    // AI çıktısından konu başlığını ve gövdeyi ayırmaya çalış (basit bir regexle veya AI'dan belli formatta isteyerek)
    let subject = "Kurumsal Tedarik Çözümleri Teklifimiz";
    let htmlContent = lead.sonTeklifMetni.replace(/\n/g, '<br>');

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${htmlContent}
      </div>
    `;
    sendSmtpEmail.sender = { name: "Kurumsal Tedarikçi", email: process.env.SMTP_FROM_EMAIL };
    sendSmtpEmail.to = [{ email: lead.email, name: lead.yetkiliAdSoyad }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    lead.durum = 'teklif_gonderildi';
    lead.gonderimTarihi = new Date();
    await lead.save();

    res.json({ success: true, message: "Teklif başarıyla gönderildi" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// SOSYAL MEDYA & VİDEO YOÖNETİMİ
// ==========================================

// Yeni sosyal içerik/video planı üret
router.post('/social/generate', async (req, res) => {
  try {
    const { platform, urunBilgisi } = req.body;
    const { generateSocialContent } = require('../services/marketingService');
    
    const content = await generateSocialContent(platform, urunBilgisi);
    
    const newDoc = new (require('../models/SocialContent'))({
      baslik: `${platform.toUpperCase()} - ${urunBilgisi.substring(0, 20)}`,
      platform,
      aciklama: content.caption,
      hashtags: content.hashtags,
      videoSenaryosu: content.video_script,
      icerikTipi: (platform === 'tiktok' || platform === 'instagram') ? 'reels' : 'post'
    });
    
    await newDoc.save();
    res.json({ success: true, content: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Tüm sosyal planları listele
router.get('/social', async (req, res) => {
  try {
    const SocialContent = require('../models/SocialContent');
    const plans = await SocialContent.find().sort({ createdAt: -1 });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
