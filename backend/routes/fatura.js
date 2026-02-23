const express = require('express');
const router = express.Router();
const Fatura = require('../models/Fatura');
const CariHesap = require('../models/CariHesap');
const TaxtenService = require('../services/taxtenService');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const taxtenService = new TaxtenService();

// Fatura listesi
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, durum, cariId, startDate, endDate, search } = req.query;
    
    const query = {};
    if (durum) query.durum = durum;
    if (cariId) query.cariHesapId = cariId;
    if (startDate && endDate) {
      query.faturaTarihi = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (search) {
      query.$or = [
        { faturaNo: new RegExp(search, 'i') },
        { aliciUnvan: new RegExp(search, 'i') },
        { custInvId: new RegExp(search, 'i') }
      ];
    }
    
    const faturalar = await Fatura.find(query)
      .populate('cariHesapId', 'firmaUnvan vknTckn')
      .populate('siparisId', 'siparisNo')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Fatura.countDocuments(query);
    
    const stats = await Fatura.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          toplamTutar: { $sum: '$toplamTutar' },
          bekleyen: { $sum: { $cond: [{ $eq: ['$durum', 'BEKLİYOR'] }, '$toplamTutar', 0] } },
          basarili: { $sum: { $cond: [{ $eq: ['$durum', '1300-BAŞARILI'] }, '$toplamTutar', 0] } }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: faturalar,
      stats: stats[0] || { toplamTutar: 0, bekleyen: 0, basarili: 0 },
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fatura detayı
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const fatura = await Fatura.findById(req.params.id)
      .populate('cariHesapId')
      .populate('siparisId');
    
    if (!fatura) {
      return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
    }
    
    let taxtenStatus = null;
    if (fatura.uuid && fatura.durum !== 'TASLAK') {
      const statusResult = await taxtenService.getInvoiceStatus(fatura.envUUID, fatura.uuid);
      if (statusResult.success) taxtenStatus = statusResult.data;
    }
    
    res.json({ success: true, data: fatura, taxtenStatus });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni fatura oluştur (Taslak)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { cariHesapId, kalemler, aciklama, siparisId, odemeSekli, vadeTarihi } = req.body;
    
    const cari = await CariHesap.findById(cariHesapId);
    if (!cari) return res.status(404).json({ success: false, message: 'Cari hesap bulunamadı' });
    
    let matrah = 0;
    let kdvTutari = 0;
    
    const detayliKalemler = kalemler.map((k, index) => {
      const tutar = k.miktar * k.birimFiyat;
      const kdvOrani = k.kdvOrani || 20;
      const kdv = tutar * (kdvOrani / 100);
      matrah += tutar;
      kdvTutari += kdv;
      
      return {
        siraNo: index + 1,
        malHizmet: k.malHizmet,
        miktar: k.miktar,
        birim: k.birim || 'ADET',
        birimFiyat: k.birimFiyat,
        tutar: tutar,
        kdvOrani: kdvOrani,
        kdvTutari: kdv,
        toplamTutar: tutar + kdv,
        urunKodu: k.urunKodu
      };
    });
    
    const toplamTutar = matrah + kdvTutari;
    
    const fatura = new Fatura({
      cariHesapId,
      aliciVkn: cari.vknTckn,
      aliciEtiket: cari.etiket,
      aliciUnvan: cari.firmaUnvan,
      aliciAdres: cari.adres,
      aliciTelefon: cari.telefon,
      aliciEmail: cari.email,
      kalemler: detayliKalemler,
      matrah,
      kdvOrani: 20,
      kdvTutari,
      toplamTutar,
      aciklama,
      siparisId,
      odemeSekli,
      vadeTarihi,
      durum: 'TASLAK',
      custInvId: siparisId || `F-${Date.now()}`
    });
    
    await fatura.save();
    
    res.status(201).json({
      success: true,
      message: 'Fatura taslak olarak oluşturuldu',
      data: fatura
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fatura gönder (Taxten'e)
router.post('/:id/send', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const fatura = await Fatura.findById(req.params.id).populate('cariHesapId');
    
    if (!fatura) return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
    if (fatura.durum !== 'TASLAK' && fatura.durum !== 'HATA') {
      return res.status(400).json({ success: false, message: 'Bu fatura zaten gönderilmiş' });
    }
    
    const gondericiBilgileri = {
      vkn: process.env.FIRMA_VKN,
      unvan: process.env.FIRMA_UNVAN,
      adres: {
        il: process.env.FIRMA_IL,
        ilce: process.env.FIRMA_ILCE,
        cadde: process.env.FIRMA_ADRES,
        binaNo: process.env.FIRMA_BINA_NO,
        postaKodu: process.env.FIRMA_POSTA_KODU
      },
      telefon: process.env.FIRMA_TELEFON,
      email: process.env.FIRMA_EMAIL,
      website: process.env.FIRMA_WEBSITE,
      vergiDairesi: process.env.FIRMA_VERGI_DAIRESI
    };
    
    const faturaData = {
      faturaNo: fatura.faturaNo,
      custInvId: fatura.custInvId,
      aliciVkn: fatura.aliciVkn,
      aliciEtiket: fatura.aliciEtiket,
      aliciUnvan: fatura.aliciUnvan,
      aliciAdres: fatura.aliciAdres,
      aliciTelefon: fatura.aliciTelefon,
      aliciEmail: fatura.aliciEmail,
      kalemler: fatura.kalemler,
      matrah: fatura.matrah,
      kdvOrani: fatura.kdvOrani,
      kdvTutari: fatura.kdvTutari,
      toplamTutar: fatura.toplamTutar,
      aciklama: fatura.aciklama,
      odemeSekli: fatura.odemeSekli,
      vadeTarihi: fatura.vadeTarihi,
      siparisNo: fatura.siparisId ? fatura.custInvId : null
    };
    
    const result = await taxtenService.sendInvoice(faturaData, gondericiBilgileri);
    
    if (result.success) {
      fatura.uuid = result.uuid;
      fatura.envUUID = result.envUUID;
      fatura.faturaNo = result.faturaId || fatura.faturaNo;
      fatura.durum = 'GÖNDERİLDİ';
      fatura.taxtenGonderimTarihi = new Date();
      await fatura.save();
      
      await fatura.cariHesapId.bakiyeGuncelle(fatura.toplamTutar, 0);
      
      res.json({
        success: true,
        message: 'Fatura Taxten\'e gönderildi',
        data: { faturaId: fatura._id, uuid: result.uuid, envUUID: result.envUUID, gibFaturaNo: result.faturaId }
      });
    } else {
      fatura.durum = 'HATA';
      fatura.taxtenHata = JSON.stringify(result.error);
      await fatura.save();
      
      res.status(400).json({ success: false, message: 'Fatura gönderilemedi', error: result.error });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fatura durumunu güncelle
router.post('/:id/sync', authMiddleware, async (req, res) => {
  try {
    const fatura = await Fatura.findById(req.params.id);
    
    if (!fatura || !fatura.uuid) {
      return res.status(404).json({ success: false, message: 'Fatura bulunamadı veya henüz gönderilmemiş' });
    }
    
    const statusResult = await taxtenService.getInvoiceStatus(fatura.envUUID, fatura.uuid);
    
    if (statusResult.success) {
      const status = statusResult.data;
      const responseCode = status.ResponseCode;
      
      if (responseCode === '1300') fatura.durum = '1300-BAŞARILI';
      else if (responseCode.startsWith('1')) fatura.durum = 'BEKLİYOR';
      else fatura.durum = 'HATA';
      
      fatura.sistemYanitKodu = responseCode;
      fatura.sistemYanitAciklama = taxtenService.getStatusDescription(responseCode);
      fatura.sonGuncelleme = new Date();
      
      await fatura.save();
      
      res.json({
        success: true,
        message: 'Durum güncellendi',
        data: { durum: fatura.durum, kod: responseCode, aciklama: fatura.sistemYanitAciklama }
      });
    } else {
      res.status(400).json({ success: false, message: 'Durum sorgulanamadı', error: statusResult.error });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fatura PDF indir
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const fatura = await Fatura.findById(req.params.id);
    
    if (!fatura || !fatura.uuid) {
      return res.status(404).json({ success: false, message: 'Fatura bulunamadı veya UUID yok' });
    }
    
    const viewResult = await taxtenService.getInvoiceView(fatura.uuid, 'OUTBOUND', 'PDF');
    
    if (viewResult.success) {
      const pdfBuffer = Buffer.from(viewResult.data.DocData, 'base64');
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=\"${fatura.faturaNo || 'fatura'}.pdf\"`);
      res.send(pdfBuffer);
    } else {
      res.status(400).json({ success: false, message: 'PDF alınamadı', error: viewResult.error });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu durum senkronizasyonu
router.post('/admin/sync-all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const query = { durum: { $in: ['GÖNDERİLDİ', 'BEKLİYOR'] } };
    
    if (startDate && endDate) {
      query.taxtenGonderimTarihi = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const faturalar = await Fatura.find(query).select('uuid envUUID _id');
    
    const sonuclar = [];
    for (const fatura of faturalar.slice(0, 20)) {
      const result = await taxtenService.getInvoiceStatus(fatura.envUUID, fatura.uuid);
      
      if (result.success) {
        const code = result.data.ResponseCode;
        let yeniDurum = fatura.durum;
        
        if (code === '1300') yeniDurum = '1300-BAŞARILI';
        else if (code.startsWith('1')) yeniDurum = 'BEKLİYOR';
        else yeniDurum = 'HATA';
        
        await Fatura.findByIdAndUpdate(fatura._id, {
          durum: yeniDurum,
          sistemYanitKodu: code,
          sistemYanitAciklama: taxtenService.getStatusDescription(code),
          sonGuncelleme: new Date()
        });
        
        sonuclar.push({ id: fatura._id, durum: yeniDurum, kod: code });
      }
    }
    
    res.json({ success: true, message: `${sonuclar.length} fatura senkronize edildi`, data: sonuclar });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;