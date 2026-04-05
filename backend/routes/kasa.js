const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
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

// ────────────────────────────────────────────────────────────────────────────
//  KASA / BANKA HESAPLARI YÖNETİMİ
// ────────────────────────────────────────────────────────────────────────────

// Tüm hesapları getir ve toplam bakiyeyi döndür
router.get('/accounts', adminAuth, async (req, res) => {
  try {
    const accounts = await KasaBanka.find().sort({ tarih: -1 }).lean();
    
    // Toplam bakiyeyi hesapla (TL bazında)
    const toplamBakiye = accounts.reduce((toplam, h) => {
      // Şimdilik hepsi TRY kabul ediliyor (İleride kur entegrasyonu yapılabilir)
      return toplam + (h.bakiye || 0);
    }, 0);

    res.json({ success: true, accounts, toplamBakiye });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Yeni Hesap Oluştur
router.post('/', adminAuth, async (req, res) => {
  try {
    const { hesapAdi, tip, paraBirimi, bankaAdi, subeAdi, hesapNo, iban, acilisBakiyesi, varsayilan } = req.body;
    
    if (!hesapAdi || !tip) {
      return res.status(400).json({ success: false, message: 'Hesap Adı ve Tip zorunludur.' });
    }

    if (varsayilan) {
      await KasaBanka.updateMany({}, { varsayilan: false });
    }

    const yeniHesap = await KasaBanka.create({
      hesapAdi, tip, paraBirimi: paraBirimi || 'TRY',
      bankaAdi, subeAdi, hesapNo, iban, bakiye: Number(acilisBakiyesi || 0),
      varsayilan: varsayilan || false
    });

    // Açılış bakiyesi varsa ilk işlemi (KasaIslem) de oluştur.
    if (yeniHesap.bakiye > 0) {
      await KasaIslem.create({
        kasaId: yeniHesap._id,
        islemTipi: 'GİRİŞ',
        tutar: yeniHesap.bakiye,
        aciklama: 'Açılış Bakiyesi',
        ilgiliModul: 'MANUEL'
      });
    }

    res.json({ success: true, mesaj: 'Hesap başarıyla oluşturuldu.', hesap: yeniHesap });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Hesabı Sil
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const islemVarMi = await KasaIslem.findOne({ kasaId: req.params.id });
    if (islemVarMi) {
      return res.status(400).json({ success: false, message: 'Bu kasada hareketler (işlemler) var. Önce hareketleri silmeli veya hesabı Pasife almalısınız.' });
    }
    await KasaBanka.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Hesap silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ────────────────────────────────────────────────────────────────────────────
//  KASA HAREKETLERİ (EKSTRE) VE İŞLEMLER
// ────────────────────────────────────────────────────────────────────────────

// Bir kasanın ekstresini (hareketlerini) getir
router.get('/:id/hareketler', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    let hareketler = [];
    if(id === 'all') { // Tüm kasa hareketleri
        hareketler = await KasaIslem.find()
        .populate('kasaId', 'hesapAdi tip')
        .populate('karsiKasaId', 'hesapAdi')
        .sort({ tarih: -1 })
        .limit(Number(limit))
        .skip(Number(skip))
        .lean();
    } else {
        hareketler = await KasaIslem.find({ kasaId: id })
        .populate('kasaId', 'hesapAdi tip')
        .populate('karsiKasaId', 'hesapAdi')
        .sort({ tarih: -1 })
        .limit(Number(limit))
        .skip(Number(skip))
        .lean();
    }

    res.json({ success: true, hareketler });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kasaya/Bankaya Manuel Para Girişi/Çıkışı Ekle
router.post('/islem', adminAuth, async (req, res) => {
  try {
    const { kasaId, islemTipi, tutar, aciklama, tarih } = req.body;
    
    if (!kasaId || !islemTipi || !tutar || !aciklama) {
      return res.status(400).json({ success: false, message: 'Tüm alanlar doldurulmalıdır.' });
    }

    const kasa = await KasaBanka.findById(kasaId);
    if (!kasa) return res.status(404).json({ success: false, message: 'Seçili kasa bulunamadı.' });

    // Çıkış işleminde yetersiz bakiye uyarısı (İsteğe bağlı, şimdilik uyarıyı es geçip eksiye düşmesine izin verelim çünkü banka eksiye düşebilir).

    const islemD = tarih ? new Date(tarih) : new Date();

    const yeniIslem = await KasaIslem.create({
      kasaId,
      islemTipi, // 'GİRİŞ' veya 'ÇIKIŞ'
      tutar: Number(tutar),
      aciklama,
      tarih: islemD,
      ilgiliModul: 'MANUEL',
      olusturanKullanici: req.user.userId
    });

    await kasa.bakiyeGuncelle(Number(tutar), islemTipi);

    res.json({ success: true, islem: yeniIslem, bakiye: kasa.bakiye });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kasa / Bankalar Arası VİRMAN (Transfer)
router.post('/transfer', adminAuth, async (req, res) => {
  try {
    const { kaynakKasaId, hedefKasaId, tutar, aciklama, tarih } = req.body;
    
    if (!kaynakKasaId || !hedefKasaId || !tutar) {
      return res.status(400).json({ success: false, message: 'Kaynak, Hedef ve Tutar zorunludur.' });
    }
    if (kaynakKasaId === hedefKasaId) {
      return res.status(400).json({ success: false, message: 'Kaynak ve Hedef kasa aynı olamaz.' });
    }

    const kaynakKasa = await KasaBanka.findById(kaynakKasaId);
    const hedefKasa = await KasaBanka.findById(hedefKasaId);

    if (!kaynakKasa || !hedefKasa) return res.status(404).json({ success: false, message: 'Kasa(lar) bulunamadı.' });

    const islemD = tarih ? new Date(tarih) : new Date();

    // 1. Kaynak kasadan PARA ÇIKIŞI
    const islemCikis = await KasaIslem.create({
      kasaId: kaynakKasaId,
      karsiKasaId: hedefKasaId,
      islemTipi: 'ÇIKIŞ', // Transfer çıkışı
      tutar: Number(tutar),
      aciklama: aciklama || `${hedefKasa.hesapAdi} hesabına transfer (Virman)`,
      tarih: islemD,
      ilgiliModul: 'TRANSFER',
      olusturanKullanici: req.user.userId
    });

    // 2. Hedef kasaya PARA GİRİŞİ
    const islemGiris = await KasaIslem.create({
      kasaId: hedefKasaId,
      karsiKasaId: kaynakKasaId,
      islemTipi: 'GİRİŞ', // Transfer girişi
      tutar: Number(tutar),
      aciklama: aciklama || `${kaynakKasa.hesapAdi} hesabından transfer (Virman)`,
      tarih: islemD,
      ilgiliModul: 'TRANSFER',
      referansId: islemCikis._id,
      olusturanKullanici: req.user.userId
    });

    // islemCikis'in de refId'sini girise baglayalim ki cift tarafli silme yapilabilinsin
    islemCikis.referansId = islemGiris._id;
    await islemCikis.save();

    // Bakiyeleri güncelle
    await kaynakKasa.bakiyeGuncelle(Number(tutar), 'ÇIKIŞ');
    await hedefKasa.bakiyeGuncelle(Number(tutar), 'GİRİŞ');

    res.json({ success: true, message: 'Transfer başarıyla gerçekleşti.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kasa Hareketini (İşlemi) Sil ve Bakiyeyi Geri Al
router.delete('/islem/:id', adminAuth, async (req, res) => {
    try {
        const islem = await KasaIslem.findById(req.params.id);
        if(!islem) return res.status(404).json({success:false, message: 'İşlem bulunamadı'});
        
        const kasa = await KasaBanka.findById(islem.kasaId);
        if(kasa){
             // İptal edilecek, bakiye tersine alınacak
             const tersTip = islem.islemTipi === 'GİRİŞ' ? 'ÇIKIŞ' : 'GİRİŞ';
             await kasa.bakiyeGuncelle(islem.tutar, tersTip);
        }

        // Eğer bu işlem bir transferse (ikili bacak), karsiKismini da bulup silelim
        if(islem.ilgiliModul === 'TRANSFER' && islem.referansId) {
             const karsiIslem = await KasaIslem.findById(islem.referansId);
             if(karsiIslem) {
                  const karsiKasa = await KasaBanka.findById(karsiIslem.kasaId);
                  if(karsiKasa){
                       const kTersTip = karsiIslem.islemTipi === 'GİRİŞ' ? 'ÇIKIŞ' : 'GİRİŞ';
                       await karsiKasa.bakiyeGuncelle(karsiIslem.tutar, kTersTip);
                  }
                  await KasaIslem.findByIdAndDelete(karsiIslem._id);
             }
        }

        await KasaIslem.findByIdAndDelete(req.params.id);
        res.json({success:true, message: 'Nakit hareketi iptal edildi (silindi) ve bakiye geri yüklendi.'});
    }catch(err){
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
