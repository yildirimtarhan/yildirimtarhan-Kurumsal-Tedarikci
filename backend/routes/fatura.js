const express = require('express');
const router = express.Router();
const Fatura = require('../models/Fatura');
const CariHesap = require('../models/CariHesap');
const Order = require('../models/Order');
const User = require('../models/User');
const TaxtenService = require('../services/taxtenService');
const DefterKaydi = require('../models/DefterKaydi');
const KasaBanka = require('../models/KasaBanka');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const taxtenService = new TaxtenService();

// Siparişten fatura oluştur
router.post('/from-siparis', authMiddleware, async (req, res) => {
  try {
    const { siparisId, tip = 'efatura', odemeVadesi = 14 } = req.body;

    if (!siparisId) {
      return res.status(400).json({ success: false, message: 'Sipariş ID gerekli' });
    }

    const order = await Order.findById(siparisId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sipariş bulunamadı' });
    }

    const user = await User.findById(order.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }

    // Cari hesap bul veya oluştur
    let cari = await CariHesap.findOne({ kullaniciId: user._id });
    if (!cari) {
      const vkn = user.vergiNo || user.tcNo || '00000000000';
      const unvan = user.firma || user.ad || 'Bilinmeyen Müşteri';
      cari = await CariHesap.create({
        kullaniciId: user._id,
        firmaUnvan: unvan,
        vknTckn: vkn,
        email: user.email,
        telefon: user.telefon || ''
      });
    }

    // Fatura kalemleri
    const toplam = order.toplam || order.total || 0;
    const matrah = toplam / 1.2;
    const kdvTutari = toplam - matrah;

    const kalemler = (order.items || []).map((item, index) => {
      const ad = item.ad || item.name || 'Ürün';
      const fiyat = parseFloat(item.fiyat || item.price || 0);
      const adet = parseInt(item.adet || item.quantity || 1);
      const tutar = fiyat * adet;
      const kdv = tutar * 0.2;
      return {
        siraNo: index + 1,
        malHizmet: ad,
        miktar: adet,
        birim: 'ADET',
        birimFiyat: fiyat,
        tutar: tutar,
        kdvOrani: 20,
        kdvTutari: kdv,
        toplamTutar: tutar + kdv
      };
    });

    if (kalemler.length === 0) {
      kalemler.push({
        siraNo: 1,
        malHizmet: 'Sipariş Tutarı',
        miktar: 1,
        birim: 'ADET',
        birimFiyat: matrah,
        tutar: matrah,
        kdvOrani: 20,
        kdvTutari: kdvTutari,
        toplamTutar: toplam
      });
    }

    const vadeTarihi = new Date();
    vadeTarihi.setDate(vadeTarihi.getDate() + parseInt(odemeVadesi));

    const fatura = await Fatura.create({
      cariHesapId: cari._id,
      aliciVkn: cari.vknTckn,
      aliciEtiket: cari.etiket,
      aliciUnvan: cari.firmaUnvan,
      aliciAdres: user.faturaAdresi?.acikAdres || '',
      aliciTelefon: cari.telefon,
      aliciEmail: cari.email,
      kalemler,
      matrah,
      kdvOrani: 20,
      kdvTutari,
      toplamTutar: toplam,
      siparisId: order._id,
      odemeSekli: order.paymentMethod || 'ACIK',
      vadeTarihi,
      durum: 'TASLAK',
      custInvId: `SIP-${order._id}`,
      tip
    });

    res.status(201).json({
      success: true,
      message: 'Fatura oluşturuldu',
      data: { ...fatura.toObject(), faturaNo: fatura.faturaNo || fatura._id }
    });
  } catch (error) {
    console.error('from-siparis hata:', error.message);
    res.status(500).json({ success: false, message: 'Fatura oluşturulamadı: ' + error.message });
  }
});


