const mongoose = require('mongoose');
require('dotenv').config();

const cleanup = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Veritabanına bağlandı.');

    // Silinecek modelleri tanımla
    const collections = [
      'orders',
      'faturas',
      'carihesaps',
      'tahsilats',
      'defterkaydis',
      'kasaislems'
    ];

    for (const colName of collections) {
      try {
        await mongoose.connection.collection(colName).deleteMany({});
        console.log(`🗑️ ${colName} temizlendi.`);
      } catch (e) {
        console.log(`⚠️ ${colName} silinirken hata (belki tablo boştur):`, e.message);
      }
    }

    console.log('\n✨ Tüm test verileri temizlendi! Şimdi Taxten senkronizasyonunu başlatabilirsiniz.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
};

cleanup();
