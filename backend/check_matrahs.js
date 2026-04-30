const mongoose = require('mongoose');
const DefterKaydi = require('./models/DefterKaydi');
require('dotenv').config({ path: './.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
  const yil = 2026;
  const ay = 1;

  for (const oran of [20, 10, 1, 0]) {
    const gelir = await DefterKaydi.aggregate([
      { $match: { yil, ay, tip: 'gelir', kdvOrani: oran } },
      { $group: { _id: null, matrah: { $sum: '$kdvHaricTutar' } } }
    ]);
    const gider = await DefterKaydi.aggregate([
      { $match: { yil, ay, tip: 'gider', kdvOrani: oran } },
      { $group: { _id: null, matrah: { $sum: '$kdvHaricTutar' } } }
    ]);
    console.log(`Oran %${oran}: Gelir Matrah=${gelir[0]?.matrah || 0}, Gider Matrah=${gider[0]?.matrah || 0}`);
  }
  process.exit(0);
}
check();