router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, durum, cariId, startDate, endDate, search } = req.query;
    
    const query = {};
    if (durum) query.durum = durum;
    if (req.query.tipo) query.faturaTipi = req.query.tipo; // Alış/Satış filtresi
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
    // Taxten test hesabı kontrolü
    const hasAuth = (process.env.TAXTEN_USERNAME || process.env.TAXTEN_TEST_CLIENT_ID) && 
      (process.env.TAXTEN_PASSWORD || process.env.TAXTEN_TEST_API_KEY);
    if (!hasAuth) {
      return res.status(400).json({ 
        success: false, 
        message: 'Taxten hesabı tanımlı değil. .env dosyasına TAXTEN_TEST_CLIENT_ID ve TAXTEN_TEST_API_KEY ekleyin.' 
      });
    }

    const fatura = await Fatura.findById(req.params.id).populate('cariHesapId');
    
    if (!fatura) return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
    if (fatura.durum !== 'TASLAK' && fatura.durum !== 'HATA') {
      return res.status(400).json({ success: false, message: 'Bu fatura zaten gönderilmiş' });
    }
    
    const gondericiBilgileri = {
      vkn: process.env.FIRMA_VKN || process.env.TAXTEN_TEST_CLIENT_ID || process.env.TAXTEN_VKN,
      unvan: process.env.FIRMA_UNVAN || 'Test Firma',
      adres: {
        il: process.env.FIRMA_IL || 'İstanbul',
        ilce: process.env.FIRMA_ILCE || 'Kadıköy',
        cadde: process.env.FIRMA_ADRES || 'Test Cad.',
        binaNo: process.env.FIRMA_BINA_NO || '1',
        postaKodu: process.env.FIRMA_POSTA_KODU || '34000'
      },
      telefon: process.env.FIRMA_TELEFON || '',
      email: process.env.FIRMA_EMAIL || 'test@test.com',
      website: process.env.FIRMA_WEBSITE || '',
      vergiDairesi: process.env.FIRMA_VERGI_DAIRESI || 'Kadıköy'
    };
    
    const cariAdres = fatura.cariHesapId?.adres;
    const aliciAdresObj = typeof fatura.aliciAdres === 'object' && fatura.aliciAdres
      ? fatura.aliciAdres
      : (cariAdres && typeof cariAdres === 'object')
        ? { cadde: cariAdres.cadde || '', il: cariAdres.il || '', ilce: cariAdres.ilce || '', postaKodu: cariAdres.postaKodu || '', binaNo: cariAdres.binaNo || '' }
        : { cadde: (fatura.aliciAdres || '').toString(), il: '', ilce: '', postaKodu: '', binaNo: '' };

    const faturaData = {
      faturaNo: fatura.faturaNo,
      custInvId: fatura.custInvId,
      aliciVkn: fatura.aliciVkn,
      aliciEtiket: fatura.aliciEtiket || (fatura.aliciVkn?.length === 11 ? '' : fatura.aliciVkn),
      aliciUnvan: fatura.aliciUnvan,
      aliciAdres: aliciAdresObj,
      aliciVergiDairesi: fatura.cariHesapId?.adres?.ilce || '',
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
      fatura.taxtenHata = typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error);
      await fatura.save();
      
      const errMsg = result.errorMessage || (typeof result.error === 'object' ? (result.error?.Message || result.error?.message || JSON.stringify(result.error)) : result.error);
      res.status(400).json({ success: false, message: 'Fatura gönderilemedi: ' + (errMsg || 'Bilinmeyen hata'), error: result.error });
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

