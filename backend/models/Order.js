const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },

  firmaAdi: String,
  email: String,

  items: [
    {
      ad: String,
      fiyat: Number,
      adet: Number,
    },
  ],

  toplam: Number,
  subtotal: Number,
  kdv: Number,

  shippingAddress: {
    title: String,
    fullName: String,
    phone: String,
    city: String,
    district: String,
    address: String,
  },

  invoiceAddress: {
    title: String,
    fullName: String,
    phone: String,
    city: String,
    district: String,
    address: String,
  },

  paymentMethod: { type: String, default: "Kapida Odeme" },

  // Ödeme takibi (PayTR vb.)
  paymentProvider: { type: String, enum: ['paytr', 'manual', null], default: null },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled', null], default: null },

  paytr: {
    merchantOid: { type: String, index: true, default: null },
    status: { type: String, enum: ['success', 'failed', null], default: null },
    paymentType: { type: String, default: null }, // card / eft
    totalAmount: { type: Number, default: null }, // kuruş (x100)
    paymentAmount: { type: Number, default: null }, // kuruş (x100)
    currency: { type: String, default: null },
    testMode: { type: Number, default: null },
    failedReasonCode: { type: String, default: null },
    failedReasonMsg: { type: String, default: null },
    notifiedAt: { type: Date, default: null }
  },

  orderType: { type: String, enum: ['b2c', 'b2b'], default: 'b2c' }, // b2b = toptan/bayi

  status: {
    type: String,
    default: "Hazirlaniyor",
  },

  // YENİ: ERP Entegrasyon Alanları
  erpOrderId: { type: String, default: null },      // ERP'deki sipariş ID
  erpStatus: { 
    type: String, 
    enum: ['pending', 'synced', 'failed', null],
    default: null 
  },
  erpSyncDate: { type: Date, default: null },
  erpError: { type: String, default: null },         // Hata mesajı (varsa)

  kargoBilgisi: {
    takipNo: { type: String, default: null },
    firma: { type: String, default: null },
    agirlik: { type: String, default: null },
    parcaSayisi: { type: Number, default: 1 },
    durum: { type: String, default: null },
    kargolamaTarihi: { type: Date, default: null },
    teslimTarihi: { type: Date, default: null }
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", OrderSchema);