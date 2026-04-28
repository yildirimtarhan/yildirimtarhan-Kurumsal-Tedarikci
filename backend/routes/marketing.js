const express = require('express');
const router = express.Router();
const MarketingLead = require('../models/MarketingLead');
const { generateBusinessProposal } = require('../services/marketingService');
const emailService = require('../services/emailService');
const voiceOutboundService = require('../services/voiceOutboundService');
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

// Satış hunisi özeti (dashboard kartları) — /leads/:id rotalarından önce tanımlı olmalı
router.get('/leads/summary', async (req, res) => {
  try {
    const leads = await MarketingLead.find().select(
      'durum sonrakiEylemTarihi randevuBaslangic'
    );
    const byStage = {};
    for (const l of leads) {
      byStage[l.durum] = (byStage[l.durum] || 0) + 1;
    }
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let takipBugun = 0;
    let randevuBuHafta = 0;
    for (const l of leads) {
      if (l.sonrakiEylemTarihi) {
        const t = new Date(l.sonrakiEylemTarihi);
        if (t >= dayStart && t < dayEnd) takipBugun += 1;
      }
      if (l.randevuBaslangic) {
        const r = new Date(l.randevuBaslangic);
        if (r >= now && r <= weekEnd) randevuBuHafta += 1;
      }
    }

    res.json({
      success: true,
      total: leads.length,
      byStage,
      takipBugun,
      randevuBuHafta
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Yeni aday ekle
router.post('/leads', async (req, res) => {
  try {
    const leadData = { ...req.body };
    
    // Eğer onay verildiyse meta verileri ekle
    if (leadData.emailOnay || leadData.smsOnay) {
      leadData.onayTarihi = new Date();
      leadData.onayIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    }
    
    const lead = new MarketingLead(leadData);
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
    lead.aktiviteler.push({
      tip: 'teklif',
      baslik: 'AI teklif taslağı oluşturuldu',
      not: 'Gemini ile metin üretildi',
      olusturan: 'sistem'
    });
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

    let subject = "Kurumsal Tedarik Çözümleri Teklifimiz";
    const body = lead.sonTeklifMetni.replace(/\n/g, '<br>');
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${body}
      </div>
    `;

    await emailService.send({
      to: lead.email,
      subject,
      htmlContent
    });

    lead.durum = 'teklif_gonderildi';
    lead.gonderimTarihi = new Date();
    lead.aktiviteler.push({
      tip: 'email',
      baslik: 'Teklif e-postası gönderildi',
      not: subject,
      olusturan: 'sistem'
    });
    await lead.save();

    res.json({ success: true, message: "Teklif başarıyla gönderildi" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PATCHABLE_LEAD = new Set([
  'firmaAdi',
  'sektor',
  'email',
  'telefon',
  'yetkiliAdSoyad',
  'webSitesi',
  'durum',
  'sonrakiEylemTarihi',
  'randevuBaslangic',
  'randevuBitis',
  'randevuNotu',
  'randevuKanal',
  'emailOnay',
  'smsOnay',
  'aiNotlari'
]);

function parseDateInput(v) {
  if (v === null || v === '') return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Aday güncelle (hunisi, randevu, sonraki adım)
router.patch('/leads/:id', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Aday bulunamadı' });

    for (const key of PATCHABLE_LEAD) {
      if (req.body[key] === undefined) continue;
      if (key === 'emailOnay' || key === 'smsOnay') {
        const newVal = Boolean(req.body[key]);
        // İzin ilk kez veriliyorsa meta verileri güncelle
        if (newVal && !lead[key]) {
          lead.onayTarihi = new Date();
          lead.onayIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        }
        lead[key] = newVal;
        continue;
      }
      if (
        key === 'sonrakiEylemTarihi' ||
        key === 'randevuBaslangic' ||
        key === 'randevuBitis'
      ) {
        const parsed = parseDateInput(req.body[key]);
        lead[key] = parsed;
        continue;
      }
      lead[key] = req.body[key];
    }

    await lead.save();
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Aktivite / arama notu ekle
router.post('/leads/:id/activity', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Aday bulunamadı' });

    const { tip, baslik, not, sonuc } = req.body;
    lead.aktiviteler.push({
      tip: tip || 'not',
      baslik: baslik || '',
      not: not || '',
      sonuc: sonuc || '',
      olusturan: 'admin'
    });

    if (tip === 'arama' && sonuc === 'ulasildi' && lead.durum === 'yeni') {
      lead.durum = 'ilk_temas';
    }
    if (tip === 'randevu') {
      lead.durum = 'randevu_planli';
    }

    await lead.save();
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Profesyonel takip e-postası (şablon)
router.post('/leads/:id/followup-email', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Aday bulunamadı' });

    if (!lead.emailOnay) {
      return res.status(403).json({ success: false, message: 'Bu adayın e-posta iletişim izni bulunmamaktadır.' });
    }

    const ekNot = (req.body && req.body.not) ? String(req.body.not).trim() : '';
    const ad = lead.yetkiliAdSoyad || 'Yetkili';
    const subject = `Kurumsal Tedarikçi — ${lead.firmaAdi} için kısa hatırlatma`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
        <p>Sayın ${ad},</p>
        <p><strong>${lead.firmaAdi}</strong> için daha önce ilettiğimiz kurumsal tedarik ve dijital çözümler hakkında kısa bir hatırlatma yapmak istedik.</p>
        <p>Uygun olduğunuzda kısa bir görüşme veya demo için tarih önerebilirsiniz.</p>
        ${ekNot ? `<p style="background:#f3f4f6;padding:12px;border-radius:8px;">${ekNot.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ''}
        <p style="margin-top:24px;">
          <a href="https://tedarikci.org.tr/iletisim.html" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;">İletişim</a>
        </p>
        <p style="font-size:12px;color:#6b7280;margin-top:32px;">Kurumsal Tedarikçi · tedarikci.org.tr</p>
      </div>
    `;

    await emailService.send({
      to: lead.email,
      subject,
      htmlContent
    });

    lead.aktiviteler.push({
      tip: 'email',
      baslik: 'Takip / hatırlatma e-postası',
      not: ekNot || subject,
      olusturan: 'admin'
    });
    if (lead.durum === 'teklif_gonderildi' || lead.durum === 'cevap_alindi') {
      lead.durum = 'takipte';
    }
    await lead.save();

    res.json({ success: true, message: 'Takip e-postası gönderildi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Adayın görüşme geçmişini getir (AICallSession)
router.get('/leads/:id/sessions', async (req, res) => {
  try {
    const AICallSession = require('../models/AICallSession');
    const sessions = await AICallSession.find({ leadId: req.params.id })
      .sort({ createdAt: -1 })
      .select('createdAt status summary emailSent callSid recordingUrl duration');
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/leads/:id', async (req, res) => {
  try {
    const r = await MarketingLead.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Aday bulunamadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Giden sesli arama (TTS): Twilio Polly Filiz (TR) veya VOICE_WEBHOOK_URL (NetGSM / santral köprüsü)
 * Body: { tur: 'randevu_hatirlatma' | 'tanitim' | 'ozel', ozelMetin?: string }
 */
router.post('/leads/:id/voice-call', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Aday bulunamadı' });

    const tur = req.body.tur || 'tanitim';
    const ozelMetin = req.body.ozelMetin;

    const result = await voiceOutboundService.initiateOutboundCall({
      lead,
      tur,
      ozelMetin
    });

    lead.aktiviteler.push({
      tip: 'arama',
      baslik: 'Otomatik sesli arama (TTS) tetiklendi',
      not: `${tur} — ${result.provider || ''} job ${result.jobId}`,
      sonuc: 'geri_donulecek',
      olusturan: 'sistem'
    });
    await lead.save();

    res.json({
      success: true,
      message: 'Sesli arama kuyruğa alındı',
      ...result
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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
