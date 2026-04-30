const mongoose = require('mongoose');
const DefterKaydi = require('./models/DefterKaydi');
require('dotenv').config({ path: './.env' });

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
  const yil = 2026;
  const ay = 1;
  const tip = 'gelir';
  const kdvOrani = 20;

  const agg = await DefterKaydi.aggregate([
    { $match: { yil, ay, tip, kdvOrani } }
  ]);
  console.log('Agg Result:', JSON.stringify(agg, null, 2));

  const totalGelir = await DefterKaydi.aggregate([
    { $match: { yil, ay, tip: 'gelir' } },
    { $group: { _id: null, total: { $sum: '$kdvHaricTutar' } } }
  ]);
  console.log('Total Gelir:', JSON.stringify(totalGelir, null, 2));

  const totalGider = await DefterKaydi.aggregate([
    { $match: { yil, ay, tip: 'gider' } },
    { $group: { _id: null, total: { $sum: '$kdvHaricTutar' } } }
  ]);
  console.log('Total Gider:', JSON.stringify(totalGider, null, 2));

  process.exit(0);
}
test();
