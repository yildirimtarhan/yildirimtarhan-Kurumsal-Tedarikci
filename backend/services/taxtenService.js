const axios = require('axios');
const AdmZip = require('adm-zip');
const UBLGenerator = require('./ublGenerator');

class TaxtenService {
  constructor() {
    this.baseURL = process.env.TAXTEN_ENV === 'production' 
      ? 'https://rest.taxten.com/api/v1'
      : 'https://devrest.taxten.com/api/v1';
    
    this.auth = {
      username: process.env.TAXTEN_USERNAME,
      password: process.env.TAXTEN_PASSWORD
    };
    
    this.vkn = process.env.TAXTEN_VKN;
    this.gbEtiket = process.env.TAXTEN_GB_ETIKET;
    
    this.ublGenerator = new UBLGenerator();
  }
  
  async sendInvoice(faturaData, gondericiBilgileri) {
    try {
      const { xml, uuid } = await this.ublGenerator.generateInvoice(
        faturaData, 
        gondericiBilgileri
      );
      
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
      console.error('Taxten fatura gönderim hatası:', error);
      return {
        success: false,
        error: error.response?.data || error.message,
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
      const params = {
        Version: '1',
        Identifier: this.gbEtiket,
        VKN_TCKN: this.vkn,
        DocType: 'INVOICE',
        Type: type,
        Page: 1,
        PageSize: 100
      };
      
      if (startDate && endDate) {
        params.StartDate = startDate;
        params.EndDate = endDate;
      }
      
      const response = await axios.get(
        `${this.baseURL}/Invoice/getUBLList`,
        {
          auth: this.auth,
          params: params,
          timeout: 60000
        }
      );
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Taxten liste alma hatası:', error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
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