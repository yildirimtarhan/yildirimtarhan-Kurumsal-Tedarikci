const mongoose = require('mongoose');

const faturaKalemSchema = new mongoose.Schema({
  siraNo: Number,
  malHizmet: { type: String, required: true },
  miktar: { type: Number, required: true },
  birim: { type: String, default: 'ADET' },
  birimFiyat: { type: Number, required: true },
  tutar: { type: Number, required: true },
  kdvOrani: { type: Number, default: 20 },
  kdvTutari: { type: Number, required: true },
  toplamTutar: { type: Number, required: true }
});

const faturaSchema = new mongoose.Schema({
  faturaNo: { type: String, unique: true, sparse: true },
  uuid: { type: String, unique: true, sparse: true },
  envUUID: { type: String },
  custInvId: { type: String },
  durum: {
    type: String,
    enum: ['TASLAK', 'BEKLİYOR', 'GÖNDERİLDİ', '1300-BAŞARILI', 'HATA', 'İPTAL'],
    default: 'TASLAK'
  },
  sistemYanitKodu: { type: String },
  sistemYanitAciklama: { type: String },
  cariHesapId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CariHesap',
    required: true 
  },
  aliciVkn: { type: String, required: true },
  aliciEtiket: { type: String },
  aliciUnvan: { type: String, required: true },
  aliciAdres: String,
  faturaTarihi: { type: Date, default: Date.now },
  duzenlemeTarihi: { type: Date, default: Date.now },
  saat: { type: String, default: () => new Date().toLocaleTimeString('tr-TR') },
  paraBirimi: { type: String, default: 'TRY' },
  kur: { type: Number, default: 1 },
  matrah: { type: Number, required: true },
  kdvOrani: { type: Number, default: 20 },
  kdvTutari: { type: Number, required: true },
  toplamTutar: { type: Number, required: true },
  kalemler: [faturaKalemSchema],
  aciklama: String,
  notlar: String,
  siparisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  taxtenGonderimTarihi: Date,
  taxtenHata: String,
  sonGuncelleme: Date
}, { timestamps: true });

faturaSchema.pre('save', async function(next) {
  if (!this.faturaNo && this.durum !== 'TASLAK') {
    const yil = new Date().getFullYear();
    const sonFatura = await this.constructor.findOne({
      faturaNo: new RegExp(`^F-${yil}-`)
    }).sort({ faturaNo: -1 });
    
    const sira = sonFatura ? parseInt(sonFatura.faturaNo.split('-')[2]) + 1 : 1;
    this.faturaNo = `F-${yil}-${String(sira).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Fatura', faturaSchema);