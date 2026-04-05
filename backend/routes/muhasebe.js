const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const DefterKaydi = require('../models/DefterKaydi');
const BeyanDurum = require('../models/BeyanDurum');
const Order = require('../models/Order');
const KasaBanka = require('../models/KasaBanka');
const KasaIslem = require('../models/KasaIslem');

// ── Auth middleware ───────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ success: false, message: 'Token gerekli' });
  const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : auth;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.rol !== 'admin') return res.status(403).json({ success: false, message: 'Admin yetkisi gerekli' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token geçersiz' });
  }
}

// ── Yardımcı: Ay → Dönem (Q) ─────────────────────────────────────────────────
function ayToQ(ay) {
  if (ay <= 3) return 'Q1';
  if (ay <= 6) return 'Q2';
  if (ay <= 9) return 'Q3';
  return 'Q4';
}

// ── Yardımcı: Beyan son günlerini hesapla ─────────────────────────────────────
function sonGunHesapla(tur, yil, donem) {
  switch (tur) {
    case 'kdv':
      // 3 aylık; son Q ayını izleyen ayın 26'sı
      const kdvSonAy = { Q1: 4, Q2: 7, Q3: 10, Q4: 1 };
      const kdvYil = donem === 'Q4' ? yil + 1 : yil;
      return new Date(kdvYil, kdvSonAy[donem] - 1, 26);
    case 'geciciVergi':
      const geciciMap = { G1: [5, 17], G2: [8, 17], G3: [11, 17] };
      const [gAy, gGun] = geciciMap[donem] || [5, 17];
      return new Date(yil, gAy - 1, gGun);
    case 'muhtasar':
      // Her ayın 26'sı
      const mAy = parseInt(donem, 10);
      const mYil = mAy === 12 ? yil + 1 : yil;
      const surAy = mAy === 12 ? 1 : mAy + 1;
      return new Date(mYil, surAy - 1, 26);
    case 'gelirVergisi':
      return new Date(yil + 1, 2, 31); // 31 Mart
    case 'bagkur':
      const bAy = parseInt(donem, 10);
      return new Date(yil, bAy - 1, 28); // Ayın sonu (yaklaşık)
    default:
      return null;
  }
}

