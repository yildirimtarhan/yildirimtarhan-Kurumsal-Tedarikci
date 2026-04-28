const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema(
  {
    tip: {
      type: String,
      enum: ['email', 'arama', 'not', 'randevu', 'toplanti', 'teklif', 'diger'],
      default: 'not'
    },
    baslik: { type: String, default: '' },
    not: { type: String, default: '' },
    sonuc: {
      type: String,
      enum: ['ulasildi', 'ulasilamadi', 'geri_donulecek', 'iptal', ''],
      default: ''
    },
    olusturan: { type: String, default: 'admin' },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const MarketingLeadSchema = new mongoose.Schema({
  firmaAdi: { type: String, required: true },
  sektor: { type: String, default: '' },
  yetkiliAdSoyad: { type: String, default: '' },
  email: { type: String, required: true },
  telefon: { type: String, default: '' },
  webSitesi: { type: String, default: '' },

  /**
   * Kurumsal B2B satış hunisi (Türkiye odaklı operasyon)
   */
  durum: {
    type: String,
    enum: [
      'yeni',
      'ilk_temas',
      'takipte',
      'teklif_hazirlandi',
      'teklif_gonderildi',
      'cevap_alindi',
      'randevu_planli',
      'gorusme_yapildi',
      'olumlu',
      'olumsuz',
      'pasif'
    ],
    default: 'yeni'
  },

  sonrakiEylemTarihi: { type: Date },
  randevuBaslangic: { type: Date },
  randevuBitis: { type: Date },
  randevuNotu: { type: String, default: '' },
  /** örn: telefon, teams, yuz_yuze */
  randevuKanal: { type: String, default: '' },

  aktiviteler: { type: [ActivitySchema], default: [] },

  /** Ticari elektronik ileti izinleri (Email/SMS) — ETK/İYS uyumu için */
  emailOnay: { type: Boolean, default: false },
  smsOnay: { type: Boolean, default: false },
  onayTarihi: { type: Date },
  onayIp: { type: String },

  aiNotlari: { type: String, default: '' },
  sonTeklifMetni: { type: String, default: '' },

  gonderimTarihi: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

MarketingLeadSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MarketingLead', MarketingLeadSchema);
