const mongoose = require('mongoose');

const DefterKaydiSchema = new mongoose.Schema({
  tip: {
    type: String,
    enum: ['gelir', 'gider'],
    required: true,
    index: true
  },

  tarih: { type: Date, required: true, index: true },
  aciklama: { type: String, required: true },
  karsiTaraf: { type: String, default: '' }, // müşteri veya tedarikçi adı
  faturaNo: { type: String, default: '' },

  // Kategori
  kategori: {
    type: String,
    default: 'Diğer'
    // Gelir: 'Satış Geliri', 'Hizmet Geliri', 'Kira Geliri', 'Diğer Gelir'
    // Gider: 'Kira', 'Kargo', 'Ofis Gideri', 'Vergi/SGK', 'Hammadde', 'Hizmet Alımı', 'Diğer'
  },

  // Tutar hesaplamaları
  kdvHaricTutar: { type: Number, required: true },
  kdvOrani: { type: Number, default: 20 }, // 0, 1, 10, 20
  kdvTutari: { type: Number, default: 0 },
  kdvDahilTutar: { type: Number, required: true },

  // Stopaj (giderler için — kira, serbest meslek ödemesi vb.)
  stopajOrani: { type: Number, default: 0 },  // %20 kira stopajı gibi
  stopajTutari: { type: Number, default: 0 },

  // Dönem bilgisi
  yil: { type: Number, required: true, index: true },
  ay: { type: Number, required: true }, // 1–12
  donem: { type: String, required: true, index: true }, // '2025-Q1', '2025-Q2' vb.

  // Kaynak
  kaynak: {
    type: String,
    enum: ['siparis', 'manuel'],
    default: 'manuel'
  },
  siparisId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },

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

  createdAt: { type: Date, default: Date.now }
});

// Dönem hesaplama yardımcı fonksiyonu
DefterKaydiSchema.statics.ayToDonem = function (ay) {
  if (ay <= 3) return 'Q1';
  if (ay <= 6) return 'Q2';
  if (ay <= 9) return 'Q3';
  return 'Q4';
};

module.exports = mongoose.model('DefterKaydi', DefterKaydiSchema);
