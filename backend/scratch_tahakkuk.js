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

    // KDV 2025-12
    const kdv = await BeyanDurum.findOneAndUpdate(
      { tur: 'kdv', yil: 2025, donem: '12' },
      {
        durum: 'verildi',
        verilmeTarihi: new Date('2026-01-19T00:00:00Z'),
        hesaplananKdv: 11286.57,
        indirilecekKdv: 11962.98,
        devredenKdvOnceki: 0, 
        odenmesiGerekenKdv: 791.00, // Damga vergisi
        devredenKdv: 676.41, // 2026 Ocağa devredecek tutar
        akNo: '2026011901Jsh0000136',
        notlar: 'Sistem tarafından manuel tahakkuktan işlendi',
        sonGun: new Date('2026-01-28T00:00:00Z')
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('KDV Eklendi:', kdv.donem, 'Devreden:', kdv.devredenKdv);

    // Muhtasar 2025-Q4 (Aralık)
    const muh = await BeyanDurum.findOneAndUpdate(
      { tur: 'muhtasar', yil: 2025, donem: 'Q4' },
      {
        durum: 'verildi',
        verilmeTarihi: new Date('2026-01-17T00:00:00Z'),
        stopajMatrahi: 912.00,
        stopajTutari: 1122.10, // Toplam ödenecek (Damga dahil)
        akNo: '2026011701Jsh0000037',
        notlar: 'Sistem tarafından manuel tahakkuktan işlendi',
        sonGun: new Date('2026-01-26T00:00:00Z')
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('Muhtasar Eklendi:', muh.donem, 'Ödenecek:', muh.stopajTutari);

    process.exit(0);
  } catch (err) {
    console.error('Hata:', err);
    process.exit(1);
  }
}

seed();
