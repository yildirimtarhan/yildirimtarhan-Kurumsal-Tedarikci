const cron = require('node-cron');
const Fatura = require('../models/Fatura');
const { sendEmail } = require('../utils/email');

// Her gün saat 09:00'da çalıştır
const hatirlatmaGorevi = cron.schedule('0 9 * * *', async () => {
    console.log('Otomatik hatırlatma kontrolü başlatıldı:', new Date());
    
    try {
        const bugun = new Date();
        const yarin = new Date(bugun.getTime() + (24 * 60 * 60 * 1000));
        const ucGunSonra = new Date(bugun.getTime() + (3 * 24 * 60 * 60 * 1000));

        // 1. Vadesi yarın dolacak faturalar
        const yarinVadeFaturalar = await Fatura.find({
            odemeDurumu: 'bekliyor',
            vadeTarihi: {
                $gte: yarin,
                $lt: new Date(yarin.getTime() + (24 * 60 * 60 * 1000))
            }
        }).populate('musteri');

        // 2. Vadesi 3 gün içinde dolacak faturalar
        const ucGunVadeFaturalar = await Fatura.find({
            odemeDurumu: 'bekliyor',
            vadeTarihi: {
                $gte: ucGunSonra,
                $lt: new Date(ucGunSonra.getTime() + (24 * 60 * 60 * 1000))
            }
        }).populate('musteri');

        // 3. Vadesi geçmiş faturalar (her gün hatırlat)
        const gecmisFaturalar = await Fatura.find({
            odemeDurumu: 'bekliyor',
            vadeTarihi: { $lt: bugun }
        }).populate('musteri');

        // E-posta gönderimleri
        for (const fatura of yarinVadeFaturalar) {
            await hatirlatmaGonder(fatura, 'YARIN', 'critical');
        }

        for (const fatura of ucGunVadeFaturalar) {
            await hatirlatmaGonder(fatura, '3_GUN', 'warning');
        }

        for (const fatura of gecmisFaturalar) {
            const gecikmeGun = Math.ceil((bugun - fatura.vadeTarihi) / (1000 * 60 * 60 * 24));
            if (gecikmeGun % 3 === 0) { // Her 3 günde bir hatırlat
                await hatirlatmaGonder(fatura, 'GECIKME', 'danger', gecikmeGun);
            }
        }

        console.log(`Hatırlatmalar gönderildi: ${yarinVadeFaturalar.length + ucGunVadeFaturalar.length + gecmisFaturalar.length}`);
    } catch (error) {
        console.error('Hatırlatma hatası:', error);
    }
});

async function hatirlatmaGonder(fatura, tip, oncelik, gecikmeGun = 0) {
    try {
        const musteri = fatura.musteri;
        
        let subject, message;
        
        switch(tip) {
            case 'YARIN':
                subject = `⚠️ Fatura Vadesi Yarın Doluyor - ${fatura.faturaNo}`;
                message = `Faturanızın vadesi <strong>yarın</strong> dolacaktır. Lütfen ödemenizi zamanında yapınız.`;
                break;
            case '3_GUN':
                subject = `⏰ Fatura Vadesi Yaklaşıyor - ${fatura.faturaNo}`;
                message = `Faturanızın vadesine <strong>3 gün</strong> kalmıştır.`;
                break;
            case 'GECIKME':
                subject = `🚨 Vadesi Geçmiş Fatura - ${fatura.faturaNo}`;
                message = `Faturanızın vadesi <strong>${gecikmeGun} gün</strong> geçmiştir. Lütfen en kısa sürede ödeme yapınız.`;
                break;
        }

        await sendEmail({
            to: musteri.email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: ${oncelik === 'critical' ? '#dc2626' : oncelik === 'warning' ? '#f59e0b' : '#7c3aed'}; color: white; padding: 20px; text-align: center;">
                        <h1>Ödeme Hatırlatması</h1>
                    </div>
                    <div style="padding: 20px; border: 1px solid #e5e7eb;">
                        <p>Sayın ${musteri.ad},</p>
                        <p>${message}</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background: #f9fafb;">
                                <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Fatura No</strong></td>
                                <td style="padding: 12px; border: 1px solid #e5e7eb;">${fatura.faturaNo}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Vade Tarihi</strong></td>
                                <td style="padding: 12px; border: 1px solid #e5e7eb;">${new Date(fatura.vadeTarihi).toLocaleDateString('tr-TR')}</td>
                            </tr>
                            <tr style="background: #f9fafb;">
                                <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Tutar</strong></td>
                                <td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 18px; color: #dc2626;"><strong>${fatura.genelToplam.toLocaleString('tr-TR')} ₺</strong></td>
                            </tr>
                        </table>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/musteri/faturalarim.html" 
                               style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Faturayı Görüntüle ve Öde
                            </a>
                        </div>

                        <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                            Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.
                        </p>
                    </div>
                </div>
            `
        });

        // Hatırlatma kaydı
        fatura.hatirlatmalar.push({
            tarih: new Date(),
            tip: 'otomatik_email',
            durum: 'gonderildi'
        });
        await fatura.save();

        console.log(`Hatırlatma gönderildi: ${fatura.faturaNo} - ${musteri.email}`);
    } catch (error) {
        console.error(`Hatırlatma gönderim hatası (${fatura.faturaNo}):`, error);
    }
}

module.exports = hatirlatmaGorevi;