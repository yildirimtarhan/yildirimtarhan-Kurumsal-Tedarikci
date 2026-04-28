const mongoose = require('mongoose');

/**
 * Giden sesli arama (TTS) işi — Twilio TwiML veya harici webhook.
 */
const VoiceCallJobSchema = new mongoose.Schema(
  {
    marketingLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketingLead',
      default: null
    },
    telefon: { type: String, required: true },
    mesaj: { type: String, required: true },
    provider: { type: String, default: 'twilio' },
    status: {
      type: String,
      enum: [
        'queued',
        'calling',
        'ringing',
        'answered',
        'completed',
        'failed',
        'delegated',
        'busy',
        'no_answer',
        'canceled'
      ],
      default: 'queued'
    },
    twilioCallSid: { type: String, default: '' },
    netgsmBulkId: { type: String, default: '' },
    durumDetay: { type: String, default: '' },
    hata: { type: String, default: '' },
    scriptTur: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'voicecalljobs' }
);

VoiceCallJobSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('VoiceCallJob', VoiceCallJobSchema);
