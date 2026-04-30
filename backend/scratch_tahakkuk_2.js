const mongoose = require('mongoose');
const BeyanDurum = require('./models/BeyanDurum');
require('dotenv').config({ path: './.env' });

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB bağlandı.');

    // Geçici Vergi 2025-G4 (Q4 / 10-12 dönemi)
    const ggv = await BeyanDurum.findOneAndUpdate(
      { tur: 'geciciVergi', yil: 2025, donem: 'G4' },
      {
        durum: 'verildi',
        verilmeTarihi: new Date('2026-01-31T00:00:00Z'),
        vergiMatrahi: 0,
        vergiTutari: 1085.20, // (294.20 DVER + 791.00 Damga)
        akNo: '2026013101Jsh0000005',
        notlar: 'Sistem tarafından manuel tahakkuktan işlendi',
        sonGun: new Date('2026-02-17T00:00:00Z')
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('Geçici Vergi Eklendi:', ggv.donem, 'Ödenecek:', ggv.vergiTutari);

    // Yıllık Gelir Vergisi 2025
    const gv = await BeyanDurum.findOneAndUpdate(
      { tur: 'gelirVergisi', yil: 2025, donem: 'YILLIK' },
      {
        durum: 'verildi',
        verilmeTarihi: new Date('2026-03-07T00:00:00Z'),
        vergiMatrahi: 0,
        vergiTutari: 1483.70, // (294.20 DVER + 1189.50 Damga)
        akNo: '2026030701Jsh0000011',
        notlar: 'Sistem tarafından manuel tahakkuktan işlendi',
        sonGun: new Date('2026-03-31T00:00:00Z')
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('Gelir Vergisi Eklendi:', gv.donem, 'Ödenecek:', gv.vergiTutari);

    process.exit(0);
  } catch (err) {
    console.error('Hata:', err);
    process.exit(1);
  }
}

seed();
