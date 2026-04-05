const mongoose = require('mongoose');

const cariHesapSchema = new mongoose.Schema({
  kullaniciId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    sparse: true 
  },
  firmaUnvan: { type: String, required: true },
  vknTckn: { type: String, required: true },
  etiket: { type: String },
  adres: {
    il: String,
    ilce: String,
    mahalle: String,
    cadde: String,
    binaNo: String,
    daireNo: String,
    postaKodu: String
  },
  telefon: String,
  email: String,
  bakiye: { type: Number, default: 0 },
  toplamBorc: { type: Number, default: 0 },
  toplamAlacak: { type: Number, default: 0 },
  krediLimiti: { type: Number, default: 0 },
  riskDurumu: { 
    type: String, 
    enum: ['GÜVENLİ', 'DİKKAT', 'RİSKLİ'], 
    default: 'GÜVENLİ' 
  },
  gecikmisBorc: { type: Number, default: 0 },
  sonTahsilatTarihi: Date,
  notlar: String,
  durum: { type: String, enum: ['AKTİF', 'PASİF'], default: 'AKTİF' }
}, { timestamps: true });

cariHesapSchema.methods.bakiyeGuncelle = function(borc, alacak) {
  this.toplamBorc += borc;
  this.toplamAlacak += alacak;
  this.bakiye = this.toplamAlacak - this.toplamBorc;
  
  if (this.bakiye < -this.krediLimiti) {
    this.riskDurumu = 'RİSKLİ';
  } else if (this.bakiye < 0) {
    this.riskDurumu = 'DİKKAT';
  } else {
    this.riskDurumu = 'GÜVENLİ';
  }
  
  return this.save();
};

module.exports = mongoose.model('CariHesap', cariHesapSchema);