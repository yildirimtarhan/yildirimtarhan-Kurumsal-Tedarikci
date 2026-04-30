const xlsx = require('xlsx');
const path = require('path');

const files = ['1. AY GİDEN FATURALR.xlsx', '1. AYIN FATURALARI GELEN.xlsx'];

files.forEach(file => {
  try {
    const workbook = xlsx.readFile(path.join(__dirname, '../', file));
    console.log(`--- File: ${file} ---`);
    workbook.SheetNames.forEach(sheet => {
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);
      console.log(`Sheet: ${sheet}, Rows: ${data.length}`);
      if(data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
        console.log('Sample:', data[0]);
      }
    });
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
});
