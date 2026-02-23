const mongoose = require('mongoose');

const tahsilatSchema = new mongoose.Schema({
  tahsilatNo: { type: String, unique: true },
  cariHesapId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CariHesap',
    required: true 
  },
  faturaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Fatura' 
  },
  tutar: { type: Number, required: true },
  tahsilatTarihi: { type: Date, default: Date.now },
  tahsilatTipi: {
    type: String,
    enum: ['NAKİT', 'KREDİ_KARTI', 'HAVALE_EFT', 'ÇEK', 'SENET', 'KAPIDA_ODEME'],
    required: true
  },
  odemeDetay: {
    kartSahibi: String,
    kartNo: String,
    taksitSayisi: Number,
    bankaAdi: String,
    hesapNo: String,
    referansNo: String,
    cekNo: String,
    vadeTarihi: Date,
    bankaKodu: String,
    teslimAlan: String
  },
  durum: {
    type: String,
    enum: ['BEKLİYOR', 'ONAYLANDI', 'REDDEDİLDİ', 'İPTAL'],
    default: 'ONAYLANDI'
  },
  aciklama: String,
  siparisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  olusturanKullanici: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

tahsilatSchema.pre('save', async function(next) {
  if (!this.tahsilatNo) {
    const yil = new Date().getFullYear();
    const sonTahsilat = await this.constructor.findOne({
      tahsilatNo: new RegExp(`^T-${yil}-`)
    }).sort({ tahsilatNo: -1 });
    
    const sira = sonTahsilat ? parseInt(sonTahsilat.tahsilatNo.split('-')[2]) + 1 : 1;
    this.tahsilatNo = `T-${yil}-${String(sira).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Tahsilat', tahsilatSchema);