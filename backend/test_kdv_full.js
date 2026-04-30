const mongoose = require('mongoose');
const DefterKaydi = require('./models/DefterKaydi');
require('dotenv').config({ path: './.env' });

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
  const yil = "2026";
  const donem = "01";
  const ay = parseInt(donem, 10);

  const oranlar = [20, 10, 1, 0];
  const matrahlar = {};
  const kdvler = {};

  for (const oran of oranlar) {
    const gelirAgg = await DefterKaydi.aggregate([
      { $match: { yil: parseInt(yil), ay, tip: 'gelir', kdvOrani: oran } },
      { $group: { _id: null, matrahi: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' } } }
    ]);
    matrahlar[`gelir_${oran}`] = gelirAgg[0]?.matrahi || 0;
    kdvler[`hesaplanan_${oran}`] = gelirAgg[0]?.kdv || 0;

    const giderAgg = await DefterKaydi.aggregate([
      { $match: { yil: parseInt(yil), ay, tip: 'gider', kdvOrani: oran } },
      { $group: { _id: null, matrahi: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' } } }
    ]);
    matrahlar[`gider_${oran}`] = giderAgg[0]?.matrahi || 0;
    kdvler[`indirilecek_${oran}`] = giderAgg[0]?.kdv || 0;
  }

  console.log('Matrahlar:', JSON.stringify(matrahlar, null, 2));
  console.log('Kdvler:', JSON.stringify(kdvler, null, 2));
  process.exit(0);
}
test();
