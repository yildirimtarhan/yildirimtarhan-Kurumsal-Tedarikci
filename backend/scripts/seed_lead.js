const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const MarketingLead = require('../models/MarketingLead');

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci';
    console.log(`Connecting to: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
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
      console.log('ℹ️ Test kaydı zaten mevcut (test@example.com).');
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
