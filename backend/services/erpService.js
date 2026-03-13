const axios = require("axios");

const ERP_BASE_URL = "https://satistakip.online/api/integration";
const ERP_API_KEY = process.env.ERP_API_KEY || "";

const ERP_HEADERS = {
  'x-api-key': ERP_API_KEY,
  'Content-Type': 'application/json'
};

function getUserName(userData) {
  let fullName = '';

  if (userData.uyelikTipi === 'kurumsal' && userData.firma) {
    fullName = userData.firma.trim();
  } else {
    const raw = (userData.ad || '').trim();
    // Email adresiyse veya boşsa email'den türet
    fullName = (raw && !raw.includes('@')) ? raw : '';
  }

  if (!fullName) fullName = userData.email.split('@')[0];

  const parts = fullName.split(' ');
  return {
    ad: parts[0] || fullName,
    soyad: parts.slice(1).join(' ') || '',
    fullName
  };
}

function getUserAdres(userData) {
  return userData.faturaAdresi?.acikAdres ||
    (typeof userData.faturaAdresi === 'string' ? userData.faturaAdresi : '') ||
    userData.teslimatAdresi?.acikAdres ||
    (typeof userData.teslimatAdresi === 'string' ? userData.teslimatAdresi : '') ||
    'Belirtilmedi';
}

/**
 * Cariyi ERP'ye kaydet (YENİ endpoint)
 */
async function sendCustomerToERP(userData) {
  console.log("========== ERP CARİ GÖNDERME BAŞLADI ==========");
  console.log("👤 Müşteri:", userData.email);

  try {
    const { ad, soyad, fullName } = getUserName(userData);
    const payload = {
      ad,
      soyad,
      name: fullName,
      email: userData.email,
      phone: userData.telefon || '05000000000',
      adres: getUserAdres(userData)
    };

    console.log("📤 Gönderilen veri:", JSON.stringify(payload, null, 2));

    const response = await axios.post(`${ERP_BASE_URL}/customers`, payload, {
      headers: ERP_HEADERS,
      timeout: 15000
    });

    console.log("✅ ERP Cari Yanıtı:", JSON.stringify(response.data, null, 2));
    console.log("========== ERP CARİ GÖNDERME BAŞARILI ==========");

    return {
      success: true,
      erpCariId: response.data._id || response.data.id || response.data.cariId || '',
      data: response.data
    };

  } catch (err) {
    console.error("❌ ERP Cari Gönderim Hatası:");
    console.error("   HTTP Status:", err.response?.status);
    console.error("   Hata:", err.response?.data?.message || err.message);
    console.log("========== ERP CARİ GÖNDERME BAŞARISIZ ==========");

    return {
      success: false,
      error: err.response?.data?.message || err.message,
      status: err.response?.status
    };
  }
}

/**
 * Siparişi ERP'ye gönder
 */
async function sendOrderToERP(orderData, userData) {
  console.log("========== ERP SİPARİŞ GÖNDERME BAŞLADI ==========");
  console.log("📋 Sipariş ID:", orderData._id);
  console.log("👤 Müşteri:", userData.email);

  try {
    const { ad, soyad } = getUserName(userData);

    const erpPayload = {
      customer: {
        ad,
        soyad,
        email: userData.email,
        phone: userData.telefon || '05000000000',
        adres: getUserAdres(userData)
      },
      items: orderData.items.map(item => ({
        code: item.urunKodu
                ? item.urunKodu.trim()
                : (item.ad || 'URUN')
                    .substring(0, 20)
                    .replace(/\s+/g, '-')
                    .replace(/[^a-zA-Z0-9\-_]/g, '')
                    .toUpperCase() || 'URUN',
        quantity: parseInt(item.adet ?? 1),
        unitPrice: parseFloat(item.fiyat || 1)
      })),
      payment: {
        method: getPaymentMethod(orderData.paymentMethod),
        status: getPaymentStatus(orderData.paymentMethod)
      }
    };

    console.log("📤 Gönderilen veri:", JSON.stringify(erpPayload, null, 2));

    const response = await axios.post(`${ERP_BASE_URL}/sales`, erpPayload, {
      headers: ERP_HEADERS,
      timeout: 15000
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
    console.log("========== ERP SİPARİŞ GÖNDERME BAŞARISIZ ==========");

    return {
      success: false,
      error: err.response?.data?.message || err.message,
      status: err.response?.status
    };
  }
}

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

function getPaymentStatus(paymentMethod) {
  const paidMethods = ['Kredi Kartı', 'credit_card'];
  return paidMethods.includes(paymentMethod) ? 'paid' : 'unpaid';
}

async function syncPendingOrders() {
  const Order = require('../models/Order');
  const User = require('../models/User');

  const pendingOrders = await Order.find({
    erpStatus: { $in: [null, 'pending', 'failed'] }
  }).limit(10);

  console.log(`🔄 ${pendingOrders.length} sipariş senkronize edilecek...`);

  for (const order of pendingOrders) {
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
  sendCustomerToERP,
  sendOrderToERP,
  syncPendingOrders,
  getPaymentMethod,
  getPaymentStatus
};