// Taxten'den Gelen ve Giden Faturaları Eşitle
router.post('/sync-taxten', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('[Sync DEBUG] Rota isteği alındı (Body):', req.body);
    const { startDate, endDate, syncInbound = true, syncOutbound = true } = req.body;
    const sonuclar = { inbound: 0, outbound: 0, errors: [] };

    const processInvoices = async (type) => {
      const result = await taxtenService.getInvoiceList(type, startDate, endDate);
      console.log(`[Sync DEBUG] ${type} için bulunan toplam ham fatura sayısı:`, result.data?.length || 0);

      if (!result.success) {
        sonuclar.errors.push(`${type} listesi alınamadı: ${result.error}`);
        return;
      }

      let invoices = result.data?.Items || result.data || [];
      if (!Array.isArray(invoices)) {
          // Eğer tek bir obje gelmişse veya beklenen formatta değilse boş dizi ata
          invoices = [];
      }
      
      for (const inv of invoices) {
        try {
          const uuid = inv.uuid || inv.UUID;
          if (!uuid) continue;

          const existing = await Fatura.findOne({ uuid });
          if (existing) continue;

          console.log(`[Sync DEBUG] Fatura detayı çekiliyor: ${uuid}`);

          // Detaylı UBL verisini çek
          const detailRes = await taxtenService.getUBL(uuid, type);
          if (!detailRes.success) {
            console.error(`[Sync ERROR] ${uuid} detayı alınamadı:`, detailRes.error);
            sonuclar.errors.push(`${inv.id || uuid} detayı alınamadı.`);
            continue;
          }

          // XML'den verileri ayıkla (Taxten service parseUBL artık type alıyor)
          const data = taxtenService.parseUBL(detailRes.data, type);
          if (!data) {
            sonuclar.errors.push(`${uuid} ayrıştırılamadı.`);
            continue;
          }

          const otherVkn = data.vkn;
          const otherUnvan = data.unvan;

          console.log(`[Sync DEBUG] İşlenen Cari: ${otherUnvan} (${otherVkn})`);

          // Cari Hesabı bul veya oluştur
          let cari = await CariHesap.findOne({ vknTckn: otherVkn });
          if (!cari) {
            cari = await CariHesap.create({
              firmaUnvan: otherUnvan || 'Yeni Firma (Taxten)',
              vknTckn: otherVkn,
              bakiye: 0
            });
            console.log(`[Sync DEBUG] Yeni Cari Oluşturuldu: ${otherUnvan}`);
          }

          // Fatura Kaydı
          const faturaData = {
            uuid: uuid,
            faturaNo: data.faturaNo || inv.id || inv.ID,
            cariHesapId: cari._id,
            aliciVkn: type === 'OUTBOUND' ? otherVkn : '34285822330', 
            aliciUnvan: type === 'OUTBOUND' ? otherUnvan : 'Yıldırım Tarhan',
            faturaTarihi: data.tarih ? new Date(data.tarih) : new Date(),
            toplamTutar: data.tutar || 0,
            matrah: (data.tutar || 0) - (data.kdv || 0),
            kdvTutari: data.kdv || 0,
            durum: '1300-BAŞARILI',
            faturaTipi: type === 'OUTBOUND' ? 'SATIŞ' : 'ALIŞ',
            aciklama: `Taxten Senkronizasyon (${type})`
          };

          // FaturaNo çakışmasını önle
          const conflict = await Fatura.findOne({ faturaNo: faturaData.faturaNo });
          if (conflict && conflict.uuid !== uuid) {
             // Gerçek bir numara çakışması varsa UUID ekle
             faturaData.faturaNo = `${faturaData.faturaNo}_${uuid.substring(0,4)}`;
          }

          const yeniFatura = await Fatura.create(faturaData);

          // Muhasebe Defter Kaydı (İşletme Defteri)
          try {
            const fDate = yeniFatura.faturaTarihi;
            const fYil = fDate.getFullYear();
            const fAy = fDate.getMonth() + 1;
            const fDonem = `${fYil}-${DefterKaydi.ayToDonem ? DefterKaydi.ayToDonem(fAy) : '01'}`;

            await DefterKaydi.create({
              tip: yeniFatura.faturaTipi === 'SATIŞ' ? 'gelir' : 'gider',
              tarih: fDate,
              aciklama: `${otherUnvan} - Fatura #${yeniFatura.faturaNo}`,
              karsiTaraf: otherUnvan,
              faturaNo: yeniFatura.faturaNo,
              kdvHaricTutar: yeniFatura.matrah,
              kdvTutari: yeniFatura.kdvTutari,
              kdvDahilTutar: yeniFatura.toplamTutar,
              yil: fYil,
              ay: fAy,
              donem: fDonem,
              kaynak: 'manuel',
              notlar: `Taxten UUID: ${uuid}`,
              cariHesapId: cari._id
            });
            
            // Cari bakiye güncelleme
            if (type === 'OUTBOUND') cari.bakiye += yeniFatura.toplamTutar;
            else cari.bakiye -= yeniFatura.toplamTutar;
            await cari.save();

            if (type === 'INBOUND') sonuclar.inbound++;
            else sonuclar.outbound++;

          } catch (defterErr) {
            console.error('[Sync ERROR] Defter kaydı hatası:', defterErr.message);
            sonuclar.errors.push(`${yeniFatura.faturaNo} muhasebeleşemedi.`);
          }

        } catch (innerErr) {
          console.error(`[Sync ERROR] Fatura Yazma Hatası (${inv.id}):`, innerErr.message);
          if (innerErr.errors) {
            console.error('Validation Details:', JSON.stringify(innerErr.errors));
          }
          sonuclar.errors.push(`Fatura ${inv.id || 'N/A'} hatası: ${innerErr.message}`);
        }
      }
    };

    if (syncOutbound) await processInvoices('OUTBOUND');
    if (syncInbound) await processInvoices('INBOUND');

    res.json({ success: true, sonuclar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;