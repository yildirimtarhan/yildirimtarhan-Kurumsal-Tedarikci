// services/emailService.js
const SibApiV3Sdk = require('sib-api-v3-sdk');

class EmailService {
    constructor() {
        // Brevo API yapılandırması
        this.client = SibApiV3Sdk.ApiClient.instance;
        this.apiKey = this.client.authentications['api-key'];
        this.apiKey.apiKey = process.env.BREVO_API_KEY;
        
        this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        
        // Varsayılan gönderici
        this.sender = {
            email: process.env.EMAIL_FROM || 'noreply@tedarikci.org.tr',
            name: process.env.EMAIL_FROM_NAME || 'Kurumsal Tedarikçi'
        };
    }

    // Tek e-posta gönder
    async send({ to, subject, htmlContent, templateId, params }) {
        try {
            const sendSmtpEmail = {
                to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
                sender: this.sender,
                replyTo: this.sender
            };

            // Template kullanımı veya direkt HTML
            if (templateId) {
                sendSmtpEmail.templateId = templateId;
                sendSmtpEmail.params = params || {};
            } else {
                sendSmtpEmail.subject = subject;
                sendSmtpEmail.htmlContent = htmlContent;
            }

            const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
            
            console.log('✅ E-posta gönderildi:', response.messageId);
            return { success: true, messageId: response.messageId };
            
        } catch (error) {
            console.error('❌ E-posta gönderme hatası:', error);
            throw new Error(`E-posta gönderilemedi: ${error.message}`);
        }
    }

    // Toplu e-posta gönder
    async sendBulk({ recipients, subject, htmlContent }) {
        try {
            const sendSmtpEmail = {
                to: recipients.map(r => ({ email: r.email, name: r.name })),
                sender: this.sender,
                subject,
                htmlContent
            };

            const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
            return { success: true, messageId: response.messageId };
            
        } catch (error) {
            console.error('Toplu e-posta hatası:', error);
            throw error;
        }
    }

    // Kargo bildirimi şablonu
    async sendShipmentNotification(userEmail, userName, orderData) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
                    .btn { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 25px; margin: 20px 0; }
                    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚚 Siparişiniz Yolda!</h1>
                    </div>
                    <div class="content">
                        <p>Sayın <strong>${userName}</strong>,</p>
                        <p>Siparişiniz kargoya verildi. Aşağıdaki bilgilerle takip edebilirsiniz:</p>
                        
                        <div class="info-box">
                            <p><strong>Sipariş No:</strong> #${orderData.siparisNo}</p>
                            <p><strong>Kargo Firması:</strong> ${orderData.kargoFirma}</p>
                            <p><strong>Takip No:</strong> <span style="font-size: 18px; color: #6366f1; font-weight: bold;">${orderData.takipNo}</span></p>
                            <p><strong>Tahmini Teslimat:</strong> ${orderData.tahminiTeslimat}</p>
                        </div>
                        
                        <center>
                            <a href="https://tedarikci.org.tr/kargo-takip.html?track=${orderData.takipNo}" class="btn">
                                Kargomu Takip Et
                            </a>
                        </center>
                        
