// services/smsService.js
const axios = require('axios');

class SMSService {
    constructor() {
        this.config = {
            netgsm: {
                usercode: process.env.NETGSM_USERCODE,
                password: process.env.NETGSM_PASSWORD,
                msgheader: process.env.NETGSM_HEADER || 'KURUMSAL',
                baseUrl: 'https://api.netgsm.com.tr/sms/send/get'
            },
            // Alternatif: Twilio
            twilio: {
                accountSid: process.env.TWILIO_SID,
                authToken: process.env.TWILIO_TOKEN,
                fromNumber: process.env.TWILIO_NUMBER
            }
        };
    }

    // Telefon numarasını formatla (05xx xxx xx xx -> 5xxxxxxxxx)
    formatPhone(phone) {
        return phone.replace(/\D/g, '').replace(/^0/, '').replace(/^9/, '');
    }

    // Netgsm ile SMS gönder
    async sendNetSMS({ to, message }) {
        try {
            const formattedPhone = this.formatPhone(to);
            
            const params = new URLSearchParams({
                usercode: this.config.netgsm.usercode,
                password: this.config.netgsm.password,
                gsmno: formattedPhone,
                message: message,
                msgheader: this.config.netgsm.msgheader,
                dil: 'TR'
            });

            const response = await axios.get(`${this.config.netgsm.baseUrl}?${params.toString()}`);
            
            // Netgsm yanıt kodları
            const responseCode = response.data.split(' ')[0];
            const codes = {
                '00': 'Gönderildi',
                '20': 'Mesaj uzunluğu hatası',
                '30': 'Geçersiz kullanıcı',
                '40': 'Kullanıcı aktif değil',
                '50': 'Hatalı şifre',
                '60': 'Yetkisiz IP',
                '70': 'Hatalı parametre'
            };

            if (responseCode === '00') {
                console.log('✅ SMS gönderildi:', to);
                return { success: true, messageId: response.data };
            } else {
                throw new Error(codes[responseCode] || 'Bilinmeyen hata');
            }
            
        } catch (error) {
            console.error('❌ SMS gönderme hatası:', error);
            throw error;
        }
    }

    // Twilio ile SMS gönder (alternatif)
    async sendTwilioSMS({ to, message }) {
        try {
            const client = require('twilio')(this.config.twilio.accountSid, this.config.twilio.authToken);
            
            const response = await client.messages.create({
                body: message,
                from: this.config.twilio.fromNumber,
                to: `+90${this.formatPhone(to)}`
            });
            
            console.log('✅ Twilio SMS gönderildi:', response.sid);
            return { success: true, messageId: response.sid };
            
        } catch (error) {
            console.error('❌ Twilio hatası:', error);
            throw error;
        }
    }

    // Genel SMS gönder (varsayılan: Netgsm)
    async send({ to, message }) {
        // Eğer Twilio ayarları varsa onu kullan, yoksa Netgsm
        if (this.config.twilio.accountSid) {
            return await this.sendTwilioSMS({ to, message });
        }
        return await this.sendNetSMS({ to, message });
    }

    // Kargo bildirimi SMS
    async sendShipmentSMS(phone, takipNo, firma) {
        const message = `Kurumsal Tedarikci: Siparisiniz ${firma} ile kargoya verildi. Takip No: ${takipNo}. Takip: tedarikci.org.tr/kargo-takip.html`;
        
        return await this.send({
            to: phone,
            message: message.substring(0, 160) // SMS karakter limiti
        });
    }

    // Sipariş onayı SMS
    async sendOrderConfirmationSMS(phone, siparisNo, toplam) {
        const message = `Kurumsal Tedarikci: Siparisiniz alindi. No: ${siparisNo}, Tutar: ${toplam}TL. Bizi tercih ettiginiz icin tesekkurler.`;
        
        return await this.send({
            to: phone,
            message: message.substring(0, 160)
        });
    }

    // Şifre sıfırlama SMS
    async sendPasswordResetSMS(phone, kod) {
        const message = `Kurumsal Tedarikci sifre sifirlama kodunuz: ${kod}. Bu kod 10 dakika gecerlidir.`;
        
        return await this.send({
            to: phone,
            message
        });
    }

    // Toplu SMS gönder
    async sendBulk({ phones, message }) {
        const results = [];
        for (const phone of phones) {
            try {
                const result = await this.send({ to: phone, message });
                results.push({ phone, success: true, result });
            } catch (error) {
                results.push({ phone, success: false, error: error.message });
            }
        }
        return results;
    }
}

module.exports = new SMSService();