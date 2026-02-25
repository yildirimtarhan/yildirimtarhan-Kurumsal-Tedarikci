// 📁 /services/ublGenerator.js
const { randomUUID } = require('crypto'); // Node.js native crypto modülü

/**
 * UBL (Universal Business Language) XML formatında e-fatura oluşturur
 * @param {Object} invoiceData - Fatura verileri
 * @returns {String} XML formatında fatura
 */
function generateUBL(invoiceData) {
  const {
    faturaNo,
    tarih,
    musteri,
    urunler,
    araToplam,
    kdvOrani = 20,
    kdvTutari,
    genelToplam,
    paraBirimi = 'TRY',
    notlar
  } = invoiceData;

  const uuid = randomUUID(); // Native crypto kullanımı
  const issueDate = tarih ? new Date(tarih).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const issueTime = new Date().toTimeString().split(' ')[0];

  // Toplam miktar hesapla
  const toplamMiktar = urunler.reduce((sum, urun) => sum + (parseFloat(urun.miktar) || 0), 0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  
  <!-- Fatura Başlık Bilgileri -->
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>TEMELFATURA</cbc:ProfileID>
  <cbc:ID>${faturaNo}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${paraBirimi}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${urunler.length}</cbc:LineCountNumeric>
  
  <!-- Notlar -->
  ${notlar ? `<cbc:Note>${escapeXml(notlar)}</cbc:Note>` : ''}
  
  <!-- Sipariş Bilgileri -->
  <cac:OrderReference>
    <cbc:ID>${faturaNo}</cbc:ID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  </cac:OrderReference>
  
  <!-- Satıcı Bilgileri (Tedarikçi) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">${process.env.COMPANY_VKN || '1234567890'}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(process.env.COMPANY_NAME || 'Şirket Adı')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(process.env.COMPANY_ADDRESS || 'Adres')}</cbc:StreetName>
        <cbc:CitySubdivisionName>${escapeXml(process.env.COMPANY_DISTRICT || 'İlçe')}</cbc:CitySubdivisionName>
        <cbc:CityName>${escapeXml(process.env.COMPANY_CITY || 'İl')}</cbc:CityName>
        <cbc:Country>
          <cbc:Name>Türkiye</cbc:Name>
        </cbc:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:Name>${escapeXml(process.env.COMPANY_TAX_OFFICE || 'Vergi Dairesi')}</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:Contact>
        <cbc:Telephone>${process.env.COMPANY_PHONE || ''}</cbc:Telephone>
        <cbc:ElectronicMail>${process.env.COMPANY_EMAIL || ''}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  
  <!-- Alıcı Bilgileri (Müşteri) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${musteri.tcNo ? 'TCKN' : 'VKN'}">${musteri.tcNo || musteri.vkn || '11111111111'}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(musteri.unvan || musteri.ad + ' ' + musteri.soyad)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(musteri.adres || '')}</cbc:StreetName>
        <cbc:CitySubdivisionName>${escapeXml(musteri.ilce || '')}</cbc:CitySubdivisionName>
        <cbc:CityName>${escapeXml(musteri.il || '')}</cbc:CityName>
        <cbc:Country>
          <cbc:Name>Türkiye</cbc:Name>
        </cbc:Country>
      </cac:PostalAddress>
      ${musteri.vergiDairesi ? `
      <cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:Name>${escapeXml(musteri.vergiDairesi)}</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      ` : ''}
      <cac:Contact>
        <cbc:Telephone>${musteri.telefon || ''}</cbc:Telephone>
        <cbc:ElectronicMail>${musteri.email || ''}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
  
  <!-- Ödeme Koşulları -->
  <cac:PaymentTerms>
    <cbc:Note>Peşin</cbc:Note>
    <cbc:PaymentDueDate>${issueDate}</cbc:PaymentDueDate>
  </cac:PaymentTerms>
  
  <!-- Toplam Tutarlar -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${paraBirimi}">${formatMoney(araToplam)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${paraBirimi}">${formatMoney(araToplam)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${paraBirimi}">${formatMoney(genelToplam)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${paraBirimi}">${formatMoney(genelToplam)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  
  <!-- KDV Bilgisi -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${paraBirimi}">${formatMoney(kdvTutari)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${paraBirimi}">${formatMoney(araToplam)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${paraBirimi}">${formatMoney(kdvTutari)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${kdvOrani}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:Name>KDV</cbc:Name>
          <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  
  <!-- Fatura Kalemleri -->
  ${urunler.map((urun, index) => `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${urun.birim || 'C62'}">${formatMoney(urun.miktar)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${paraBirimi}">${formatMoney(urun.toplamFiyat || urun.birimFiyat * urun.miktar)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${escapeXml(urun.adi)}</cbc:Name>
      <cac:SellersItemIdentification>
        <cbc:ID>${urun.kodu || urun._id || index + 1}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${paraBirimi}">${formatMoney(urun.birimFiyat)}</cbc:PriceAmount>
    </cac:Price>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${paraBirimi}">${formatMoney((urun.toplamFiyat || urun.birimFiyat * urun.miktar) * kdvOrani / 100)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${paraBirimi}">${formatMoney(urun.toplamFiyat || urun.birimFiyat * urun.miktar)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${paraBirimi}">${formatMoney((urun.toplamFiyat || urun.birimFiyat * urun.miktar) * kdvOrani / 100)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${kdvOrani}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:Name>KDV</cbc:Name>
            <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
  </cac:InvoiceLine>
  `).join('')}
  
</Invoice>`;

  return xml.trim();
}

/**
 * XML için özel karakterleri escape et
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Para formatını düzenle (2 ondalık)
 */
function formatMoney(amount) {
  return parseFloat(amount || 0).toFixed(2);
}

/**
 * XML validasyonu (basit kontrol)
 */
function validateUBL(xml) {
  const requiredFields = [
    'cbc:ID',
    'cbc:UUID',
    'cbc:IssueDate',
    'cac:AccountingSupplierParty',
    'cac:AccountingCustomerParty',
    'cac:LegalMonetaryTotal'
  ];
  
  const missing = requiredFields.filter(field => !xml.includes(`<${field}>`));
  
  return {
    valid: missing.length === 0,
    missing: missing
  };
}

module.exports = {
  generateUBL,
  validateUBL,
  escapeXml,
  formatMoney
};