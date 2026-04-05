const express = require('express');
const router = express.Router();
const Tahsilat = require('../models/Tahsilat');
const CariHesap = require('../models/CariHesap');
const Fatura = require('../models/Fatura');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const KasaIslem = require('../models/KasaIslem');
const KasaBanka = require('../models/KasaBanka');

// Tahsilat listesi
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, cariId, tahsilatTipi, durum = 'ONAYLANDI', startDate, endDate } = req.query;
    
    const query = { durum };
    if (cariId) query.cariHesapId = cariId;
    if (tahsilatTipi) query.tahsilatTipi = tahsilatTipi;
    if (startDate && endDate) {
      query.tahsilatTarihi = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const tahsilatlar = await Tahsilat.find(query)
      .populate('cariHesapId', 'firmaUnvan vknTckn')
      .populate('faturaId', 'faturaNo toplamTutar')
      .sort({ tahsilatTarihi: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Tahsilat.countDocuments(query);
    
    const toplam = await Tahsilat.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$tutar' } } }
    ]);
    
    res.json({
      success: true,
      data: tahsilatlar,
      toplam: toplam[0]?.total || 0,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tahsilat detayı
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const tahsilat = await Tahsilat.findById(req.params.id)
      .populate('cariHesapId')
      .populate('faturaId');
    
    if (!tahsilat) {
      return res.status(404).json({ success: false, message: 'Tahsilat bulunamadı' });
    }
    
    res.json({ success: true, data: tahsilat });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni tahsilat kaydet
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { cariHesapId, faturaId, tutar, tahsilatTipi, odemeDetay, aciklama, tahsilatTarihi, kasaId } = req.body;
    
    const cari = await CariHesap.findById(cariHesapId);
    if (!cari) return res.status(404).json({ success: false, message: 'Cari hesap bulunamadı' });
    
    let fatura = null;
    if (faturaId) {
      fatura = await Fatura.findById(faturaId);
      if (!fatura) return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
      
      const mevcutTahsilatlar = await Tahsilat.find({ faturaId, durum: 'ONAYLANDI' });
      const odenenTutar = mevcutTahsilatlar.reduce((sum, t) => sum + t.tutar, 0);
      
      if (odenenTutar + tutar > fatura.toplamTutar) {
        return res.status(400).json({
          success: false,
          message: 'Tahsilat tutarı fatura tutarından büyük olamaz',
          data: { faturaTutari: fatura.toplamTutar, odenen: odenenTutar, kalan: fatura.toplamTutar - odenenTutar }
        });
      }
    }
    
    const tahsilat = new Tahsilat({
      cariHesapId,
      faturaId,
      tutar,
      tahsilatTipi,
      odemeDetay,
      aciklama,
      tahsilatTarihi: tahsilatTarihi || new Date(),
      olusturanKullanici: req.user._id,
      durum: 'ONAYLANDI'
    });
    
    await tahsilat.save();
    
    await cari.bakiyeGuncelle(0, tutar);
    
    // Kasa / Banka entegrasyonu
    if (kasaId) {
      const kasa = await KasaBanka.findById(kasaId);
      if (kasa) {
        await KasaIslem.create({
          kasaId: kasa._id,
          islemTipi: 'GİRİŞ',
          tutar,
          aciklama: aciklama || `${cari.firmaUnvan} firmasından tahsilat`,
          ilgiliModul: 'TAHSİLAT',
          referansId: tahsilat._id,
          tarih: tahsilatTarihi || new Date(),
          olusturanKullanici: req.user._id
        });
        await kasa.bakiyeGuncelle(tutar, 'GİRİŞ');
      }
    }
    
    if (fatura) {
      const tumTahsilatlar = await Tahsilat.find({ faturaId, durum: 'ONAYLANDI' });
      const toplamOdenen = tumTahsilatlar.reduce((sum, t) => sum + t.tutar, 0);
      
      if (toplamOdenen >= fatura.toplamTutar) {
        await Fatura.findByIdAndUpdate(faturaId, { odemeDurumu: 'ÖDENDİ', odemeTarihi: new Date() });
      } else if (toplamOdenen > 0) {
        await Fatura.findByIdAndUpdate(faturaId, { odemeDurumu: 'KISMEN_ÖDENDİ' });
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Tahsilat kaydedildi',
      data: tahsilat
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tahsilat iptal
router.post('/:id/cancel', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const tahsilat = await Tahsilat.findById(req.params.id);
    
    if (!tahsilat) return res.status(404).json({ success: false, message: 'Tahsilat bulunamadı' });
    if (tahsilat.durum === 'İPTAL') return res.status(400).json({ success: false, message: 'Tahsilat zaten iptal edilmiş' });
    
    tahsilat.durum = 'İPTAL';
    await tahsilat.save();
    
    const cari = await CariHesap.findById(tahsilat.cariHesapId);
    if (cari) await cari.bakiyeGuncelle(0, -tahsilat.tutar);
    
    res.json({ success: true, message: 'Tahsilat iptal edildi', data: tahsilat });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Günlük/haftalık/aylık tahsilat raporu
router.get('/rapor/ozet', authMiddleware, async (req, res) => {
  try {
    const { tip = 'gunluk' } = req.query;
    
    let startDate = new Date();
    let endDate = new Date();
    
    if (tip === 'gunluk') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (tip === 'haftalik') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (tip === 'aylik') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }
    
    const rapor = await Tahsilat.aggregate([
      {
        $match: {
          durum: 'ONAYLANDI',
          tahsilatTarihi: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$tahsilatTipi',
          toplam: { $sum: '$tutar' },
          adet: { $sum: 1 }
        }
      },
      { $sort: { toplam: -1 } }
    ]);
    
    const genelToplam = rapor.reduce((sum, r) => sum + r.toplam, 0);
    
    res.json({
      success: true,
      data: rapor,
      genelToplam,
      periyot: { tip, startDate, endDate }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vade yaklaşan tahsilatlar (çek/senet)
router.get('/rapor/vade-yaklasan', authMiddleware, async (req, res) => {
  try {
    const { gun = 7 } = req.query;
    
    const hedefTarih = new Date();
    hedefTarih.setDate(hedefTarih.getDate() + parseInt(gun));
    
    const tahsilatlar = await Tahsilat.find({
      tahsilatTipi: { $in: ['ÇEK', 'SENET'] },
      durum: 'ONAYLANDI',
      'odemeDetay.vadeTarihi': { $gte: new Date(), $lte: hedefTarih }
    })
    .populate('cariHesapId', 'firmaUnvan')
    .sort({ 'odemeDetay.vadeTarihi': 1 });
    
    res.json({
      success: true,
      data: tahsilatlar,
      toplamTutar: tahsilatlar.reduce((sum, t) => sum + t.tutar, 0)
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;