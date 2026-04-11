const mongoose = require('mongoose');

const SocialContentSchema = new mongoose.Schema({
  baslik: { type: String, required: true },
  platform: { 
    type: String, 
    enum: ['instagram', 'facebook', 'whatsapp', 'linkedin', 'tiktok'],
    required: true 
  },
  icerikTipi: { 
    type: String, 
    enum: ['post', 'story', 'reels', 'video_script'],
    default: 'post' 
  },
  
  // AI Tarafından Üretilenler
  aciklama: { type: String, default: '' },
  hashtags: [{ type: String }],
  videoSenaryosu: {
    giris: String,
    gelisme: String,
    sonuc: String,
    sahneDetaylari: [String]
  },
  
  durum: { 
    type: String, 
    enum: ['taslak', 'onaylandi', 'paylasildi', 'arsiv'],
    default: 'taslak'
  },
  
  paylasimTarihi: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SocialContent', SocialContentSchema);
