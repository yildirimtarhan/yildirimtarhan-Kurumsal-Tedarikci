const mongoose = require('mongoose');
const BeyanDurum = require('./models/BeyanDurum');
require('dotenv').config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
    const records = await BeyanDurum.find({ tur: 'kdv', yil: 2026 }).sort({ donem: 1 });
    console.log('BeyanDurum KDV Records for 2026:');
    records.forEach(r => {
      console.log(`Dönem: ${r.donem}, Durum: ${r.durum}, DevredenKdvOnceki: ${r.devredenKdvOnceki}, DevredenKdv: ${r.devredenKdv}, OdenmesiGerekenKdv: ${r.odenmesiGerekenKdv}, HesaplananKdv: ${r.hesaplananKdv}, IndirilecekKdv: ${r.indirilecekKdv}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
