const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const Fatura = require('./models/Fatura');
const DefterKaydi = require('./models/DefterKaydi');
const CariHesap = require('./models/CariHesap');
require('dotenv').config({ path: './.env' });

async function importExcel() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
    console.log('Connected to DB');

    const files = [
      { name: '../1. AYIN FATURALARI GELEN.xlsx', type: 'INBOUND' },
      { name: '../1. AY GİDEN FATURALR.xlsx', type: 'OUTBOUND' }
    ];

    for (const fileObj of files) {
      const workbook = xlsx.readFile(path.join(__dirname, fileObj.name));
      const data = xlsx.utils.sheet_to_json(workbook.Sheets['Invoices']);
      console.log(`Processing ${fileObj.name} (${data.length} rows)`);

      for (const row of data) {
        const isOut = fileObj.type === 'OUTBOUND';
        const unvan = isOut ? row['Alıcı Unvan'] : row['Gönderici Unvan'];
        const fNo = row['E-Fatura Numarası'];
        const uuid = row['UUID'];
        const vkn = String(isOut ? row['Alıcı VKN/TCKN'] : row['Gönderici VKN/TCKN'] || '11111111111').trim();
        
        if (!row['Fatura Tarihi']) {
           console.log(`Skipping row due to missing Date: ${fNo}`);
           continue;
        }

        // Parse date DD-MM-YYYY
        const parts = String(row['Fatura Tarihi']).split('-');
        if (parts.length < 3) {
           console.log(`Skipping row due to invalid Date format: ${row['Fatura Tarihi']}`);
           continue;
        }
        const [d, m, y] = parts;
        const tarih = new Date(y, m - 1, d);
        if (isNaN(tarih.getTime())) {
           console.log(`Skipping row due to Invalid Date: ${row['Fatura Tarihi']}`);
           continue;
        }

        // Find/Create Cari
        let cari;
        try {
          cari = await CariHesap.findOne({ vknTckn: vkn });
          if (!cari) {
            cari = await CariHesap.create({
              firmaUnvan: unvan || 'Bilinmeyen Firma',
              vknTckn: vkn,
              bakiye: 0
            });
          }
        } catch (cariErr) {
          console.error(`Cari error for ${vkn}: ${cariErr.message}`);
          continue;
        }

        // Create Fatura
        const faturaData = {
          uuid: uuid,
          faturaNo: fNo,
          cariHesapId: cari._id,
          aliciVkn: isOut ? vkn : '34285822330',
          aliciUnvan: isOut ? unvan : 'Yıldırım Tarhan',
          faturaTarihi: tarih,
          toplamTutar: row['VERGİ DAHİL TOPLAM TUTAR'],
          matrah: row['Vergiler Hariç Toplam Tutar'],
          kdvTutari: (row['KDV %1 Tutar'] || 0) + (row['KDV %10 Tutar'] || 0) + (row['KDV %20 Tutar'] || 0),
          durum: '1300-BAŞARILI',
          faturaTipi: isOut ? 'SATIŞ' : 'ALIŞ',
          kalemler: [{
            malHizmet: 'Excel Import',
            miktar: 1,
            birim: 'ADET',
            birimFiyat: row['Vergiler Hariç Toplam Tutar'],
            tutar: row['Vergiler Hariç Toplam Tutar'],
            kdvOrani: 20, // Defaulting to 20 for simplicity
            kdvTutari: (row['KDV %1 Tutar'] || 0) + (row['KDV %10 Tutar'] || 0) + (row['KDV %20 Tutar'] || 0),
            toplamTutar: row['VERGİ DAHİL TOPLAM TUTAR']
          }]
        };

        try {
          await Fatura.findOneAndUpdate({ uuid: uuid }, faturaData, { upsert: true });
        } catch (e) {
          console.error(`Fatura error (${fNo}):`, e.message);
        }

        // Create DefterKaydi
        const defterData = {
          tip: isOut ? 'gelir' : 'gider',
          tarih: tarih,
          aciklama: `${unvan} - Fatura #${fNo}`,
          karsiTaraf: unvan,
          faturaNo: fNo,
          kategori: isOut ? 'Satış Geliri' : 'Genel Gider',
          kdvHaricTutar: row['Vergiler Hariç Toplam Tutar'],
          kdvOrani: 20,
          kdvTutari: (row['KDV %1 Tutar'] || 0) + (row['KDV %10 Tutar'] || 0) + (row['KDV %20 Tutar'] || 0),
          kdvDahilTutar: row['VERGİ DAHİL TOPLAM TUTAR'],
          yil: tarih.getFullYear(),
          ay: tarih.getMonth() + 1,
          donem: `${tarih.getFullYear()}-Q1` // Everything here is January, so Q1
        };

        try {
          await DefterKaydi.findOneAndUpdate({ faturaNo: fNo }, defterData, { upsert: true });
        } catch (e) {
          console.error(`Defter error (${fNo}):`, e.message);
        }
      }
    }
    console.log('Import completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

importExcel();
