const mongoose = require('mongoose');

const BeyanDurumSchema = new mongoose.Schema({
  tur: {
    type: String,
    enum: ['kdv', 'geciciVergi', 'muhtasar', 'gelirVergisi', 'bagkur'],
    required: true,
    index: true
  },

  yil: { type: Number, required: true, index: true },

  // KDV → 'Q1'|'Q2'|'Q3'|'Q4'
  // Muhtasar/Bağ-Kur → '01'…'12'
  // Geçici Vergi → 'G1'|'G2'|'G3'
  // Gelir Vergisi → 'YILLIK'
  donem: { type: String, required: true },

  // Beyan son tarihi (otomatik hesaplanır)
  sonGun: { type: Date, default: null },

  durum: {
    type: String,
    enum: ['hazirlanmadi', 'hazirlandi', 'verildi', 'gecikti', 'muaf'],
    default: 'hazirlanmadi'
  },

  verilmeTarihi: { type: Date, default: null },
  akNo: { type: String, default: '' }, // GİB tahakkuk/akış No

  // ── KDV özet alanlar ─────────────────────────────────────────
  matrah_20: { type: Number, default: 0 },
  matrah_10: { type: Number, default: 0 },
  matrah_01: { type: Number, default: 0 },
  matrah_00: { type: Number, default: 0 },

  hesaplananKdv: { type: Number, default: 0 },  // A satırı
  indirilecekKdv: { type: Number, default: 0 },  // B satırı
  devredenKdvOnceki: { type: Number, default: 0 }, // Önceki dönem devir
  odenmesiGerekenKdv: { type: Number, default: 0 }, // Ödeme
  devredenKdv: { type: Number, default: 0 },        // Sonraki döneme devir

  // ── Muhtasar alanlar ─────────────────────────────────────────
  stopajMatrahi: { type: Number, default: 0 },
  stopajTutari: { type: Number, default: 0 },
  // Stopaj türleri: kira, serbest meslek, ücret (çalışan yoksa 0)
  stopajDetay: [{
    tur: String,  // 'kira', 'serbest_meslek', 'diger'
    matrahi: Number,
    oran: Number,
    tutari: Number
  }],

  // ── Bağ-Kur alanlar ──────────────────────────────────────────
  bagkurBasamak: { type: Number, default: 7 }, // basamak no (1-24)
  bagkurPrimi: { type: Number, default: 0 },   // aylık prim tutarı
  bagkurOdendi: { type: Boolean, default: false },
  bagkurOdemeTarihi: { type: Date, default: null },

  // ── Geçici / Yıllık Gelir Vergisi ────────────────────────────
  donemGelirleri: { type: Number, default: 0 },
  donemGiderleri: { type: Number, default: 0 },
  kazanc: { type: Number, default: 0 },
  vergiMatrahi: { type: Number, default: 0 },
  vergiTutari: { type: Number, default: 0 },
  mahsupTutari: { type: Number, default: 0 }, // önceki gecici vergiler
  odenmesiGerekenVergi: { type: Number, default: 0 },

  notlar: { type: String, default: '' },
  
  // Nakit Akışı Entegrasyonu
  kasaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'KasaBanka',
    default: null 
  },
  kasaIslemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'KasaIslem',
    default: null 
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Her kayıtta updatedAt güncelle
BeyanDurumSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Bileşik benzersiz index
BeyanDurumSchema.index({ tur: 1, yil: 1, donem: 1 }, { unique: true });

module.exports = mongoose.model('BeyanDurum', BeyanDurumSchema);
