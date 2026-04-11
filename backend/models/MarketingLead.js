const mongoose = require('mongoose');

const MarketingLeadSchema = new mongoose.Schema({
  firmaAdi: { type: String, required: true },
  sektor: { type: String, default: '' },
  yetkiliAdSoyad: { type: String, default: '' },
  email: { type: String, required: true },
  telefon: { type: String, default: '' },
  webSitesi: { type: String, default: '' },
  
  durum: { 
    type: String, 
    enum: ['yeni', 'teklif_hazirlandi', 'teklif_gonderildi', 'cevap_alindi', 'olumlu', 'olumsuz'],
    default: 'yeni'
  },
  
  aiNotlari: { type: String, default: '' },
  sonTeklifMetni: { type: String, default: '' },
  
  gonderimTarihi: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

MarketingLeadSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MarketingLead', MarketingLeadSchema);