// ── Yardımcı: Durum otomatik güncelle ─────────────────────────────────────────
function durumHesapla(beyan) {
  if (beyan.durum === 'verildi' || beyan.durum === 'muaf') return beyan.durum;
  if (!beyan.sonGun) return beyan.durum;
  if (new Date() > beyan.sonGun) return 'gecikti';
  return beyan.durum;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  İŞLETME DEFTERİ ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/muhasebe/defter?yil=2025&donem=Q1&tip=gelir
router.get('/defter', adminAuth, async (req, res) => {
  try {
    const { yil, donem, tip, ay, limit = 200, skip = 0 } = req.query;
    const filter = {};
    if (yil) filter.yil = parseInt(yil);
    if (donem) filter.donem = donem;
    if (tip) filter.tip = tip;
    if (ay) filter.ay = parseInt(ay);

    const kayitlar = await DefterKaydi.find(filter)
      .sort({ tarih: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const toplam = await DefterKaydi.countDocuments(filter);

    // Özet hesapla
    const gelirlStatsPipeline = [
      { $match: { ...filter, tip: 'gelir' } },
      { $group: {
        _id: null,
        toplamKdvHaric: { $sum: '$kdvHaricTutar' },
        toplamKdv: { $sum: '$kdvTutari' },
        toplamKdvDahil: { $sum: '$kdvDahilTutar' },
        adet: { $sum: 1 }
      }}
    ];
    const giderStatsPipeline = [
      { $match: { ...filter, tip: 'gider' } },
      { $group: {
        _id: null,
        toplamKdvHaric: { $sum: '$kdvHaricTutar' },
        toplamKdv: { $sum: '$kdvTutari' },
        toplamKdvDahil: { $sum: '$kdvDahilTutar' },
        toplamStopaj: { $sum: '$stopajTutari' },
        adet: { $sum: 1 }
      }}
    ];

    const [gelirStats, giderStats] = await Promise.all([
      DefterKaydi.aggregate(gelirlStatsPipeline),
      DefterKaydi.aggregate(giderStatsPipeline)
    ]);

    res.json({
      success: true,
      kayitlar,
      toplam,
      ozet: {
        gelir: gelirStats[0] || { toplamKdvHaric: 0, toplamKdv: 0, toplamKdvDahil: 0, adet: 0 },
        gider: giderStats[0] || { toplamKdvHaric: 0, toplamKdv: 0, toplamKdvDahil: 0, toplamStopaj: 0, adet: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/muhasebe/defter — Manuel kayıt ekle
router.post('/defter', adminAuth, async (req, res) => {
  try {
    const { tip, tarih, aciklama, karsiTaraf, faturaNo, kategori,
            kdvHaricTutar, kdvOrani, stopajOrani, notlar, kasaId } = req.body;

    if (!tip || !tarih || !aciklama || kdvHaricTutar === undefined) {
      return res.status(400).json({ success: false, message: 'tip, tarih, aciklama ve kdvHaricTutar zorunlu' });
    }

    const d = new Date(tarih);
    const yil = d.getFullYear();
    const ay = d.getMonth() + 1;
    const donem = `${yil}-${ayToQ(ay)}`;

    const oran = Number(kdvOrani ?? 20);
    const haric = Number(kdvHaricTutar);
    const kdv = parseFloat((haric * oran / 100).toFixed(2));
    const dahil = parseFloat((haric + kdv).toFixed(2));

    const stOrani = Number(stopajOrani ?? 0);
    const stTutari = parseFloat((haric * stOrani / 100).toFixed(2));

    const kayit = new DefterKaydi({
      tip, tarih: d, aciklama, karsiTaraf, faturaNo, kategori,
      kdvHaricTutar: haric, kdvOrani: oran, kdvTutari: kdv, kdvDahilTutar: dahil,
      stopajOrani: stOrani, stopajTutari: stTutari,
      yil, ay, donem, kaynak: 'manuel', notlar, kasaId: kasaId || null
    });

    // ── Kasa / Banka Entegrasyonu ──
    if (kasaId) {
      const kasa = await KasaBanka.findById(kasaId);
      if (kasa) {
        const islemTipi = tip === 'gelir' ? 'GİRİŞ' : 'ÇIKIŞ';
        const yeniIslem = await KasaIslem.create({
          kasaId: kasa._id,
          islemTipi,
          tutar: dahil,
          aciklama: `${aciklama} (Muhasebe Kaydı #${faturaNo || ''})`,
          ilgiliModul: 'GIDER',
          referansId: kayit._id,
          tarih: d,
          olusturanKullanici: req.user.userId
        });
        
        kayit.kasaIslemId = yeniIslem._id;
        await kasa.bakiyeGuncelle(dahil, islemTipi);
      }
    }

    await kayit.save();

    res.json({ success: true, kayit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/muhasebe/defter/:id
router.put('/defter/:id', adminAuth, async (req, res) => {
  try {
    const { kdvHaricTutar, kdvOrani, stopajOrani, tarih, ...rest } = req.body;
    const update = { ...rest };

    if (tarih) {
      const d = new Date(tarih);
      update.tarih = d;
      update.yil = d.getFullYear();
      update.ay = d.getMonth() + 1;
      update.donem = `${update.yil}-${ayToQ(update.ay)}`;
    }
    if (kdvHaricTutar !== undefined) {
      const haric = Number(kdvHaricTutar);
      const oran = Number(kdvOrani ?? 20);
      update.kdvHaricTutar = haric;
      update.kdvOrani = oran;
      update.kdvTutari = parseFloat((haric * oran / 100).toFixed(2));
      update.kdvDahilTutar = parseFloat((haric + update.kdvTutari).toFixed(2));
    }
    if (stopajOrani !== undefined) {
      update.stopajOrani = Number(stopajOrani);
      const base = update.kdvHaricTutar ?? (await DefterKaydi.findById(req.params.id)).kdvHaricTutar;
      update.stopajTutari = parseFloat((base * update.stopajOrani / 100).toFixed(2));
    }

    const kayit = await DefterKaydi.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, kayit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/muhasebe/defter/:id
router.delete('/defter/:id', adminAuth, async (req, res) => {
  try {
    const kayit = await DefterKaydi.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });

    // ── Kasa Entegrasyonu İptali ──
    if (kayit.kasaId && kayit.kasaIslemId) {
      const islem = await KasaIslem.findById(kayit.kasaIslemId);
      if (islem) {
        const kasa = await KasaBanka.findById(islem.kasaId);
        if (kasa) {
          // İşlemi tersine çevir
          const tersTip = islem.islemTipi === 'GİRİŞ' ? 'ÇIKIŞ' : 'GİRİŞ';
          await kasa.bakiyeGuncelle(islem.tutar, tersTip);
        }
        await KasaIslem.findByIdAndDelete(islem._id);
      }
    }

    await DefterKaydi.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Kayıt ve ilgili kasa hareketi silindi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/muhasebe/import-siparisler — Siparişleri gelir olarak aktar
router.post('/import-siparisler', adminAuth, async (req, res) => {
  try {
    const { yil, donem } = req.body; // ör: 2025, 'Q1'
    if (!yil || !donem) return res.status(400).json({ success: false, message: 'yil ve donem zorunlu' });

    const qMap = { Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12] };
    const [baslangicAy, bitisAy] = qMap[donem] || [1, 3];
    const baslangic = new Date(yil, baslangicAy - 1, 1);
    const bitis = new Date(yil, bitisAy, 0, 23, 59, 59);

    const siparisler = await Order.find({
      createdAt: { $gte: baslangic, $lte: bitis },
      status: { $nin: ['iptal', 'İptal Edildi', 'cancelled'] }
    }).lean();

    let eklenen = 0, atlanan = 0;
    for (const siparis of siparisler) {
      const varMi = await DefterKaydi.findOne({ siparisId: siparis._id });
      if (varMi) { atlanan++; continue; }

      const toplam = siparis.toplam || 0;
      const kdvOrani = 20;
      const haric = parseFloat((toplam / 1.2).toFixed(2));
      const kdv = parseFloat((toplam - haric).toFixed(2));
      const tarih = siparis.createdAt || new Date();
      const ay = new Date(tarih).getMonth() + 1;

      await DefterKaydi.create({
        tip: 'gelir',
        tarih,
        aciklama: `Sipariş #${siparis._id.toString().slice(-6).toUpperCase()}`,
        karsiTaraf: siparis.firmaAdi || siparis.email || '',
        kategori: 'Satış Geliri',
        kdvHaricTutar: haric,
        kdvOrani,
        kdvTutari: kdv,
        kdvDahilTutar: toplam,
        yil: parseInt(yil),
        ay,
        donem: `${yil}-${donem}`,
        kaynak: 'siparis',
        siparisId: siparis._id
      });
      eklenen++;
    }

    res.json({ success: true, eklenen, atlanan, toplam: siparisler.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  KDV HESAPLAMA
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/muhasebe/kdv-hesap?yil=2025&donem=Q1
router.get('/kdv-hesap', adminAuth, async (req, res) => {
  try {
    const { yil, donem } = req.query;
    if (!yil || !donem) return res.status(400).json({ success: false, message: 'yil ve donem zorunlu' });
    const docDonem = `${yil}-${donem}`;

    const oranlar = [20, 10, 1, 0];
    const matrahlar = {};
    const kdvler = {};

    for (const oran of oranlar) {
      const gelirAgg = await DefterKaydi.aggregate([
        { $match: { donem: docDonem, tip: 'gelir', kdvOrani: oran } },
        { $group: { _id: null, matrahi: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' } } }
      ]);
      matrahlar[`gelir_${oran}`] = gelirAgg[0]?.matrahi || 0;
      kdvler[`hesaplanan_${oran}`] = gelirAgg[0]?.kdv || 0;

      const giderAgg = await DefterKaydi.aggregate([
        { $match: { donem: docDonem, tip: 'gider', kdvOrani: oran } },
        { $group: { _id: null, matrahi: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' } } }
      ]);
      matrahlar[`gider_${oran}`] = giderAgg[0]?.matrahi || 0;
      kdvler[`indirilecek_${oran}`] = giderAgg[0]?.kdv || 0;
    }

    const hesaplananKdv = oranlar.reduce((s, o) => s + (kdvler[`hesaplanan_${o}`] || 0), 0);
    const indirilecekKdv = oranlar.reduce((s, o) => s + (kdvler[`indirilecek_${o}`] || 0), 0);

    // Önceki dönemin devredenini bul
    const oncekiBeyan = await BeyanDurum.findOne({
      tur: 'kdv', yil: parseInt(yil), donem: oncekiDonem(donem, parseInt(yil)).donem
    });
    const devredenOnceki = oncekiBeyan?.devredenKdv || 0;

    const fark = hesaplananKdv - indirilecekKdv - devredenOnceki;
    const odenmesiGereken = fark > 0 ? parseFloat(fark.toFixed(2)) : 0;
    const devredenSonraki = fark < 0 ? parseFloat(Math.abs(fark).toFixed(2)) : 0;

    res.json({
      success: true,
      donem: docDonem,
      matrahlar,
      kdvler,
      hesaplananKdv: parseFloat(hesaplananKdv.toFixed(2)),
      indirilecekKdv: parseFloat(indirilecekKdv.toFixed(2)),
      devredenOnceki,
      odenmesiGereken,
      devredenSonraki
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function oncekiDonem(donem, yil) {
  const map = { Q1: { donem: 'Q4', yil: yil - 1 }, Q2: { donem: 'Q1', yil }, Q3: { donem: 'Q2', yil }, Q4: { donem: 'Q3', yil } };
  return map[donem] || { donem: 'Q4', yil: yil - 1 };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GEÇİCİ VERGİ HESAPLAMA
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/muhasebe/gecici-vergi?yil=2025&donem=G1
router.get('/gecici-vergi', adminAuth, async (req, res) => {
  try {
    const { yil } = req.query;
    const donem = req.query.donem || 'G1';
    if (!yil) return res.status(400).json({ success: false, message: 'yil zorunlu' });

    // G1 = Oc-Mar, G2 = Oc-Haz, G3 = Oc-Eyl (kümülatif)
    const bitisAy = { G1: 3, G2: 6, G3: 9 };
    const bAy = bitisAy[donem] || 3;

    const gelirAgg = await DefterKaydi.aggregate([
      { $match: { yil: parseInt(yil), tip: 'gelir', ay: { $lte: bAy } } },
      { $group: { _id: null, toplam: { $sum: '$kdvHaricTutar' } } }
    ]);
    const giderAgg = await DefterKaydi.aggregate([
      { $match: { yil: parseInt(yil), tip: 'gider', ay: { $lte: bAy }, kategori: { $ne: 'Vergi/SGK' } } },
      { $group: { _id: null, toplam: { $sum: '$kdvHaricTutar' } } }
    ]);

    const donemGelir = gelirAgg[0]?.toplam || 0;
    const donemGider = giderAgg[0]?.toplam || 0;
    const kazanc = donemGelir - donemGider;
    const vergiMatrahi = kazanc > 0 ? kazanc : 0;

    // Gelir vergisi dilimi hesaplama (2025 tahmini dilimler)
    let vergiTutari = 0;
    if (vergiMatrahi <= 110000) {
      vergiTutari = vergiMatrahi * 0.15;
    } else if (vergiMatrahi <= 230000) {
      vergiTutari = 110000 * 0.15 + (vergiMatrahi - 110000) * 0.20;
    } else if (vergiMatrahi <= 580000) {
      vergiTutari = 110000 * 0.15 + 120000 * 0.20 + (vergiMatrahi - 230000) * 0.27;
    } else if (vergiMatrahi <= 3000000) {
      vergiTutari = 110000 * 0.15 + 120000 * 0.20 + 350000 * 0.27 + (vergiMatrahi - 580000) * 0.35;
    } else {
      vergiTutari = 110000 * 0.15 + 120000 * 0.20 + 350000 * 0.27 + 2420000 * 0.35 + (vergiMatrahi - 3000000) * 0.40;
    }

    // Önceki dönemlerin ödenmiş geçici vergilerini çıkar
    const oncekiBeyanlar = await BeyanDurum.find({
      tur: 'geciciVergi', yil: parseInt(yil),
      donem: { $in: donem === 'G3' ? ['G1', 'G2'] : donem === 'G2' ? ['G1'] : [] },
      durum: 'verildi'
    });
    const mahsup = oncekiBeyanlar.reduce((s, b) => s + (b.vergiTutari || 0), 0);
    const odenmesiGereken = Math.max(0, parseFloat((vergiTutari - mahsup).toFixed(2)));

    res.json({
      success: true, donem,
      donemGelir: parseFloat(donemGelir.toFixed(2)),
      donemGider: parseFloat(donemGider.toFixed(2)),
      kazanc: parseFloat(kazanc.toFixed(2)),
      vergiMatrahi: parseFloat(vergiMatrahi.toFixed(2)),
      vergiTutari: parseFloat(vergiTutari.toFixed(2)),
      mahsup: parseFloat(mahsup.toFixed(2)),
      odenmesiGereken
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  YILLIK ÖZET
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/muhasebe/ozet?yil=2025
router.get('/ozet', adminAuth, async (req, res) => {
  try {
    const yil = parseInt(req.query.yil) || new Date().getFullYear();

    const [gelirAgg, giderAgg] = await Promise.all([
      DefterKaydi.aggregate([
        { $match: { yil, tip: 'gelir' } },
        { $group: { _id: '$ay', kdvHaric: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' }, dahil: { $sum: '$kdvDahilTutar' } } },
        { $sort: { _id: 1 } }
      ]),
      DefterKaydi.aggregate([
        { $match: { yil, tip: 'gider' } },
        { $group: { _id: '$ay', kdvHaric: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' }, dahil: { $sum: '$kdvDahilTutar' } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    const toplamGelir = gelirAgg.reduce((s, r) => s + r.kdvHaric, 0);
    const toplamGider = giderAgg.reduce((s, r) => s + r.kdvHaric, 0);
    const netKar = toplamGelir - toplamGider;

    const beyanlar = await BeyanDurum.find({ yil }).lean();

    res.json({
      success: true, yil,
      gelirAylık: gelirAgg,
      giderAylık: giderAgg,
      toplamGelir: parseFloat(toplamGelir.toFixed(2)),
      toplamGider: parseFloat(toplamGider.toFixed(2)),
      netKar: parseFloat(netKar.toFixed(2)),
      beyanlar
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BEYAN DURUM ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/muhasebe/beyanlar?yil=2025
router.get('/beyanlar', adminAuth, async (req, res) => {
  try {
    const yil = parseInt(req.query.yil) || new Date().getFullYear();
    let beyanlar = await BeyanDurum.find({ yil }).lean();

    // Gecikme durumunu anlık hesapla
    beyanlar = beyanlar.map(b => ({
      ...b,
      durum: durumHesapla(b)
    }));

    res.json({ success: true, beyanlar });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/muhasebe/beyanlar — Beyan oluştur/güncelle
router.post('/beyanlar', adminAuth, async (req, res) => {
  try {
    const { tur, yil, donem, ...data } = req.body;
    if (!tur || !yil || !donem) return res.status(400).json({ success: false, message: 'tur, yil, donem zorunlu' });

    const sonGun = sonGunHesapla(tur, parseInt(yil), donem);
    const beyan = await BeyanDurum.findOneAndUpdate(
      { tur, yil: parseInt(yil), donem },
      { ...data, sonGun, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, beyan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/muhasebe/beyanlar/:id
router.put('/beyanlar/:id', adminAuth, async (req, res) => {
  try {
    const { durum, verilmeTarihi, akNo, notlar, kasaId, ...rest } = req.body;
    
    let beyan = await BeyanDurum.findById(req.params.id);
    if (!beyan) return res.status(404).json({ success: false, message: 'Beyan bulunamadı' });

    const update = { ...rest, updatedAt: new Date() };
    if (durum) update.durum = durum;
    if (verilmeTarihi) update.verilmeTarihi = new Date(verilmeTarihi);
    if (akNo !== undefined) update.akNo = akNo;
    if (notlar !== undefined) update.notlar = notlar;
    if (kasaId !== undefined) update.kasaId = kasaId || null;

    // ── Kasa Entegrasyonu ──
    const oldDurum = beyan.durum;
    const isNowPaid = (durum === 'verildi' && oldDurum !== 'verildi');
    const isNowReverted = (oldDurum === 'verildi' && durum && durum !== 'verildi');

    // 1. Ödeme İptali (Verildi'den başka bir duruma geçiş)
    if (isNowReverted && beyan.kasaIslemId) {
      const islem = await KasaIslem.findById(beyan.kasaIslemId);
      if (islem) {
        const kasa = await KasaBanka.findById(islem.kasaId);
        if (kasa) await kasa.bakiyeGuncelle(islem.tutar, 'GİRİŞ');
        await KasaIslem.findByIdAndDelete(islem._id);
      }
      update.kasaIslemId = null;
    }

    // 2. Yeni Ödeme (Kasa seçildiyse)
    if (isNowPaid && (kasaId || beyan.kasaId)) {
      const targetKasaId = kasaId || beyan.kasaId;
      const kasa = await KasaBanka.findById(targetKasaId);
      if (kasa) {
        // Tutar hesapla
        let tutar = 0;
        if (beyan.tur === 'kdv') tutar = beyan.odenmesiGerekenKdv;
        else if (['geciciVergi', 'gelirVergisi'].includes(beyan.tur)) tutar = beyan.odenmesiGerekenVergi;
        else if (beyan.tur === 'muhtasar') tutar = beyan.stopajTutari;
        else if (beyan.tur === 'bagkur') tutar = beyan.bagkurPrimi;

        if (tutar > 0) {
          const yeniIslem = await KasaIslem.create({
            kasaId: kasa._id,
            islemTipi: 'ÇIKIŞ',
            tutar: tutar,
            aciklama: `${beyan.tur.toUpperCase()} Beyan Ödemesi (${beyan.donem}/${beyan.yil})`,
            ilgiliModul: 'GIDER',
            referansId: beyan._id,
            olusturanKullanici: req.user.userId
          });
          update.kasaIslemId = yeniIslem._id;
          await kasa.bakiyeGuncelle(tutar, 'ÇIKIŞ');
        }
      }
    }

    beyan = await BeyanDurum.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, beyan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/muhasebe/init-yil — Yıl için tüm beyan kayıtlarını oluştur
router.post('/init-yil', adminAuth, async (req, res) => {
  try {
    const yil = parseInt(req.body.yil) || new Date().getFullYear();
    const olusan = [];

    // KDV — 4 dönem
    for (const donem of ['Q1', 'Q2', 'Q3', 'Q4']) {
      const var_ = await BeyanDurum.findOne({ tur: 'kdv', yil, donem });
      if (!var_) {
        const b = await BeyanDurum.create({ tur: 'kdv', yil, donem, sonGun: sonGunHesapla('kdv', yil, donem) });
        olusan.push(b);
      }
    }
    // Geçici Vergi — 3 dönem
    for (const donem of ['G1', 'G2', 'G3']) {
      const var_ = await BeyanDurum.findOne({ tur: 'geciciVergi', yil, donem });
      if (!var_) {
        const b = await BeyanDurum.create({ tur: 'geciciVergi', yil, donem, sonGun: sonGunHesapla('geciciVergi', yil, donem) });
        olusan.push(b);
      }
    }
    // Muhtasar — 12 ay
    for (let ay = 1; ay <= 12; ay++) {
      const donem = String(ay).padStart(2, '0');
      const var_ = await BeyanDurum.findOne({ tur: 'muhtasar', yil, donem });
      if (!var_) {
        const b = await BeyanDurum.create({ tur: 'muhtasar', yil, donem, sonGun: sonGunHesapla('muhtasar', yil, donem) });
        olusan.push(b);
      }
    }
    // Bağ-Kur — 12 ay
    for (let ay = 1; ay <= 12; ay++) {
      const donem = String(ay).padStart(2, '0');
      const var_ = await BeyanDurum.findOne({ tur: 'bagkur', yil, donem });
      if (!var_) {
        const b = await BeyanDurum.create({ tur: 'bagkur', yil, donem, sonGun: sonGunHesapla('bagkur', yil, donem), bagkurPrimi: 7000 });
        olusan.push(b);
      }
    }
    // Yıllık Gelir Vergisi
    const varGV = await BeyanDurum.findOne({ tur: 'gelirVergisi', yil, donem: 'YILLIK' });
    if (!varGV) {
      const b = await BeyanDurum.create({ tur: 'gelirVergisi', yil, donem: 'YILLIK', sonGun: sonGunHesapla('gelirVergisi', yil, 'YILLIK') });
      olusan.push(b);
    }

    res.json({ success: true, olusan: olusan.length, mesaj: `${yil} yılı beyan yapısı oluşturuldu` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/muhasebe/takvim?yil=2025 — Beyan takvimi + durumlar
router.get('/takvim', adminAuth, async (req, res) => {
  try {
    const yil = parseInt(req.query.yil) || new Date().getFullYear();
    const beyanlar = await BeyanDurum.find({ yil }).lean();

    const takvim = beyanlar.map(b => ({
      ...b,
      durum: durumHesapla(b),
      yaklasiyor: b.sonGun && !['verildi','muaf'].includes(b.durum) &&
        new Date(b.sonGun) - new Date() < 7 * 24 * 3600 * 1000 &&
        new Date(b.sonGun) > new Date()
    })).sort((a, b) => new Date(a.sonGun) - new Date(b.sonGun));

    res.json({ success: true, takvim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
