const axios = require('axios');
const AdmZip = require('adm-zip');
const UBLGenerator = require('./ublGenerator');

class TaxtenService {
  constructor() {
    const isProd = process.env.TAXTEN_ENV === 'production';
    this.baseURL = isProd 
      ? 'https://rest.taxten.com/api/v1'
      : 'https://devrest.taxten.com/api/v1';
    
    // Test ortamı: TAXTEN_TEST_CLIENT_ID + TAXTEN_TEST_API_KEY kullan
    this.auth = {
      username: process.env.TAXTEN_USERNAME || process.env.TAXTEN_TEST_CLIENT_ID,
      password: process.env.TAXTEN_PASSWORD || process.env.TAXTEN_TEST_API_KEY
    };
    
    this.vkn = process.env.TAXTEN_VKN || process.env.TAXTEN_TEST_CLIENT_ID;
    this.gbEtiket = process.env.TAXTEN_GB_ETIKET || process.env.TAXTEN_TEST_CLIENT_ID;
    this.pkEtiket = process.env.TAXTEN_PK_ETIKET || this.gbEtiket.replace('gb@', 'pk@'); // PK etiketi genellikle gb@ yerine pk@ içerir
    
    if (!this.auth.username || !this.auth.password) {
      console.warn('[Taxten] UYARI: TAXTEN_USERNAME/PASSWORD veya TAXTEN_TEST_CLIENT_ID/TAXTEN_TEST_API_KEY tanımlı değil!');
    }
    if (!this.vkn || !this.gbEtiket) {
      console.warn('[Taxten] UYARI: TAXTEN_VKN ve TAXTEN_GB_ETIKET gerekli. Test için TAXTEN_TEST_CLIENT_ID kullanılıyor.');
    }
    
    this.ublGenerator = new UBLGenerator();
  }

