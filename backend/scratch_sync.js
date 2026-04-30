const mongoose = require('mongoose');
const Fatura = require('./models/Fatura');
const CariHesap = require('./models/CariHesap');
const DefterKaydi = require('./models/DefterKaydi');
const TaxtenService = require('./services/taxtenService');
require('dotenv').config({ path: './.env' });

async function sync() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
    const taxtenService = new TaxtenService();
    const type = 'OUTBOUND';
    
    console.log('Fetching invoice list...');
    const result = await taxtenService.getInvoiceList(type, '2026-01-01', '2026-01-31');
    const invoices = Array.isArray(result.data) ? result.data : (result.data?.Items || result.data?.entity?.items || []);
    console.log('Invoices found:', invoices.length);

    for (const inv of invoices) {
      const uuid = inv.uuid || inv.UUID;
      console.log('Processing:', uuid);
      
      const detailRes = await taxtenService.getUBL(uuid, type);
      if (!detailRes.success) {
        console.log('UBL error:', detailRes.error);
        continue;
      }
      const data = taxtenService.parseUBL(detailRes.data, type);
      console.log('Parsed data:', data.faturaNo, data.tarih);
      
      // I'll just print, not insert to avoid double insertion if they already synced.
      // But they said NOT FOUND, so it's not inserted.
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
sync();
