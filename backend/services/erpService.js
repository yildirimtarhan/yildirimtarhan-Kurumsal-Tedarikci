// 📁 /services/erpService.js
const axios = require("axios");

// YENİ API: satistakip.online
const ERP_API_URL = process.env.ERP_API_URL || "https://satistakip.online/api/integration/sales";
const ERP_API_KEY = process.env.ERP_API_KEY; // SADECE env'den al, fallback YOK

/**
 * Siparişi ERP'ye gönder (YENİ API)
 * @param {Object} orderData - Sipariş bilgileri
 * @param {Object} userData - Kullanıcı bilgileri
 * @returns {Object} ERP yanıtı
 */
async function sendOrderToERP(orderData, userData) {
  console.log("========== ERP SİPARİŞ GÖNDERME BAŞLADI ==========");
  console.log("📋 Sipariş ID:", orderData._id);
  console.log("👤 Müşteri:", userData.email);

  try {
    // API formatına dönüştür
    const erpPayload = {
      customer: {
        ad: userData.ad?.split(' ')[0] || userData.ad || '',
        soyad: userData.ad?.split(' ').slice(1).join(' ') || '',
        email: userData.email,
        phone: userData.telefon || '',
        adres: userData.faturaAdresi?.acikAdres || 
               userData.faturaAdresi || 
               userData.teslimatAdresi?.acikAdres || 
               userData.teslimatAdresi || ''
      },
      items: orderData.items.map(item => ({
        code: item.ad?.substring(0, 20).replace(/\s+/g, '-') || 'URUN',
        quantity: parseInt(item.adet || 1),
        unitPrice: parseFloat(item.fiyat || 0)
      })),
      payment: {
        method: getPaymentMethod(orderData.paymentMethod),
        status: getPaymentStatus(orderData.paymentMethod)
      }
    };

    console.log("📤 Gönderilen veri:", JSON.stringify(erpPayload, null, 2));
    console.log("🌐 Endpoint:", ERP_API_URL);

    // API çağrısı (x-api-key header, Bearer YOK)
    const response = await axios.post(ERP_API_URL, erpPayload, {
      headers: {
        'x-api-key': ERP_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 saniye timeout
    });

    console.log("✅ ERP Yanıtı:", JSON.stringify(response.data, null, 2));
    console.log("========== ERP SİPARİŞ GÖNDERME BAŞARILI ==========");

    return {
      success: true,
      erpOrderId: response.data.id || response.data.orderId || response.data._id,
      data: response.data
    };

  } catch (err) {
    console.error("❌ ERP Gönderim Hatası:");
    console.error("   HTTP Status:", err.response?.status);
    console.error("   Hata Mesajı:", err.response?.data?.message || err.message);
    console.error("   Hata Detayı:", JSON.stringify(err.response?.data, null, 2));
    console.log("========== ERP SİPARİŞ GÖNDERME BAŞARISIZ ==========");

    return {
      success: false,
      error: err.response?.data?.message || err.message,
      status: err.response?.status
    };
  }
}

/**
 * Ödeme yöntemini ERP formatına çevir
 */
function getPaymentMethod(paymentMethod) {
  const methodMap = {
    'Kredi Kartı': 'credit_card',
    'credit_card': 'credit_card',
    'Havale/EFT': 'transfer',
    'transfer': 'transfer',
    'Kapıda Ödeme': 'cash_on_delivery',
    'cash': 'cash_on_delivery',
    'Açık Hesap': 'open_account',
    'open': 'open_account'
  };
  
  return methodMap[paymentMethod] || 'open_account';
}

/**
 * Ödeme durumunu belirle (paid/unpaid)
 */
function getPaymentStatus(paymentMethod) {
  // Kredi kartı = ödendi, diğerleri = ödenmedi
  const paidMethods = ['Kredi Kartı', 'credit_card'];
  return paidMethods.includes(paymentMethod) ? 'paid' : 'unpaid';
}

/**
 * Toplu sipariş senkronizasyonu (manuel tetikleme için)
 */
async function syncPendingOrders() {
  const Order = require('../models/Order');
  
  const pendingOrders = await Order.find({
    erpStatus: { $in: [null, 'pending', 'failed'] }
  }).limit(10);

  console.log(`🔄 ${pendingOrders.length} sipariş senkronize edilecek...`);

  for (const order of pendingOrders) {
    const User = require('../models/User');
    const user = await User.findById(order.userId);
    
    if (user) {
      const result = await sendOrderToERP(order, user);
      
      if (result.success) {
        order.erpStatus = 'synced';
        order.erpOrderId = result.erpOrderId;
        order.erpSyncDate = new Date();
        order.erpError = null;
      } else {
        order.erpStatus = 'failed';
        order.erpError = result.error;
      }
      
      await order.save();
    }
  }
}

module.exports = {
  sendOrderToERP,
  syncPendingOrders,
  getPaymentMethod,
  getPaymentStatus
};