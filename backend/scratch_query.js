const mongoose = require('mongoose');
const DefterKaydi = require('./models/DefterKaydi');
const Fatura = require('./models/Fatura');
require('dotenv').config({ path: './.env' });

async function query() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
    
    const d1 = await DefterKaydi.find({ yil: 2026, ay: 1 });
    const d2 = await DefterKaydi.find({ yil: 2026, ay: 2 });
    
    console.log('1. Ay Defter Kaydı Sayısı:', d1.length);
    console.log('2. Ay Defter Kaydı Sayısı:', d2.length);

    const f1 = await Fatura.find({ faturaTarihi: { $gte: new Date('2026-01-01'), $lte: new Date('2026-01-31T23:59:59') } });
    const f2 = await Fatura.find({ faturaTarihi: { $gte: new Date('2026-02-01'), $lte: new Date('2026-02-28T23:59:59') } });

    console.log('1. Ay Fatura Sayısı:', f1.length);
    console.log('2. Ay Fatura Sayısı:', f2.length);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
query();
