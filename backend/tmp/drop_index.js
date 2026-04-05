const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function dropIndex() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci';
    await mongoose.connect(mongoURI);
    console.log('MongoDB bağlandı...');

    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'carihesaps' }).toArray();

    if (collections.length > 0) {
      console.log('carihesaps koleksiyonunda indeksler kontrol ediliyor...');
      await db.collection('carihesaps').dropIndex('kullaniciId_1');
      console.log('BAŞARILI: kullaniciId_1 indeksi silindi.');
    } else {
      console.log('carihesaps koleksiyonu bulunamadı.');
    }

  } catch (error) {
    if (error.codeName === 'IndexNotFound') {
      console.log('BİLGİ: İndeks zaten mevcut değil.');
    } else {
      console.error('HATA:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

dropIndex();
