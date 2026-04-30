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
    
    for(const type of ['INBOUND', 'OUTBOUND']) {
      const result = await taxtenService.getInvoiceList(type, '2026-01-01', '2026-01-31');
      if (!result.success) continue;
      
      const invoices = result.data?.Items || result.data || [];
      console.log(`[${type}] Found ${invoices.length} invoices`);
      
      for (const inv of invoices) {
        const uuid = inv.uuid || inv.UUID;
        try {
          const detailRes = await taxtenService.getUBL(uuid, type);
          if (!detailRes.success) {
            console.log(`Error pulling UBL for ${uuid}:`, detailRes.error);
            continue;
          }
          const data = taxtenService.parseUBL(detailRes.data, type);
          const faturaData = {
            uuid: uuid,
            faturaNo: data.faturaNo || inv.id || inv.ID,
            aliciVkn: type === 'OUTBOUND' ? data.vkn : '34285822330', 
            aliciUnvan: type === 'OUTBOUND' ? data.unvan : 'Yıldırım Tarhan',
            faturaTarihi: data.tarih ? new Date(data.tarih) : new Date(),
            toplamTutar: data.tutar || 0,
            matrah: (data.tutar || 0) - (data.kdv || 0),
            kdvTutari: data.kdv || 0,
            kalemler: data.kalemler || [],
            durum: '1300-BAŞARILI',
            faturaTipi: type === 'OUTBOUND' ? 'SATIŞ' : 'ALIŞ'
          };
          
          const f = new Fatura(faturaData);
          const validationError = f.validateSync();
          if (validationError) {
             console.log(`Validation Error for ${uuid}:`, validationError.message);
          } else {
             console.log(`Valid for ${uuid}:`, data.tarih, data.faturaNo);
          }
        } catch (e) {
          console.log(`Exception for ${uuid}:`, e.message);
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
sync();
