// services/notificationService.js
const emailService = require('./emailService');
const smsService = require('./smsService');
const User = require('../models/User');
const Order = require('../models/Order');

class NotificationService {
    
    // Kargo bildirimi (e-posta + SMS)
    async sendShipmentNotification(siparisId) {
        try {
            // Sipariş ve kullanıcı bilgilerini al
            const order = await Order.findById(siparisId).populate('kullanici');
            
            if (!order || !order.kargoBilgisi) {
                throw new Error('Sipariş veya kargo bilgisi bulunamadı');
            }

            const user = order.kullanici;
            const kargo = order.kargoBilgisi;

            const orderData = {
                siparisNo: order.siparisNo || order._id.toString().slice(-6).toUpperCase(),
                kargoFirma: kargo.firma,
                takipNo: kargo.takipNo,
                tahminiTeslimat: kargo.tahminiTeslimat?.toLocaleDateString('tr-TR') || '2-3 iş günü'
            };

            // E-posta gönder
            const emailPromise = emailService.sendShipmentNotification(
                user.email,
                user.ad,
                orderData
            );

            // SMS gönder (telefon varsa)
            const smsPromise = user.telefon 
                ? smsService.sendShipmentSMS(user.telefon, kargo.takipNo, kargo.firma)
                : Promise.resolve();

            // Her ikisini de bekle
            const [emailResult, smsResult] = await Promise.allSettled([
                emailPromise,
                smsPromise
            ]);

            console.log('📧 E-posta:', emailResult.status);
            console.log('📱 SMS:', smsResult.status);

            return {
                success: true,
                email: emailResult.status === 'fulfilled',
                sms: smsResult.status === 'fulfilled'
            };

        } catch (error) {
            console.error('Bildirim gönderme hatası:', error);
            throw error;
        }
    }

    // Sipariş onayı
    async sendOrderConfirmation(siparisId) {
        try {
            const order = await Order.findById(siparisId).populate('kullanici');
            const user = order.kullanici;

            const orderData = {
                siparisNo: order.siparisNo || order._id.toString().slice(-6).toUpperCase(),
                items: order.urunler || order.items,
                toplam: order.toplam || order.total
            };

            // E-posta
            await emailService.sendOrderConfirmation(user.email, user.ad, orderData);

            // SMS
            if (user.telefon) {
                await smsService.sendOrderConfirmationSMS(
                    user.telefon,
                    orderData.siparisNo,
                    orderData.toplam
                );
            }

            return { success: true };

        } catch (error) {
            console.error('Sipariş onay bildirimi hatası:', error);
            throw error;
        }
    }

    // Şifre sıfırlama
    async sendPasswordReset(userId, resetToken) {
        try {
            const user = await User.findById(userId);
            
            const resetLink = `https://tedarikci.org.tr/sifre-sifirla.html?token=${resetToken}`;

            // E-posta gönder
            await emailService.sendPasswordReset(user.email, user.ad, resetLink);

            // SMS kod gönder (opsiyonel)
            if (user.telefon) {
                const smsKod = Math.floor(100000 + Math.random() * 900000).toString();
                await smsService.sendPasswordResetSMS(user.telefon, smsKod);
            }

            return { success: true };

        } catch (error) {
            console.error('Şifre sıfırlama bildirimi hatası:', error);
            throw error;
        }
    }

    // Toplu kampanya bildirimi
    async sendCampaignNotification({ subject, message, filter = {} }) {
        try {
            // Filtreye göre kullanıcıları bul
            const users = await User.find({
                ...filter,
                emailBildirim: { $ne: false } // E-posta istemeyenleri hariç tut
            });

            console.log(`${users.length} kullanıcıya kampanya bildirimi gönderiliyor...`);

            // Toplu e-posta
            const emailResults = await emailService.sendBulk({
                recipients: users.map(u => ({ email: u.email, name: u.ad })),
                subject,
                htmlContent: message
            });

            return {
                success: true,
                total: users.length,
                results: emailResults
            };

        } catch (error) {
            console.error('Kampanya bildirimi hatası:', error);
            throw error;
        }
    }

    // Yöneticiye yeni sipariş bildirimi (E-posta + SMS)
    async notifyAdminOfNewOrder(orderData) {
        try {
            console.log(`✉️ Yöneticiye bildirim gönderiliyor... Sipariş: #${orderData.siparisNo}`);
            
            if (!process.env.ADMIN_PHONE && !process.env.ADMIN_ORDER_NOTIFY_EMAIL) {
                console.warn('⚠️ Bildirim için hedef (email veya telefon) tanımlı değil!');
                return { skipped: true };
            }

            // 1. E-posta Bildirimi
            const adminNotifyRaw = process.env.ADMIN_ORDER_NOTIFY_EMAIL;
            const adminRecipients = adminNotifyRaw 
                ? adminNotifyRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
                : [];

            let emailPromise = Promise.resolve({ skipped: true });
            if (adminRecipients.length > 0) {
                console.log(`📧 E-posta hazırlanıyor: ${adminRecipients.join(', ')}`);
                emailPromise = emailService.sendNewOrderAdminNotification(adminRecipients, orderData)
                    .catch(err => {
                        console.error('❌ Admin e-posta bildirim hatası:', err.message);
                        return { error: err.message };
                    });
            }

            // 2. SMS Bildirimi
            let smsPromise = Promise.resolve({ skipped: true });
            if (process.env.ADMIN_PHONE) {
                console.log(`📱 SMS hazırlanıyor: ${process.env.ADMIN_PHONE}`);
                smsPromise = smsService.sendAdminNewOrderSMS(orderData)
                    .catch(err => {
                        console.error('❌ Admin SMS bildirim hatası:', err.message);
                        return { error: err.message };
                    });
            }

            // 3. Teslimatı Bekle (Biri hata olsa bile diğeri etkilenmez)
            const [emailResult, smsResult] = await Promise.all([
                emailPromise,
                smsPromise
            ]);

            console.log(`✅ Admin bildirim süreci tamamlandı. Durum: E-posta=${!!emailResult.success}, SMS=${!!smsResult.success}`);

            return {
                email: !!emailResult.success,
                sms: !!smsResult.success
            };

        } catch (error) {
            console.error('❌ Yönetici bildirimi hatası:', error.message);
            // Hata olsa bile ana akışı bozmamak için fırlatmayabiliriz
            return { error: error.message };
        }
    }
}

module.exports = new NotificationService();