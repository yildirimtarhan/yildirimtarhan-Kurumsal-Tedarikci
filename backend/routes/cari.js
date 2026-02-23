const express = require('express');
const router = express.Router();
const CariHesap = require('../models/CariHesap');
const { authMiddleware } = require('../middleware/auth');

// Tüm cari hesapları listele
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, riskDurumu, durum = 'AKTİF' } = req.query;
    
    const query = { durum };
    
    if (search) {
      query.$or = [
        { firmaUnvan: new RegExp(search, 'i') },
        { vknTckn: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }
    
    if (riskDurumu) query.riskDurumu = riskDurumu;
    
    const cariler = await CariHesap.find(query)
      .populate('kullaniciId', 'ad soyad email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await CariHesap.countDocuments(query);
    
    res.json({
      success: true,
      data: cariler,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cari hesap detayı
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const cari = await CariHesap.findById(req.params.id)
      .populate('kullaniciId', 'ad soyad email telefon');
    
    if (!cari) {
      return res.status(404).json({ success: false, message: 'Cari hesap bulunamadı' });
    }
    
    const Fatura = require('../models/Fatura');
    const Tahsilat = require('../models/Tahsilat');
    
    const [sonFaturalar, sonTahsilatlar] = await Promise.all([
      Fatura.find({ cariHesapId: cari._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('faturaNo toplamTutar durum faturaTarihi'),
      Tahsilat.find({ cariHesapId: cari._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('tahsilatNo tutar tahsilatTipi tahsilatTarihi')
    ]);
    
    res.json({
      success: true,
      data: {
        ...cari.toObject(),
        sonFaturalar,
        sonTahsilatlar
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni cari hesap oluştur
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { kullaniciId, firmaUnvan, vknTckn, etiket, adres, telefon, email, krediLimiti, notlar } = req.body;
    
    const existing = await CariHesap.findOne({ vknTckn });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bu VKN/TCKN ile kayıtlı cari hesap zaten var' 
      });
    }
    
    const cari = new CariHesap({
      kullaniciId, firmaUnvan, vknTckn, etiket, adres, telefon, email,
      krediLimiti: krediLimiti || 0, notlar
    });
    
    await cari.save();
    
    res.status(201).json({
      success: true,
      message: 'Cari hesap oluşturuldu',
      data: cari
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cari hesap güncelle
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.bakiye;
    delete updates.toplamBorc;
    delete updates.toplamAlacak;
    
    const cari = await CariHesap.findByIdAndUpdate(req.params.id, updates, { new: true });
    
    if (!cari) {
      return res.status(404).json({ success: false, message: 'Cari hesap bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Cari hesap güncellendi',
      data: cari
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cari hesap ekstresi
router.get('/:id/ekstre', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const cariId = req.params.id;
    
    const Fatura = require('../models/Fatura');
    const Tahsilat = require('../models/Tahsilat');
    
    const query = { cariHesapId: cariId };
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const [faturalar, tahsilatlar] = await Promise.all([
      Fatura.find(query).sort({ createdAt: 1 }),
      Tahsilat.find(query).sort({ createdAt: 1 })
    ]);
    
    const hareketler = [
      ...faturalar.map(f => ({
        tarih: f.createdAt,
        tip: 'FATURA',
        no: f.faturaNo,
        aciklama: `Fatura: ${f.faturaNo}`,
        borc: f.toplamTutar,
        alacak: 0,
        bakiye: 0
      })),
      ...tahsilatlar.map(t => ({
        tarih: t.createdAt,
        tip: 'TAHSİLAT',
        no: t.tahsilatNo,
        aciklama: `Tahsilat: ${t.tahsilatTipi}`,
        borc: 0,
        alacak: t.tutar,
        bakiye: 0
      }))
    ].sort((a, b) => a.tarih - b.tarih);
    
    let runningBalance = 0;
    hareketler.forEach(h => {
      runningBalance += h.alacak - h.borc;
      h.bakiye = runningBalance;
    });
    
    res.json({
      success: true,
      data: hareketler,
      sonBakiye: runningBalance
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Risk raporu
router.get('/rapor/risk', authMiddleware, async (req, res) => {
  try {
    const riskliCariler = await CariHesap.find({
      $or: [{ riskDurumu: 'RİSKLİ' }, { riskDurumu: 'DİKKAT' }]
    }).populate('kullaniciId', 'ad soyad email');
    
    const toplamRisk = riskliCariler.reduce((sum, c) => sum + Math.abs(c.bakiye), 0);
    
    res.json({
      success: true,
      data: riskliCariler,
      toplamRisk,
      count: riskliCariler.length
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;