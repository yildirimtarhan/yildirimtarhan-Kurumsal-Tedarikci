/**
 * Benzersiz 13 haneli barkod üretir (EAN-13 uyumlu format).
 * Ön ek 8 = şirket içi kullanım için ayrılmış aralık.
 */
function generateBarcode() {
  const t = String(Date.now()).slice(-8);
  const r = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const raw12 = '8' + t + r;
  const digits = raw12.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + (i % 2 === 0 ? d : d * 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return raw12 + check;
}

/**
 * Verilen modelde bu barkod daha önce kullanılmış mı kontrol eder.
 * Çakışma olursa yeni barkod üretir (max 5 deneme).
 */
async function generateUniqueBarcode(Model, barcodeField = 'barcode') {
  for (let i = 0; i < 5; i++) {
    const code = generateBarcode();
    const exists = await Model.findOne({ [barcodeField]: code });
    if (!exists) return code;
  }
  return generateBarcode() + String(Date.now()).slice(-1);
}

module.exports = { generateBarcode, generateUniqueBarcode };
