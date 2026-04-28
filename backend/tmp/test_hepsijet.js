const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testHepsijetAuth() {
    console.log('--- Hepsijet Bağlantı Testi Başlatıldı ---');
    console.log('Kullanıcı:', process.env.HEPSIJET_USER);
    console.log('Şifre Uzunluğu:', process.env.HEPSIJET_PASSWORD ? process.env.HEPSIJET_PASSWORD.length : 0);

    
    const baseUrl = process.env.HEPSIJET_API_URL || 'https://integration-apitest.hepsijet.com/';
    const merchantId = process.env.HEPSIJET_MERCHANT_ID || process.env.HEPSIJET_CUSTOMER_CODE;

    try {
        const response = await axios.post(`${baseUrl}auth/getToken`, {
            username: process.env.HEPSIJET_USER,
            password: process.env.HEPSIJET_PASSWORD,
            merchantId
        });

        console.log('\n✅ Bağlantı Başarılı!');
        console.log('Token Alındı:', response.data.token ? 'Evet' : 'Hayır');
        
        if (response.data.customerRole) {
            console.log('Müşteri Rolü:', response.data.customerRole);
        }

        // Genelde token ile birlikte kullanıcı bilgileri de döner
        console.log('\n--- Yanıt Detayı ---');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('\n❌ Bağlantı Başarısız!');
        if (error.response) {
            console.log('Hata Kodu:', error.response.status);
            console.log('Hata Mesajı:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Hata:', error.message);
        }
    }
}

testHepsijetAuth();