  /**
   * Tarihi Taxten'in istediği formatta döndürür: 2024-04-01T00:00:00.00+03:00
   */
  formatTaxtenDate(date, isEnd = false) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const time = isEnd ? '23:59:59.00' : '00:00:00.00';
    return `${year}-${month}-${day}T${time}+03:00`;
  }
  
  async sendInvoice(faturaData, gondericiBilgileri) {
    let uuid;
    try {
      const result = await this.ublGenerator.generateInvoice(faturaData, gondericiBilgileri);
      const xml = result.xml;
      uuid = result.uuid;
      
      const zip = new AdmZip();
      zip.addFile(`${uuid}.xml`, Buffer.from(xml, 'utf-8'));
      const zipBuffer = zip.toBuffer();
      
      const docData = zipBuffer.toString('base64');
      
      const payload = {
        VKN_TCKN: this.vkn,
        DocType: 'INVOICE',
        SenderIdentifier: this.gbEtiket,
        ReceiverIdentifier: faturaData.aliciEtiket || '',
        DocData: docData,
        Parameters: []
      };
      
      const response = await axios.post(
        `${this.baseURL}/Invoice/SendUbl`,
        payload,
        {
          auth: this.auth,
          headers: { 'Content-Type': 'application/json' },
          timeout: 300000
        }
      );
      
      return {
        success: true,
        data: response.data,
        uuid: uuid,
        envUUID: response.data.EnvUUID,
        faturaId: response.data.ID,
        custInvId: response.data.CustInvID
      };
      
    } catch (error) {
      const errData = error.response?.data;
      const errMsg = typeof errData === 'object' 
        ? (errData.Message || errData.message || JSON.stringify(errData))
        : (errData || error.message);
      console.error('Taxten fatura gönderim hatası:', errMsg, error.response?.status);
      return {
        success: false,
        error: errData || error.message,
        errorMessage: errMsg,
        uuid: uuid
      };
    }
  }
  
  async getInvoiceStatus(envUUID, faturaUUID) {
    try {
      const payload = {
        VKN_TCKN: this.vkn,
        Identifier: this.gbEtiket,
        UUID: [faturaUUID],
        Parameters: []
      };
      
      const response = await axios.post(
        `${this.baseURL}/Invoice/getInvoiceStatus`,
        payload,
        {
          auth: this.auth,
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Taxten durum sorgu hatası:', error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
  
  async getInvoiceList(type = 'OUTBOUND', startDate, endDate) {
    try {
      // Taxten 1 günlük aralık sınırı olduğu için tarihleri günlere bölüyoruz (+03:00 formatı ile)
      const start = new Date(startDate || new Date().toISOString().split('T')[0]);
      const end = new Date(endDate || new Date().toISOString().split('T')[0]);
      const allInvoices = [];

      // Gün gün döngü
      let current = new Date(start);
      // Karşılaştırma için zamanı sıfırlıyoruz (GMT bazlı)
      current.setUTCHours(0, 0, 0, 0);
      const endUTC = new Date(end);
      endUTC.setUTCHours(0, 0, 0, 0);

      while (current <= endUTC) {
        const fromDateStr = this.formatTaxtenDate(current, false);
        const toDateStr = this.formatTaxtenDate(current, true);

        // Döküman ve Portal Görüntüsü: 
        // GİDEN (OUTBOUND) için GÖNDERİCİ BİRİM (GB) etiketi, 
        // GELEN (INBOUND) için ALICI BİRİM (PK) etiketi kullanılmalıdır.
        const queryParams = {
          Version: '1',
          Identifier: type === 'OUTBOUND' ? this.gbEtiket : this.pkEtiket,
          VKN_TCKN: this.vkn,
          DocType: 'INVOICE',
          Type: type,
          StartDate: fromDateStr,
          EndDate: toDateStr,
          Page: 1,
          PageSize: 100
        };

        console.log(`[Taxten DEBUG] ${type} İsteği Atılıyor (POST):`, queryParams);

        const response = await axios.post(
          `${this.baseURL}/Invoice/getUBLList`,
          queryParams,
          {
            auth: this.auth,
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
          }
        );

        console.log(`[Taxten DEBUG] ${type} Cevap:`, JSON.stringify(response.data).substring(0, 500));

        // Taxten yanıtı: response.data.entity.items veya doğrudan dizi olabilir
        let dayInvoices = [];
        if (response.data) {
          if (Array.isArray(response.data)) {
            dayInvoices = response.data;
          } else if (response.data.entity && Array.isArray(response.data.entity.items)) {
            dayInvoices = response.data.entity.items;
          } else if (Array.isArray(response.data.Items)) {
            dayInvoices = response.data.Items;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            dayInvoices = response.data.data;
          } else if (response.data.entity && Array.isArray(response.data.entity)) {
            dayInvoices = response.data.entity;
          }
        }
        
        allInvoices.push(...dayInvoices);

        // Bir sonraki güne geç (1 gün = 86400000 ms)
        current.setDate(current.getDate() + 1);
      }
      
      return {
        success: true,
        data: allInvoices
      };
      
    } catch (error) {
      console.error('Taxten liste alma hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
  
  async getUBL(uuid, type = 'INBOUND') {
    try {
      const params = {
        Version: '1',
        Identifier: type === 'OUTBOUND' ? this.pkEtiket : this.gbEtiket,
        VKN_TCKN: this.vkn,
        UUID: [uuid],
        DocType: 'INVOICE',
        Type: type,
        IsZip: false
      };

      const response = await axios.post(
        `${this.baseURL}/Invoice/getUBL`,
        params,
        {
          auth: this.auth,
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      let docDataArray = null;
      if (response.data) {
        // Hem büyük hem küçük harf ihtimallerini kontrol et
        const entity = response.data.entity || {};
        docDataArray = entity.DocData || entity.docData || response.data.DocData || response.data.docData;
      }

      if (docDataArray && docDataArray.length > 0) {
        const base64Data = docDataArray[0];
        const xmlContent = Buffer.from(base64Data, 'base64').toString('utf8');
        console.log(`[Taxten DEBUG] XML başarıyla çekildi (${uuid})`);
        return { success: true, data: xmlContent };
      }

      console.error(`[Taxten ERROR] XML verisi bulunamadı (${uuid}). Cevap Yapısı:`, JSON.stringify(response.data).substring(0, 200));
      return { success: false, error: 'XML verisi bulunamadı' };
    } catch (error) {
      console.error('Taxten getUBL hatası:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  parseUBL(xml, type = 'INBOUND') {
    const extract = (regex) => {
      const match = xml.match(regex);
      return match ? match[1] : null;
    };

    const clean = (str) => str ? str.trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : null;

    // Tip'e göre karşı tarafın etiketini belirle
    const partyPrefix = type === 'OUTBOUND' ? 'Customer' : 'Supplier';
    const partyRegex = new RegExp(`<[\\w:]*?Accounting${partyPrefix}Party[^>]*?>([\\s\\S]*?)<\/[\\w:]*?Accounting${partyPrefix}Party>`, 'i');
    const partyXml = extract(partyRegex) || "";

    const name = clean(
      partyXml.match(/<[\w:]*?Name>(.*?)<\/[\w:]*?Name>/i)?.[1] || 
      partyXml.match(/<[\w:]*?RegistrationName>(.*?)<\/[\w:]*?RegistrationName>/i)?.[1]
    );

    const vkn = (
      partyXml.match(/<[\w:]*?ID.*?schemeID="(?:VKN|TCKN)".*?>(.*?)<\/[\w:]*?ID>/i)?.[1] ||
      partyXml.match(/<[\w:]*?ID[^>]*?>(.*?)<\/[\w:]*?ID>/i)?.[1] // Fallback
    );

    return {
      faturaNo: extract(/<cbc:ID[^>]*?>(.*?)<\/cbc:ID>/i) || extract(/<ID[^>]*?>(.*?)<\/ID>/i),
      tarih: extract(/<[\w:]*?IssueDate.*?>(.*?)<\/[\w:]*?IssueDate>/),
      tutar: parseFloat(extract(/<[\w:]*?PayableAmount.*?>(.*?)<\/[\w:]*?PayableAmount>/) || 0),
      kdv: parseFloat(extract(/<[\w:]*?TaxAmount.*?>(.*?)<\/[\w:]*?TaxAmount>/) || 0),
      unvan: name || 'Bilinmeyen Cari',
      vkn: vkn ? vkn.trim() : '00000000000'
    };
  }

  async getInvoiceView(uuid, type = 'OUTBOUND', docType = 'PDF') {
    try {
      const payload = {
        UUID: uuid,
        Identifier: this.gbEtiket,
        VKN_TCKN: this.vkn,
        Type: type,
        DocType: docType
      };
      
      const response = await axios.post(
        `${this.baseURL}/Invoice/getInvoiceView`,
        payload,
        {
          auth: this.auth,
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Taxten görüntü alma hatası:', error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
  
  getStatusDescription(code) {
    const kodlar = {
      '1000': 'İşleniyor',
      '1100': 'GİB\'e gönderildi, yanıt bekleniyor',
      '1150': 'Hata - Zarf işlenemedi',
      '1160': 'Hata - Gönderici etiket hatası',
      '1163': 'Hata - Alıcı etiket hatası',
      '1171': 'Hata - Şema validasyon hatası',
      '1172': 'Hata - Şematron hatası',
      '1176': 'Hata - İmza hatası',
      '1195': 'Hata - Tekrar gönderim hatası',
      '1200': 'Başarılı - Karşı tarafa iletildi',
      '1210': 'Başarılı - Sistem yanıtı bekleniyor',
      '1215': 'Hata - Zarf reddedildi',
      '1220': 'Başarılı - İşlem tamamlandı',
      '1230': 'Hata - Zarf reddedildi (geçersiz)',
      '1300': 'Başarılı - Karşı taraf başarıyla aldı'
    };
    return kodlar[code] || `Bilinmeyen kod: ${code}`;
  }
}

module.exports = TaxtenService;