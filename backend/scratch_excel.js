const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../../InboundInvoices_20260430141050.xlsx');
try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  
  console.log(`Read ${data.length} rows.`);
  if(data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('First row example:', data[0]);
  }
} catch (e) {
  console.error('Error reading excel:', e.message);
}
