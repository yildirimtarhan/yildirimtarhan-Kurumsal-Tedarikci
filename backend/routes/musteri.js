const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken: auth } = require('../middleware/auth');
const Fatura = require('../models/Fatura');
const CariHesap = require('../models/CariHesap');
const Tahsilat = require('../models/Tahsilat');
const { sendEmail } = require('../utils/email');

// Yardımcı fonksiyon: Kullanıcının Cari Hesabını getir
async function getUserCari(userId) {
    return await CariHesap.findOne({ kullaniciId: userId });
}

// Müşterinin kendi faturalarını getir
router.get('/faturalar', auth, async (req, res) => {
    try {
        const cari = await getUserCari(req.userId);
        if (!cari) {
            return res.json({
                success: true,
                data: [],
                toplamSayfa: 0,
                mevcutSayfa: 1,
                istatistikler: { toplam: 0, odenen: 0, bekleyen: 0, vadeGecmis: 0 }
            });
        }

        const filters = { cariHesapId: cari._id };
        
        if (req.query.durum) filters.odemeDurumu = req.query.durum;
        if (req.query.baslangicTarihi && req.query.bitisTarihi) {
            filters.faturaTarihi = {
                $gte: new Date(req.query.baslangicTarihi),
                $lte: new Date(req.query.bitisTarihi)
            };
        }

        const page = parseInt(req.query.sayfa) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const faturalar = await Fatura.find(filters)
            .sort({ faturaTarihi: -1 })
            .skip(skip)
            .limit(limit)
            .populate('siparisId', 'siparisNo');

        const toplam = await Fatura.countDocuments(filters);

        // İstatistikler (Aggregation)
        const istatistikler = await Fatura.aggregate([
            { $match: { cariHesapId: cari._id } },
            {
                $group: {
                    _id: null,
                    toplam: { $sum: 1 },
                    odenen: { 
                        $sum: { 
                            $cond: [{ $eq: ['$odemeDurumu', 'odendi'] }, 1, 0] 
                        } 
                    },
                    bekleyen: { 
                        $sum: { 
                            $cond: [{ $eq: ['$odemeDurumu', 'bekliyor'] }, 1, 0] 
                        } 
                    },
                    vadeGecmis: {
                        $sum: {
                            $cond: [
                                { 
                                    $and: [
                                        { $eq: ['$odemeDurumu', 'bekliyor'] },
                                        { $lt: ['$vadeTarihi', new Date()] }
                                    ]
                                }, 1, 0
                            ]
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: faturalar,
            toplamSayfa: Math.ceil(toplam / limit),
            mevcutSayfa: page,
            istatistikler: istatistikler[0] || { toplam: 0, odenen: 0, bekleyen: 0, vadeGecmis: 0 }
        });
    } catch (error) {
        console.error('Faturalar Hatası:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Fatura detayı
router.get('/faturalar/:id', auth, async (req, res) => {
    try {
        const cari = await getUserCari(req.userId);
        if (!cari) return res.status(404).json({ success: false, message: 'Cari hesap bulunamadı' });

        const fatura = await Fatura.findOne({
            _id: req.params.id,
            cariHesapId: cari._id
        }).populate('siparisId');

        if (!fatura) {
            return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
        }

        // Tahsilat geçmişini getir
        const tahsilatlar = await Tahsilat.find({ faturaId: fatura._id }).sort({ tahsilatTarihi: -1 });

        res.json({
            success: true,
            data: {
                ...fatura.toObject(),
                tahsilatlar
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PDF indir
router.get('/faturalar/:id/pdf', auth, async (req, res) => {
    try {
        const cari = await getUserCari(req.userId);
        if (!cari) return res.status(404).json({ success: false, message: 'Cari hesap bulunamadı' });

        const fatura = await Fatura.findOne({
            _id: req.params.id,
            cariHesapId: cari._id
        });

        if (!fatura) {
            return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
        }

        // PDF oluşturma mantığına yönlendir veya hazırla
        res.json({ success: true, message: 'PDF oluşturma hazırlanıyor' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Vadesi yaklaşan faturalar
router.get('/faturalar/vade-yaklasan', auth, async (req, res) => {
    try {
        const cari = await getUserCari(req.userId);
        if (!cari) return res.json({ success: true, data: [] });

        const today = new Date();
        const yediGunSonra = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));

        const faturalar = await Fatura.find({
            cariHesapId: cari._id,
            odemeDurumu: 'bekliyor',
            $or: [
                { vadeTarihi: { $lte: yediGunSonra } },
                { vadeTarihi: { $lt: today } }
            ]
        }).sort({ vadeTarihi: 1 });

        res.json({
            success: true,
            data: faturalar
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Ödeme hatırlatma gönder
router.post('/faturalar/:id/hatirlatma', auth, async (req, res) => {
    try {
        const cari = await getUserCari(req.userId);
        if (!cari) return res.status(404).json({ success: false, message: 'Cari hesap bulunamadı' });

        const fatura = await Fatura.findOne({
            _id: req.params.id,
            cariHesapId: cari._id
        });

        if (!fatura) {
            return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
        }

        await sendEmail({
            to: req.user.email,
            subject: `Ödeme Hatırlatması - Fatura ${fatura.faturaNo || fatura._id}`,
            html: `
                <h2>Sayın ${req.user.ad || 'Müşterimiz'},</h2>
                <p>Aşağıdaki faturanızın ödemesi için hatırlatma yapılmıştır:</p>
                <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Fatura No:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${fatura.faturaNo || fatura._id}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Vade Tarihi:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(fatura.vadeTarihi).toLocaleDateString('tr-TR')}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Tutar:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${fatura.toplamTutar.toLocaleString('tr-TR')} ₺</td></tr>
                </table>
            `
        });

        res.json({ success: true, message: 'Hatırlatma e-postası gönderildi' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;