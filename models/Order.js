const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({

      kargoBilgisi: {
    takipNo: {
        type: String,
        default: null
    },
    firma: {
        type: String,
        enum: [
            'Yurtiçi Kargo',
            'Aras Kargo',
            'MNG Kargo',
            'PTT Kargo',
            'Sürat Kargo',
            'UPS',
            'DHL',
            'FedEx',
            'Kolay Gelsin',
            'HepsiJET',
            'Trendyol Express',
            null
        ],
        default: null
    },
    agirlik: {
        type: String,
        default: null
    },
    parcaSayisi: {
        type: Number,
        default: 1
    },
    durum: {
        type: String,
        enum: [
            'Hazırlanıyor',
            'Kargoya Verildi',
            'Yolda',
            'Dağıtımda',
            'Teslim Edildi',
            null
        ],
        default: null
    },
    kargolamaTarihi: {
        type: Date,
        default: null
    },
    teslimTarihi: {
        type: Date,
        default: null
    }

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

  status: {
    type: String,
    default: "Yeni",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", OrderSchema);
