const axios = require('axios');
const Order = require('../models/Order');
const hepsijetService = require('./hepsijetService');

class KargoService {
    constructor() {
        // API yapılandırmaları (env'den okunacak)
        this.config = {
            yurtici: {
                baseUrl: process.env.YURTICI_API_URL || 'https://webservices.yurticikargo.com',
                username: process.env.YURTICI_USER,
                password: process.env.YURTICI_PASS
            },
            aras: {
                baseUrl: process.env.ARAS_API_URL || 'https://api.araskargo.com.tr',
                apiKey: process.env.ARAS_API_KEY
            },
            mng: {
                baseUrl: process.env.MNG_API_URL || 'https://service.mngkargo.com.tr',
                customerNo: process.env.MNG_CUSTOMER_NO,
                password: process.env.MNG_PASSWORD
            },
            hepsijet: {
                username: process.env.HEPSIJET_USER,
                password: process.env.HEPSIJET_PASSWORD
            }

        };
    }

    // Takip numarasından firma tespiti
    detectCourier(takipNo) {
        const prefix = takipNo.substring(0, 2).toUpperCase();
        const map = {
            'YT': 'yurtici',
            'AR': 'aras',
            'MN': 'mng',
            'PT': 'ptt',
            'UP': 'ups',
            'HJ': 'hepsijet', // Hepsijet genelde HJ veya 102 ile başlar
            '10': 'hepsijet'
        };
        return map[prefix] || 'yurtici';
    }

    // Kargo takip sorgusu
    async trackShipment(firma, takipNo) {
        // Gerçek API entegrasyonu buraya gelecek
        // Şimdilik mock data dönüyoruz
        
        if (firma === 'hepsijet') {
            return await hepsijetService.trackShipment(takipNo);
        }

        return this.getMockData(takipNo, firma);
        
        /* 
        // GERÇEK API ENTEGRASYONU ÖRNEĞİ (Yurtiçi Kargo):
        try {
            const response = await axios.post(
                `${this.config.yurtici.baseUrl}/KargoTakip`,
                {
                    kullaniciAdi: this.config.yurtici.username,
                    sifre: this.config.yurtici.password,
                    takipNo: takipNo
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            
            return this.formatYurticiResponse(response.data);
        } catch (error) {
            throw new Error(`Yurtiçi Kargo API hatası: ${error.message}`);
        }
        */
    }

    // Mock data oluşturucu
    getMockData(takipNo, firma) {
        const firmaAdlari = {
            'yurtici': 'Yurtiçi Kargo',
            'aras': 'Aras Kargo',
            'mng': 'MNG Kargo',
            'ptt': 'PTT Kargo',
            'ups': 'UPS Kargo'
        };

        const durumlar = ['hazirlaniyor', 'kargoya_verildi', 'yolda', 'dagitimda', 'teslim_edildi'];
        const rastgeleDurum = durumlar[Math.floor(Math.random() * durumlar.length)];
        
        const hareketler = [
            {
                tarih: new Date(Date.now() - 86400000 * 2),
                islem: 'Sipariş Alındı',
                yer: 'İstanbul Merkez',
                aciklama: 'Siparişiniz hazırlanıyor',
                tamamlandi: true
            },
            {
                tarih: new Date(Date.now() - 86400000),
                islem: 'Kargoya Verildi',
                yer: 'İstanbul Şubesi',
                aciklama: `${firmaAdlari[firma]} kargoya teslim edildi`,
                tamamlandi: true
            },
            {
                tarih: new Date(),
                islem: 'Yolda',
                yer: 'Ankara Aktarma',
                aciklama: 'Gönderiniz yola çıktı',
                tamamlandi: rastgeleDurum === 'teslim_edildi' || rastgeleDurum === 'dagitimda',
                aktif: rastgeleDurum === 'yolda'
            }
        ];

        if (rastgeleDurum === 'teslim_edildi' || rastgeleDurum === 'dagitimda') {
            hareketler.push({
                tarih: new Date(Date.now() + 86400000),
                islem: rastgeleDurum === 'teslim_edildi' ? 'Teslim Edildi' : 'Dağıtımda',
                yer: 'Teslimat Adresi',
                aciklama: rastgeleDurum === 'teslim_edildi' ? 'Gönderiniz teslim edildi' : 'Gönderiniz dağıtıma çıktı',
                tamamlandi: rastgeleDurum === 'teslim_edildi',
                aktif: rastgeleDurum === 'dagitimda'
            });
        }

        return {
            takipNo,
            firma: firmaAdlari[firma] || firma,
            firmaKodu: firma,
            durum: rastgeleDurum,
            durumText: this.getDurumText(rastgeleDurum),
            tahminiTeslimat: new Date(Date.now() + 86400000 * 2),
            gonderen: {
                ad: 'Kurumsal Tedarikçi',
                adres: 'İstanbul, Türkiye',
                telefon: '0850 123 45 67'
            },
            alici: {
                ad: 'Müşteri',
                adres: 'Ankara, Türkiye'
            },
            detaylar: {
                agirlik: '2.5 kg',
                birim: 1,
                cinsi: 'Paket',
                odedigiUcret: '₺45.00'
            },
            hareketler: hareketler
        };
    }

    getDurumText(durum) {
        const map = {
            'hazirlaniyor': 'Hazırlanıyor',
            'kargoya_verildi': 'Kargoya Verildi',
            'yolda': 'Yolda',
            'dagitimda': 'Dağıtımda',
            'teslim_edildi': 'Teslim Edildi'
        };
        return map[durum] || 'Bilinmiyor';
    }

    // Müşteriye bildirim gönder
    async sendNotification(order) {
        try {
            // E-posta bildirimi (Brevo/SendGrid vb.)
            console.log(`📧 E-posta gönderiliyor: ${order.kullanici.email}`);
            console.log(`📱 SMS gönderiliyor: ${order.kullanici.telefon}`);
            
            // Burada gerçek e-posta/SMS servisi çağrılacak
            // await emailService.send({...});
            // await smsService.send({...});
            
            return true;
        } catch (error) {
            console.error('Bildirim gönderme hatası:', error);
            return false;
        }
    }

    // Gerçek API yanıtlarını formatla
    formatYurticiResponse(apiData) {
        // API yanıtını frontend'e uygun formata çevir
        return {
            takipNo: apiData.takipNo,
            firma: 'Yurtiçi Kargo',
            durum: apiData.durum,
            hareketler: apiData.hareketler.map(h => ({
                tarih: new Date(h.tarih),
                islem: h.islem,
                yer: h.yer,
                aciklama: h.aciklama
            }))
        };
    }
}

module.exports = new KargoService();