                        <p style="margin-top: 30px;">Sorularınız için bize ulaşabilirsiniz:</p>
                        <p>📞 0850 123 45 67<br>📧 destek@tedarikci.org.tr</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Kurumsal Tedarikçi. Tüm hakları saklıdır.</p>
                        <p>Bu e-posta otomatik olarak gönderilmiştir.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.send({
            to: userEmail,
            subject: `🚚 Siparişiniz Kargoya Verildi - #${orderData.siparisNo}`,
            htmlContent
        });
    }

    // Sipariş onayı
    async sendOrderConfirmation(userEmail, userName, orderData) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #10b981; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
                    .total { font-size: 20px; font-weight: bold; color: #6366f1; text-align: right; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Siparişiniz Alındı!</h1>
                    </div>
                    <div class="content">
                        <p>Sayın <strong>${userName}</strong>,</p>
                        <p>Siparişiniz başarıyla oluşturuldu. Detaylar aşağıdadır:</p>
                        
                        <div class="order-details">
                            <p><strong>Sipariş No:</strong> #${orderData.siparisNo}</p>
                            <p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                            ${orderData.items.map(item => `
                                <div class="item">
                                    ${item.ad} x ${item.adet} - ₺${item.fiyat * item.adet}
                                </div>
                            `).join('')}
                            <div class="total">Toplam: ₺${orderData.toplam}</div>
                        </div>
                        
                        <p>Siparişiniz hazırlandığında kargo bilgisi iletilecektir.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.send({
            to: userEmail,
            subject: `✅ Sipariş Onayı - #${orderData.siparisNo}`,
            htmlContent
        });
    }

    // Şifre sıfırlama
    async sendPasswordReset(userEmail, userName, resetLink) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
                    .btn { display: inline-block; padding: 15px 40px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Şifre Sıfırlama</h2>
                    <p>Sayın ${userName},</p>
                    <p>Şifre sıfırlama talebinizi aldık. Aşağıdaki bağlantıya tıklayarak yeni şifre belirleyebilirsiniz:</p>
                    <center>
                        <a href="${resetLink}" class="btn">Şifremi Sıfırla</a>
                    </center>
                    <p style="color: #6b7280; font-size: 12px;">Bu bağlantı 1 saat geçerlidir.</p>
                    <p style="color: #6b7280; font-size: 12px;">Talep sizin tarafınızdan yapılmadıysa bu e-postayı görmezden gelin.</p>
                </div>
            </body>
            </html>
        `;

        return await this.send({
            to: userEmail,
            subject: '🔐 Şifre Sıfırlama Talebi',
            htmlContent
        });
    }

    // Bayilik başvurusu alındı
    async sendBayilikBasvuruAlindi(userEmail, firmaAdi) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
                    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📋 Bayilik Başvurunuz Alındı</h1>
                    </div>
                    <div class="content">
                        <p>Sayın <strong>${(firmaAdi || 'Müşteri').replace(/</g, '&lt;')}</strong>,</p>
                        <p>Bayilik başvurunuz başarıyla tarafımıza ulaştı. İnceleme sürecinden sonra sonucu e-posta ile bildireceğiz.</p>
                        <div class="info-box">
                            <p><strong>Sonraki adım:</strong> Başvurunuz en kısa sürede değerlendirilecektir. Onay sonrası Bayi Girişi ile toptan fiyatlardan yararlanabileceksiniz.</p>
                        </div>
                        <p>Sorularınız için: <a href="https://tedarikci.org.tr/iletisim.html">İletişim</a></p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Kurumsal Tedarikçi. Bu e-posta otomatik olarak gönderilmiştir.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        return await this.send({
            to: userEmail,
            subject: '📋 Bayilik Başvurunuz Alındı - Kurumsal Tedarikçi',
            htmlContent
        });
    }

    // Bayilik onaylandı
    async sendBayilikOnaylandi(userEmail, firmaAdi) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #10b981; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .btn { display: inline-block; padding: 14px 28px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 15px 0; }
                    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Bayilik Başvurunuz Onaylandı!</h1>
                    </div>
                    <div class="content">
                        <p>Sayın <strong>${(firmaAdi || 'Müşteri').replace(/</g, '&lt;')}</strong>,</p>
                        <p>Bayilik başvurunuz onaylanmıştır. Artık <strong>Bayi Girişi</strong> ile giriş yaparak toptan (B2B) fiyatlardan yararlanabilirsiniz.</p>
                        <p><strong>Yapmanız gerekenler:</strong></p>
                        <ul>
                            <li>Siteye giriş yapın (mevcut hesabınızla)</li>
                            <li>Menüden <strong>Bayi Girişi</strong> sayfasına giderek bayi olarak giriş yapın</li>
                            <li>Ürünlerde toptan fiyatları görüntüleyebilirsiniz</li>
                        </ul>
                        <center>
                            <a href="https://tedarikci.org.tr/bayi-giris.html" class="btn">Bayi Girişi Yap</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>© 2025 Kurumsal Tedarikçi. Bu e-posta otomatik olarak gönderilmiştir.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        return await this.send({
            to: userEmail,
            subject: '✅ Bayilik Başvurunuz Onaylandı - Kurumsal Tedarikçi',
            htmlContent
        });
    }

    // Bayilik reddedildi
    async sendBayilikReddedildi(userEmail, firmaAdi, adminNotu) {
        const notHtml = (adminNotu && String(adminNotu).trim())
            ? `<div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;"><strong>Not:</strong> ${String(adminNotu).replace(/</g, '&lt;')}</div>`
            : '';
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #6b7280; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Bayilik Başvurusu</h1>
                    </div>
                    <div class="content">
                        <p>Sayın <strong>${(firmaAdi || 'Müşteri').replace(/</g, '&lt;')}</strong>,</p>
                        <p>Bayilik başvurunuz değerlendirilmiş olup, şu an için olumlu sonuçlanamamıştır.</p>
                        ${notHtml}
                        <p>Yeni bir başvuru veya sorularınız için <a href="https://tedarikci.org.tr/iletisim.html">bizimle iletişime</a> geçebilirsiniz.</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Kurumsal Tedarikçi. Bu e-posta otomatik olarak gönderilmiştir.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        return await this.send({
            to: userEmail,
            subject: 'Bayilik Başvurusu - Kurumsal Tedarikçi',
            htmlContent
        });
    }
}

module.exports = new EmailService();