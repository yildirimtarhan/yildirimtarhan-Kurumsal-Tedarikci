const mongoose = require('mongoose');
const DefterKaydi = require('./models/DefterKaydi');
const BeyanDurum = require('./models/BeyanDurum');
require('dotenv').config({ path: './.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
  const yil = 2026;
  const aylar = [1, 2];

  for (const ay of aylar) {
    const donem = String(ay).padStart(2, '0');
    console.log(`Processing ${yil}-${donem}...`);

    // Calculate
    const oranlar = [20, 10, 1, 0];
    const matrahlar = {};
    const kdvler = {};

    for (const oran of oranlar) {
      const gelirAgg = await DefterKaydi.aggregate([
        { $match: { yil, ay, tip: 'gelir', kdvOrani: oran } },
        { $group: { _id: null, matrahi: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' } } }
      ]);
      matrahlar[`gelir_${oran}`] = gelirAgg[0]?.matrahi || 0;
      kdvler[`hesaplanan_${oran}`] = gelirAgg[0]?.kdv || 0;

      const giderAgg = await DefterKaydi.aggregate([
        { $match: { yil, ay, tip: 'gider', kdvOrani: oran } },
        { $group: { _id: null, matrahi: { $sum: '$kdvHaricTutar' }, kdv: { $sum: '$kdvTutari' } } }
      ]);
      matrahlar[`gider_${oran}`] = giderAgg[0]?.matrahi || 0;
      kdvler[`indirilecek_${oran}`] = giderAgg[0]?.kdv || 0;
    }

    const hesaplananKdv = oranlar.reduce((s, o) => s + (kdvler[`hesaplanan_${o}`] || 0), 0);
    const indirilecekKdv = oranlar.reduce((s, o) => s + (kdvler[`indirilecek_${o}`] || 0), 0);

    // Get previous month devreden
    let devredenOnceki = 0;
    if (ay > 1) {
      const prev = await BeyanDurum.findOne({ tur: 'kdv', yil, donem: String(ay - 1).padStart(2, '0') });
      devredenOnceki = prev?.devredenKdv || 0;
    }

    const toplamIndirilecek = indirilecekKdv + devredenOnceki;
    let odenmesiGereken = 0;
    let devredenSonraki = 0;

    if (toplamIndirilecek > hesaplananKdv) {
      devredenSonraki = toplamIndirilecek - hesaplananKdv;
    } else {
      odenmesiGereken = hesaplananKdv - toplamIndirilecek;
    }

    // Update BeyanDurum
    await BeyanDurum.findOneAndUpdate(
      { tur: 'kdv', yil, donem },
      {
        matrah_20: matrahlar.gelir_20,
        matrah_10: matrahlar.gelir_10,
        matrah_01: matrahlar.gelir_1,
        matrah_00: matrahlar.gelir_0,
        hesaplananKdv,
        indirilecekKdv,
        devredenKdvOnceki: devredenOnceki,
        odenmesiGerekenKdv: odenmesiGereken,
        devredenKdv: devredenSonraki,
        updatedAt: new Date()
      }
    );
    console.log(`Saved ${yil}-${donem}: Devreden ${devredenSonraki}, Odenecek ${odenmesiGereken}`);
  }

  process.exit(0);
}
run();
