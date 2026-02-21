// 📁 /services/erpService.js
const axios = require("axios");

const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://www.satistakip.online/api";

// Token saklama
let erpToken = null;

// ERP'ye login olup token al (HER ZAMAN İLK BAŞTA ÇAĞRILMALI)
async function loginToERP() {
  try {
    console.log("🔑 ERP Login başlatılıyor...");
    console.log("📧 Email:", process.env.ERP_USER_EMAIL);
    console.log("🔗 URL:", `${ERP_BASE_URL}/auth/login`);
    
    const response = await axios.post(`${ERP_BASE_URL}/auth/login`, {
      email: process.env.ERP_USER_EMAIL,
      password: process.env.ERP_USER_PASSWORD
    });
    
    erpToken = response.data.token;
    console.log("✅ ERP Login başarılı - Token alındı");
    console.log("📝 Token (ilk 50 karakter):", erpToken?.substring(0, 50) + "...");
    
    return erpToken;
    
  } catch (err) {
    console.error("❌ ERP Login hatası:");
    console.error("   Status:", err.response?.status);
    console.error("   Mesaj:", err.response?.data?.message || err.message);
    console.error("   URL:", `${ERP_BASE_URL}/auth/login`);
    throw err;
  }
}

// Token'ı kontrol et, yoksa login ol
async function ensureToken() {
  if (!erpToken) {
    console.log("🔄 Token bulunamadı, login olunuyor...");
    await loginToERP();
  } else {
    console.log("✅ Mevcut token kullanılıyor");
  }
  return erpToken;
}

// Axios instance with auth header
async function getERPClient() {
  const token = await ensureToken();
  
  return axios.create({
    baseURL: ERP_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    timeout: 15000 // 15 saniye timeout
  });
}

// ============================================
// CARİ (MÜŞTERİ) İŞLEMLERİ
// ============================================

async function createCariInERP(userData) {
  console.log("========== ERP CARİ OLUŞTURMA BAŞLADI ==========");
  console.log("📋 Kullanıcı:", userData.email);
  
  try {
    const client = await getERPClient();
    
    const cariData = {
      unvan: userData.firma || userData.ad,
      ad: userData.ad,
      soyad: "",
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

    console.log("📤 Gönderilen data:", JSON.stringify(cariData, null, 2));
    console.log("🌐 Endpoint:", `${ERP_BASE_URL}/cari/create`);

    const response = await client.post("/cari/create", cariData);
    
    console.log("✅ ERP Yanıt:", JSON.stringify(response.data, null, 2));
    console.log("========== ERP CARİ OLUŞTURMA BAŞARILI ==========");
    
    return {
      success: true,
      cariId: response.data._id || response.data.id || response.data.cariId,
      data: response.data
    };
    
  } catch (err) {
    console.error("❌ ERP Cari Hatası:");
    console.error("   HTTP Status:", err.response?.status);
    console.error("   Hata Mesajı:", err.response?.data?.message || err.message);
    console.error("   Hata Detayı:", JSON.stringify(err.response?.data, null, 2));
    
    // Token expired ise yenile ve tekrar dene
    if (err.response?.status === 401) {
      console.log("🔄 Token expired, yeniden login olunuyor...");
      erpToken = null; // Token'ı sıfırla
      await loginToERP();
      return createCariInERP(userData); // Retry
    }
    
    console.log("========== ERP CARİ OLUŞTURMA BAŞARISIZ ==========");
    return {
      success: false,
      error: err.response?.data?.message || err.message,
      status: err.response?.status
    };
  }
}

// ============================================
// SATIŞ (SİPARİŞ) İŞLEMLERİ
// ============================================

async function createSaleInERP(orderData, userData) {
  console.log("========== ERP SATIŞ OLUŞTURMA BAŞLADI ==========");
  
  try {
    const client = await getERPClient();
    
    // Cari ID bul veya oluştur
    let cariId = userData.erpCariId;
    
    if (!cariId) {
      console.log("🔍 Cari ID bulunamadı, yeni cari oluşturuluyor...");
      const newCari = await createCariInERP(userData);
      if (newCari.success) {
        cariId = newCari.cariId;
        console.log("✅ Yeni cari oluşturuldu:", cariId);
      } else {
        throw new Error("Cari oluşturulamadı: " + newCari.error);
      }
    }
    
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const saleNo = `WEB-${year}-${randomNum}`;
    
    const saleData = {
      accountId: cariId,
      saleNo: saleNo,
      date: new Date().toISOString(),
      currency: "TRY",
      fxRate: 1,
      paymentType: orderData.odemeYontemi === 'Kredi Kartı' ? 'card' : 
                   orderData.odemeYontemi === 'Havale/EFT' ? 'transfer' : 'open',
      note: `Web siparişi: ${orderData._id}`,
      items: orderData.items.map(item => ({
        name: item.ad || item.name,
        quantity: parseInt(item.adet || item.qty || 1),
        unitPrice: parseFloat(item.fiyat || item.price || 0),
        vatRate: 20,
        barcode: item.barcode || "",
        sku: item.sku || ""
      }))
    };

    console.log("📤 Satış data:", JSON.stringify(saleData, null, 2));

    const response = await client.post("/transactions/create", saleData);
    
    console.log("✅ Satış ERP'ye aktarıldı:", response.data);
    console.log("========== ERP SATIŞ OLUŞTURMA BAŞARILI ==========");
    
    return {
      success: true,
      saleNo: response.data.saleNo || saleNo,
      transactionId: response.data._id || response.data.id,
      data: response.data
    };
    
  } catch (err) {
    console.error("❌ ERP Satış Hatası:", err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      console.log("🔄 Token expired, retry...");
      erpToken = null;
      await loginToERP();
      return createSaleInERP(orderData, userData);
    }
    
    console.log("========== ERP SATIŞ OLUŞTURMA BAŞARISIZ ==========");
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

async function findCariByEmail(email) {
  try {
    const client = await getERPClient();
    const response = await client.get(`/cari?email=${encodeURIComponent(email)}`);
    return response.data;
  } catch (err) {
    console.log("Cari arama hatası:", err.message);
    return null;
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