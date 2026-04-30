const mongoose = require('mongoose');
const DefterKaydi = require('./models/DefterKaydi');
require('dotenv').config({ path: './.env' });

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
  const records = await DefterKaydi.find({ yil: 2026, ay: { $in: [1, 2] } });
  console.log(`Checking ${records.length} records...`);

  for (const r of records) {
    // If it's a gider and has KDV, try to guess the rate
    if (r.kdvTutari > 0 && r.kdvHaricTutar > 0) {
      const calculatedRate = Math.round((r.kdvTutari / r.kdvHaricTutar) * 100);
      let targetRate = 20;
      if (calculatedRate <= 2) targetRate = 1;
      else if (calculatedRate <= 12) targetRate = 10;
      else targetRate = 20;

      if (r.kdvOrani !== targetRate) {
        r.kdvOrani = targetRate;
        await r.save();
        console.log(`Updated ${r.faturaNo} to %${targetRate}`);
      }
    }
  }
  console.log('Fix completed.');
  process.exit(0);
}
fix();
