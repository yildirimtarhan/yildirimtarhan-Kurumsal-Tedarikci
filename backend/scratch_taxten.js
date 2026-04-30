require('dotenv').config({ path: './.env' });
const TaxtenService = require('./services/taxtenService');

async function test() {
  const t = new TaxtenService();
  console.log('Taxten fetching INBOUND for 2026-01-01 to 2026-02-28');
  const res = await t.getInvoiceList('INBOUND', '2026-01-01', '2026-01-05');
  console.log('Success:', res.success);
  console.log('Data length:', res.data ? res.data.length : 'N/A');
  if(!res.success) {
    console.log('Error:', res.error);
  } else if (res.data && res.data.length > 0) {
    console.log('Sample invoice date:', res.data[0].IssueDate || res.data[0].tarih || 'No date field');
  }

  const resOut = await t.getInvoiceList('OUTBOUND', '2026-01-01', '2026-01-05');
  console.log('OUTBOUND Data length:', resOut.data ? resOut.data.length : 'N/A');
  if(resOut.error) console.log('OUTBOUND Error:', resOut.error);
}

test();
