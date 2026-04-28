/**
 * Kurumsal Tedarikçi SMS Servisi
 * Gelecekteki NetGSM, Bulutfon veya Twilio SMS entegrasyonu için temel yapı.
 */
class SMSService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'placeholder';
  }

  /**
   * Tekil SMS Gönder
   * @param {string} to - Telefon numarası (905XXXXXXXXX formatı önerilir)
   * @param {string} message - SMS metni
   */
  async sendSMS(to, message) {
    if (!to || !message) {
      throw new Error('Alıcı ve mesaj içeriği gereklidir.');
    }

    console.log(`[SMS Servis] Gönderiliyor -> ${to}: ${message}`);

    // Gelecekte buraya gerçek API entegrasyonları gelecek
    switch (this.provider) {
      case 'netgsm':
        return await this._sendNetGSM(to, message);
      case 'bulutfon':
        return await this._sendBulutfon(to, message);
      default:
        console.warn('⚠️ SMS sağlayıcısı ayarlanmamış (placeholder çalışıyor).');
        return { success: true, messageId: 'simulated_id' };
    }
  }

  async _sendNetGSM(to, message) {
    // NetGSM API logic
    return { success: true, provider: 'netgsm' };
  }

  async _sendBulutfon(to, message) {
    // Bulutfon API logic
    return { success: true, provider: 'bulutfon' };
  }
}

module.exports = new SMSService();