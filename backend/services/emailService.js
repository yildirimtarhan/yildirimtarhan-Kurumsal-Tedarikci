// services/emailService.js
const nodemailer = require('nodemailer');
const SibApiV3Sdk = require('sib-api-v3-sdk');

class EmailService {
    constructor() {
        this.client = SibApiV3Sdk.ApiClient.instance;
        this.apiKey = this.client.authentications['api-key'];
        this.apiKey.apiKey = process.env.BREVO_API_KEY;

        this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

        this.sender = {
            email: process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@tedarikci.org.tr',
            name: process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'Kurumsal Tedarikçi'
        };
    }

    _smtpConfigured() {
        return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    }

    _smtpTransporter() {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    _normalizeRecipients(to) {
        const list = Array.isArray(to) ? to : [to];
        return list.map((e) => String(e).trim()).filter(Boolean);
    }

    async sendViaSmtp({ to, subject, htmlContent }) {
        if (!this._smtpConfigured()) {
            throw new Error('SMTP eksik: SMTP_HOST, SMTP_USER, SMTP_PASS (veya BREVO_API_KEY) gerekli');
        }
        const recipients = this._normalizeRecipients(to);
        if (!recipients.length) throw new Error('Alıcı e-posta yok');
        const transporter = this._smtpTransporter();
        const fromEmail = this.sender.email;
        const fromName = this.sender.name;
        await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: recipients.join(', '),
            subject,
            html: htmlContent
        });
        console.log('✅ E-posta gönderildi (SMTP):', subject);
        return { success: true, messageId: 'smtp' };
    }

    async sendViaBrevo({ to, subject, htmlContent, templateId, params }) {
        const sendSmtpEmail = {
            to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }],
            sender: this.sender,
            replyTo: this.sender
        };
        if (templateId) {
            sendSmtpEmail.templateId = templateId;
            sendSmtpEmail.params = params || {};
        } else {
            sendSmtpEmail.subject = subject;
            sendSmtpEmail.htmlContent = htmlContent;
        }
        const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ E-posta gönderildi (Brevo):', response.messageId);
        return { success: true, messageId: response.messageId };
    }

    /**
     * Önce Brevo API (BREVO_API_KEY), başarısız veya yoksa SMTP (SMTP_HOST + USER + PASS).
     * Şablonlu posta (templateId) yalnızca Brevo ile.
     */
    async send({ to, subject, htmlContent, templateId, params }) {
        try {
            if (templateId) {
                if (!process.env.BREVO_API_KEY) {
                    throw new Error('Şablonlu e-posta için BREVO_API_KEY gerekli');
                }
                return await this.sendViaBrevo({ to, subject, htmlContent, templateId, params });
            }

            if (process.env.BREVO_API_KEY) {
                try {
                    return await this.sendViaBrevo({ to, subject, htmlContent });
                } catch (brevoErr) {
                    console.warn('⚠️ Brevo gönderilemedi, SMTP deneniyor:', brevoErr.message);
                }
            }

            return await this.sendViaSmtp({ to, subject, htmlContent });
        } catch (error) {
            console.error('❌ E-posta gönderme hatası:', error);
            throw new Error(`E-posta gönderilemedi: ${error.message}`);
        }
    }

    async sendBulk({ recipients, subject, htmlContent }) {
        try {
            if (process.env.BREVO_API_KEY) {
                try {
                    const sendSmtpEmail = {
                        to: recipients.map((r) => ({ email: r.email, name: r.name })),
                        sender: this.sender,
                        subject,
                        htmlContent
                    };
                    const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
                    return { success: true, messageId: response.messageId };
                } catch (e) {
                    console.warn('⚠️ Brevo toplu gönderim hatası, SMTP:', e.message);
                }
            }
            const emails = recipients.map((r) => r.email).filter(Boolean);
            return await this.sendViaSmtp({ to: emails, subject, htmlContent });
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

    /** Yeni sipariş geldiğinde admin(ler)e bilgi maili (ADMIN_ORDER_NOTIFY_EMAIL) */
    async sendNewOrderAdminNotification(adminEmails, orderData) {
        if (!adminEmails || !adminEmails.length) return { skipped: true };
        const esc = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const baseUrl = (process.env.FRONTEND_URL || 'https://tedarikci.org.tr').replace(/\/$/, '');
        const adminOrdersUrl = `${baseUrl}/admin/orders.html`;
        const itemsRows = (orderData.items || []).map((item) => `
            <tr>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${esc(item.ad)}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${esc(item.adet)}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">₺${Number(item.fiyat || 0).toFixed(2)}</td>
            </tr>
        `).join('');
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family:Arial,sans-serif;line-height:1.5;color:#333;">
                <div style="max-width:600px;margin:0 auto;padding:20px;">
                    <div style="background:#1e40af;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
                        <h1 style="margin:0;font-size:20px;">Yeni sipariş</h1>
                    </div>
                    <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;">
                        <p><strong>Sipariş no:</strong> #${esc(orderData.siparisNo)}</p>
                        <p><strong>Tip:</strong> ${esc(orderData.orderType === 'b2b' ? 'Bayi (B2B)' : 'Perakende (B2C)')}</p>
                        <p><strong>Müşteri:</strong> ${esc(orderData.musteriAd)}</p>
                        <p><strong>E-posta:</strong> ${esc(orderData.musteriEmail)}</p>
                        ${orderData.firmaAdi ? `<p><strong>Firma:</strong> ${esc(orderData.firmaAdi)}</p>` : ''}
                        <p><strong>Ödeme:</strong> ${esc(orderData.paymentMethod)}</p>
                        <p><strong>Toplam:</strong> ₺${Number(orderData.toplam || 0).toFixed(2)}</p>
                        <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#fff;border-radius:8px;">
                            <thead><tr style="background:#e5e7eb;">
                                <th style="padding:8px;text-align:left;">Ürün</th>
                                <th style="padding:8px;text-align:right;">Adet</th>
                                <th style="padding:8px;text-align:right;">Birim</th>
                            </tr></thead>
                            <tbody>${itemsRows}</tbody>
                        </table>
                        <p style="margin-top:24px;">
                            <a href="${esc(adminOrdersUrl)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Siparişleri aç</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
        const subjectName = String(orderData.musteriAd || 'Müşteri').replace(/[\r\n]/g, ' ').slice(0, 40);
        return await this.send({
            to: adminEmails,
            subject: `Yeni sipariş #${orderData.siparisNo} — ${subjectName}`,
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

    /**
     * AI Görüşme Takip E-postası (Profesyonel B2B)
     */
    async sendAIFollowUp(userEmail, leadName, companyName, emailBody, subject) {
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
                    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding-bottom: 40px; }
                    .main { background-color: #ffffff; width: 100%; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-top: 20px; }
                    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 20px; text-align: center; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
                    .content { padding: 40px 30px; }
                    .content p { margin-bottom: 20px; font-size: 16px; color: #334155; }
                    .highlight-box { background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
                    .footer { padding: 30px; text-align: center; background-color: #f8fafc; color: #64748b; font-size: 13px; }
                    .btn { display: inline-block; padding: 14px 30px; background-color: #1e40af; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                    .signature { margin-top: 30px; border-top: 1px solid #e2e8f0; pt: 20px; font-size: 14px; color: #475569; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="main">
                        <div class="header">
                            <h1>Kurumsal Tedarikçi</h1>
                        </div>
                        <div class="content">
                            <p>Sayın <strong>${leadName}</strong>,</p>
                            <p><strong>${companyName}</strong> adına yaptığımız görüşmeye istinaden size bu bilgilendirme e-postasını iletiyorum.</p>
                            
                            <div class="email-body">
                                ${emailBody}
                            </div>
                            
                            <center>
                                <a href="https://tedarikci.org.tr/hizmetlerimiz.html" class="btn">Hizmetlerimizi İnceleyin</a>
                            </center>
                            
                            <div class="signature">
                                <strong>Pelin</strong><br>
                                Yapay Zeka Satış Operasyonları<br>
                                <span style="color: #3b82f6;">www.tedarikci.org.tr</span><br>
                                📞 0850 123 45 67
                            </div>
                        </div>
                        <div class="footer">
                            <p>Bu e-posta, yaptığımız telefon görüşmesine istinaden otomatik olarak oluşturulmuştur.</p>
                            <p>© 2025 Kurumsal Tedarikçi. Tüm hakları saklıdır.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.send({
            to: userEmail,
            subject: subject || `${companyName} — Görüşmemiz Hakkında`,
            htmlContent
        });
    }
}

module.exports = new EmailService();