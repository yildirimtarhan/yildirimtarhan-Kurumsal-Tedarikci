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
      { name: '../2. AY GELEN FATURA.xlsx', type: 'INBOUND' },
      { name: '../2 AY GİDEN.xlsx', type: 'OUTBOUND' }
    ];

    for (const fileObj of files) {
      const workbook = xlsx.readFile(path.join(__dirname, fileObj.name));
      const data = xlsx.utils.sheet_to_json(workbook.Sheets['Invoices']);
      console.log(`Processing ${fileObj.name} (${data.length} rows)`);

      for (const row of data) {
        const isOut = fileObj.type === 'OUTBOUND';
        const unvan = isOut ? row['Alıcı Unvan'] : row['Gönderici Unvan'];
        const fNo = row['E-Fatura Numarası'];
        
        // Skip Kerem Gecer as requested
        if (unvan && String(unvan).toUpperCase().includes('KEREM')) {
           console.log(`Skipping cancelled invoice: ${unvan} (${fNo})`);
           continue;
        }

        const uuid = row['UUID'];
        const vkn = String(isOut ? row['Alıcı VKN/TCKN'] : row['Gönderici VKN/TCKN'] || '11111111111').trim();
        
        if (!row['Fatura Tarihi']) continue;

        // Parse date DD-MM-YYYY
        const parts = String(row['Fatura Tarihi']).split('-');
        if (parts.length < 3) continue;
        const [d, m, y] = parts;
        const tarih = new Date(y, m - 1, d);
        if (isNaN(tarih.getTime())) continue;

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
            malHizmet: 'Excel Import Feb',
            miktar: 1,
            birim: 'ADET',
            birimFiyat: row['Vergiler Hariç Toplam Tutar'],
            tutar: row['Vergiler Hariç Toplam Tutar'],
            kdvOrani: 20,
            kdvTutari: (row['KDV %1 Tutar'] || 0) + (row['KDV %10 Tutar'] || 0) + (row['KDV %20 Tutar'] || 0),
            toplamTutar: row['VERGİ DAHİL TOPLAM TUTAR']
          }]
        };

        await Fatura.findOneAndUpdate({ uuid: uuid }, faturaData, { upsert: true });

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
          donem: `${tarih.getFullYear()}-Q1`
        };

        await DefterKaydi.findOneAndUpdate({ faturaNo: fNo }, defterData, { upsert: true });
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
