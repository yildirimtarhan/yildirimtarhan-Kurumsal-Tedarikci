const mongoose = require('mongoose');

const kasaIslemSchema = new mongoose.Schema({
  kasaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'KasaBanka', 
    required: true 
  },
  islemTipi: { 
    type: String, 
    enum: ['GİRİŞ', 'ÇIKIŞ', 'TRANSFER'], 
    required: true 
  },
  tutar: { 
    type: Number, 
    required: true 
  },
  tarih: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  aciklama: { 
    type: String, 
    required: true 
  },
  
  ilgiliModul: { 
    type: String, 
    enum: ['TAHSİLAT', 'FATURA_ODEME', 'GIDER', 'TRANSFER', 'MANUEL'], 
    default: 'MANUEL' 
  },
  referansId: { 
    type: mongoose.Schema.Types.ObjectId, // TahsilatId, FaturaId veya DefterKaydiId vb.
    default: null 
  },
  
  // Sadece TRANSFER (virman) ise hedefin/kaynağın id'si tutulur.
  karsiKasaId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'KasaBanka',
    default: null
  },
  
  olusturanKullanici: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

module.exports = mongoose.model('KasaIslem', kasaIslemSchema);
