const mongoose = require('mongoose');

const kasaBankaSchema = new mongoose.Schema({
  hesapAdi: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  tip: { 
    type: String, 
    enum: ['NAKİT', 'BANKA', 'KREDİ_KARTI', 'POS'], 
    required: true 
  },
  paraBirimi: { 
    type: String, 
    enum: ['TRY', 'USD', 'EUR'], 
    default: 'TRY' 
  },
  bakiye: { 
    type: Number, 
    default: 0 
  },
  
  // Banka bilgileri
  bankaAdi: { type: String, default: '' },
  subeAdi: { type: String, default: '' },
  hesapNo: { type: String, default: '' },
  iban: { type: String, default: '' },
  
  // Pos Komisyonu Vb.
  komisyonOrani: { type: Number, default: 0 },
  
  varsayilan: { type: Boolean, default: false },
  durum: { type: String, enum: ['AKTİF', 'PASİF'], default: 'AKTİF' }
}, { timestamps: true });

// Bakiyeyi güncelleyen yardımcı metod
kasaBankaSchema.methods.bakiyeGuncelle = function(tutar, islemTipi) {
  if (islemTipi === 'GİRİŞ') {
    this.bakiye += tutar;
  } else if (islemTipi === 'ÇIKIŞ') {
    this.bakiye -= tutar;
  }
  return this.save();
};

module.exports = mongoose.model('KasaBanka', kasaBankaSchema);
