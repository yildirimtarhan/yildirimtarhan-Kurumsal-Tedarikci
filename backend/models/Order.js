const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({

  // Kargo bilgisi (YENİ)
    kargoBilgisi: {
        takipNo: {
            type: String,
            default: null
        },
        firma: {
            type: String,
            enum: ['yurtici', 'aras', 'mng', 'ptt', 'ups', null],
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
            enum: ['hazirlaniyor', 'kargoya_verildi', 'yolda', 'dagitimda', 'teslim_edildi', null],
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
