// 📁 /services/erpService.js
const axios = require("axios");

// ERP API Base URL
const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://www.satistakip.online/api";

// ERP Auth Token (sabit token veya login ile alınan)
let erpToken = process.env.ERP_API_TOKEN || null;

// ERP'ye login olup token alma (eğer gerekirse)
async function loginToERP() {
  try {
    const response = await axios.post(`${ERP_BASE_URL}/auth/login`, {
      email: process.env.ERP_USER_EMAIL,
      password: process.env.ERP_USER_PASSWORD
    });
    
    erpToken = response.data.token;
    console.log("✅ ERP Login başarılı");
    return erpToken;
  } catch (err) {
    console.error("❌ ERP Login hatası:", err.message);
    throw err;
  }
}

// Axios instance with auth header
function getERPClient() {
  return axios.create({
    baseURL: ERP_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${erpToken}`
    }
  });
}

// ============================================
// CARİ (MÜŞTERİ) İŞLEMLERİ
// ============================================

/**
 * Yeni müşteriyi ERP'ye aktarır
 * @param {Object} userData - Kullanıcı bilgileri
 */
async function createCariInERP(userData) {
  try {
    const client = getERPClient();
    
    const cariData = {
      unvan: userData.firma || userData.ad, // Firma adı veya kişi adı
      ad: userData.ad,
      soyad: "", // Eğer varsa
      email: userData.email,
      telefon: userData.telefon || "",
      vergiNo: userData.vergiNo || "",
      vergiDairesi: userData.vergiDairesi || "",
      tcNo: userData.tcNo || "",
      adres: userData.faturaAdresi || userData.teslimatAdresi || "",
      il: userData.city || "İstanbul",
      ilce: userData.district || "",
      tip: userData.uyelikTipi === 'kurumsal' ? 'kurumsal' : 'bireysel'
    };

    const response = await client.post("/cari/create", cariData);
    
    console.log("✅ Cari ERP'ye aktarıldı:", response.data);
    return {
      success: true,
      cariId: response.data._id || response.data.id,
      data: response.data
    };
    
  } catch (err) {
    console.error("❌ Cari aktarım hatası:", err.response?.data || err.message);
    
    // Token expired ise tekrar login ol
    if (err.response?.status === 401) {
      await loginToERP();
      return createCariInERP(userData); // Retry
    }
    
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

/**
 * Email ile cari arama (var mı diye kontrol)
 */
async function findCariByEmail(email) {
  try {
    const client = getERPClient();
    const response = await client.get(`/cari?email=${email}`);
    return response.data;
  } catch (err) {
    return null;
  }
}

// ============================================
// SATIŞ (SİPARİŞ) İŞLEMLERİ
// ============================================

/**
 * Siparişi ERP'ye satış olarak aktarır
 * @param {Object} orderData - Sipariş bilgileri
 * @param {Object} userData - Müşteri bilgileri
 */
async function createSaleInERP(orderData, userData) {
  try {
    const client = getERPClient();
    
    // Önce cari ID bul veya oluştur
    let cariId = orderData.erpCariId;
    
    if (!cariId) {
      // Cari'yi bul veya oluştur
      const existingCari = await findCariByEmail(userData.email);
      
      if (existingCari && existingCari._id) {
        cariId = existingCari._id;
      } else {
        // Yeni cari oluştur
        const newCari = await createCariInERP(userData);
        if (newCari.success) {
          cariId = newCari.cariId;
        }
      }
    }
    
    if (!cariId) {
      throw new Error("Cari ID bulunamadı");
    }
    
    // Satış numarası oluştur (S-2024-0001 formatında)
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const saleNo = `S-${year}-${randomNum}`;
    
    // Satış verilerini hazırla
    const saleData = {
      accountId: cariId,
      saleNo: saleNo,
      date: orderData.createdAt || new Date(),
      currency: "TRY",
      fxRate: 1,
      paymentType: orderData.odemeYontemi === 'Kredi Kartı' ? 'card' : 
                   orderData.odemeYontemi === 'Havale/EFT' ? 'transfer' : 'open',
      note: `Web siparişi: ${orderData._id}`,
      items: orderData.items.map(item => ({
        name: item.ad || item.name,
        quantity: item.adet || item.qty || 1,
        unitPrice: item.fiyat || item.price || 0,
        vatRate: 20, // Varsayılan KDV
        barcode: item.barcode || "",
        sku: item.sku || ""
      }))
    };
    
    // Kısmi ödeme varsa ekle
    if (orderData.paymentStatus === 'paid') {
      saleData.partialPaymentTRY = orderData.toplam || orderData.total;
    }

    const response = await client.post("/transactions/create", saleData);
    
    console.log("✅ Satış ERP'ye aktarıldı:", response.data);
    return {
      success: true,
      saleNo: response.data.saleNo,
      transactionId: response.data.transactionId,
      data: response.data
    };
    
  } catch (err) {
    console.error("❌ Satış aktarım hatası:", err.response?.data || err.message);
    
    // Token expired ise tekrar login ol
    if (err.response?.status === 401) {
      await loginToERP();
      return createSaleInERP(orderData, userData); // Retry
    }
    
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  createCariInERP,
  createSaleInERP,
  findCariByEmail,
  loginToERP
};