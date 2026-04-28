const mongoose = require('mongoose');
require('dotenv').config();
const MarketingLead = require('../backend/models/MarketingLead');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
    console.log('✅ MongoDB connected');

    const testLead = {
      firmaAdi: 'Test Limited Şirketi',
      sektor: 'Teknoloji',
      email: 'test@example.com',
      yetkiliAdSoyad: 'Ahmet Test',
      telefon: '05000000000',
      durum: 'yeni',
      webSitesi: 'https://test.com',
      notlar: 'Bu bir otomatik oluşturulmuş test kaydıdır.'
    };

    const existing = await MarketingLead.findOne({ email: testLead.email });
    if (existing) {
      console.log('ℹ️ Test kaydı zaten mevcut.');
    } else {
      await MarketingLead.create(testLead);
      console.log('✅ Test kaydı başarıyla eklendi!');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

seed();
