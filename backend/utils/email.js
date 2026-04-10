const emailService = require('../services/emailService');

/**
 * Müşteri ve Hatırlatma servisleri için ortak e-posta gönderme fonksiyonu.
 * EmailService (Brevo/Sendinblue) üzerinden gönderim yapar.
 * 
 * @param {Object} options - Gönderim seçenekleri
 * @param {string|string[]} options.to - Alıcı adresi veya adresleri
 * @param {string} options.subject - E-posta konusu
 * @param {string} options.html - HTML içeriği (EmailService.send metodunda htmlContent olarak eşleşir)
 * @param {number} [options.templateId] - Opsiyonel Brevo şablon ID'si
 * @param {Object} [options.params] - Şablon parametreleri
 */
const sendEmail = async (options) => {
    try {
        const { html, ...rest } = options;
        
        // emailService.send metodu 'htmlContent' bekliyor, 'html' değil.
        // Bu yüzden burada eşleştirme (mapping) yapıyoruz.
        return await emailService.send({
            ...rest,
            htmlContent: html
        });
    } catch (error) {
        console.error('sendEmail Hatası:', error);
        throw error;
    }
};

module.exports = {
    sendEmail
};
