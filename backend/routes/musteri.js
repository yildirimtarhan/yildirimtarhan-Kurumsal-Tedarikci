const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Fatura = require('../models/Fatura');
const Tahsilat = require('../models/Tahsilat');
const { sendEmail } = require('../utils/email');

// Müşterinin kendi faturalarını getir
router.get('/faturalar', auth, async (req, res) => {
    try {
        // Sadece kendi faturalarını görebilir
        const filters = { musteri: req.user.id };
        
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
            .populate('siparis', 'siparisNo');

        const toplam = await Fatura.countDocuments(filters);

        // İstatistikler
        const istatistikler = await Fatura.aggregate([
            { $match: { musteri: req.user._id } },
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
        res.status(500).json({ success: false, message: error.message });
    }
});

// Fatura detayı
router.get('/faturalar/:id', auth, async (req, res) => {
    try {
        const fatura = await Fatura.findOne({
            _id: req.params.id,
            musteri: req.user.id
        }).populate('siparis');

        if (!fatura) {
            return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
        }

        // Tahsilat geçmişini getir
        const tahsilatlar = await Tahsilat.find({ fatura: fatura._id }).sort({ tarih: -1 });

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

// PDF indir (mevcut PDF oluşturma mantığını kullan)
router.get('/faturalar/:id/pdf', auth, async (req, res) => {
    try {
        const fatura = await Fatura.findOne({
            _id: req.params.id,
            musteri: req.user.id
        });

        if (!fatura) {
            return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
        }

        // PDF oluştur ve gönder (mevcut PDF servisinizi kullanın)
        // const pdfBuffer = await createPDF(fatura);
        // res.setHeader('Content-Type', 'application/pdf');
        // res.setHeader('Content-Disposition', `attachment; filename=fatura-${fatura.faturaNo}.pdf`);
        // res.send(pdfBuffer);

        res.json({ success: true, message: 'PDF oluşturma hazırlanıyor' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Vadesi yaklaşan faturalar
router.get('/faturalar/vade-yaklasan', auth, async (req, res) => {
    try {
        const today = new Date();
        const yediGunSonra = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));

        const faturalar = await Fatura.find({
            musteri: req.user.id,
            odemeDurumu: 'bekliyor',
            $or: [
                { vadeTarihi: { $lte: yediGunSonra } }, // 7 gün içinde vadesi dolacaklar
                { vadeTarihi: { $lt: today } } // Vadesi geçmişler
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
        const fatura = await Fatura.findOne({
            _id: req.params.id,
            musteri: req.user.id
        }).populate('musteri');

        if (!fatura) {
            return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
        }

        // E-posta gönder
        await sendEmail({
            to: req.user.email,
            subject: `Ödeme Hatırlatması - Fatura ${fatura.faturaNo}`,
            html: `
                <h2>Sayın ${req.user.ad},</h2>
                <p>Aşağıdaki faturanızın ödemesi için hatırlatma yapılmıştır:</p>
                <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Fatura No:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${fatura.faturaNo}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Vade Tarihi:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(fatura.vadeTarihi).toLocaleDateString('tr-TR')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Tutar:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${fatura.genelToplam.toLocaleString('tr-TR')} ₺</td>
                    </tr>
                </table>
                <p style="margin-top: 20px;">
                    <a href="${process.env.FRONTEND_URL}/musteri/faturalarim.html" 
                       style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Faturayı Görüntüle
                    </a>
                </p>
            `
        });

        // Hatırlatma kaydı oluştur
        fatura.hatırlatmalar = fatura.hatırlatmalar || [];
        fatura.hatırlatmalar.push({
            tarih: new Date(),
            tip: 'email',
            durum: 'gonderildi'
        });
        await fatura.save();

        res.json({ success: true, message: 'Hatırlatma e-postası gönderildi' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;