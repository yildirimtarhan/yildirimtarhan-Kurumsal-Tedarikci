const mongoose = require('mongoose');
const BeyanDurum = require('./models/BeyanDurum');
require('dotenv').config({ path: './.env' });

function sonGunHesapla(tur, yil, donem) {
  switch (tur) {
    case 'kdv':
      const kAy = parseInt(donem, 10);
      const kYil = kAy === 12 ? yil + 1 : yil;
      const kSonAy = kAy === 12 ? 1 : kAy + 1;
      return new Date(kYil, kSonAy - 1, 28);
    case 'geciciVergi':
      const geciciMap = { G1: [5, 17], G2: [8, 17], G3: [11, 17] };
      const [gAy, gGun] = geciciMap[donem] || [5, 17];
      return new Date(yil, gAy - 1, gGun);
    case 'muhtasar':
      const mSonAy = { '01': 2, '02': 3, '03': 4, Q1: 4, Q2: 7, Q3: 10, Q4: 1 };
      const mYil = donem === 'Q4' ? yil + 1 : yil;
      return new Date(mYil, mSonAy[donem] - 1, 26);
    case 'gelirVergisi':
      return new Date(yil + 1, 2, 31);
    case 'bagkur':
      const bAy = parseInt(donem, 10);
      return new Date(yil, bAy - 1, 28);
    default:
      return null;
  }
}

async function initYil() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
    const yil = 2026;
    let count = 0;

    for (let ay = 1; ay <= 12; ay++) {
      const donem = String(ay).padStart(2, '0');
      if (!(await BeyanDurum.findOne({ tur: 'kdv', yil, donem }))) {
        await BeyanDurum.create({ tur: 'kdv', yil, donem, sonGun: sonGunHesapla('kdv', yil, donem) });
        count++;
      }
    }
    for (const donem of ['G1', 'G2', 'G3']) {
      if (!(await BeyanDurum.findOne({ tur: 'geciciVergi', yil, donem }))) {
        await BeyanDurum.create({ tur: 'geciciVergi', yil, donem, sonGun: sonGunHesapla('geciciVergi', yil, donem) });
        count++;
      }
    }
    const muhtasarDonemleri = ['01', '02', '03', 'Q2', 'Q3', 'Q4'];
    for (const donem of muhtasarDonemleri) {
      if (!(await BeyanDurum.findOne({ tur: 'muhtasar', yil, donem }))) {
        await BeyanDurum.create({ tur: 'muhtasar', yil, donem, sonGun: sonGunHesapla('muhtasar', yil, donem) });
        count++;
      }
    }
    for (let ay = 1; ay <= 12; ay++) {
      const donem = String(ay).padStart(2, '0');
      if (!(await BeyanDurum.findOne({ tur: 'bagkur', yil, donem }))) {
        await BeyanDurum.create({ tur: 'bagkur', yil, donem, sonGun: sonGunHesapla('bagkur', yil, donem), bagkurPrimi: 7000 });
        count++;
      }
    }
    if (!(await BeyanDurum.findOne({ tur: 'gelirVergisi', yil, donem: 'YILLIK' }))) {
      await BeyanDurum.create({ tur: 'gelirVergisi', yil, donem: 'YILLIK', sonGun: sonGunHesapla('gelirVergisi', yil, 'YILLIK') });
      count++;
    }

    console.log('2026 Yılı Başlatıldı. Eklenen kayıt:', count);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
initYil();
