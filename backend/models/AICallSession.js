const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'model'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const AICallSessionSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingLead' },
  callSid: { type: String, required: true, unique: true },
  from: { type: String },
  to: { type: String },
  transcript: [MessageSchema],
  summary: { type: String },
  notes: { type: String },
  emailSent: { type: Boolean, default: false },
  recordingUrl: { type: String },
  duration: { type: Number },
  status: { 
    type: String, 
    enum: ['in-progress', 'completed', 'failed'], 
    default: 'in-progress' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

AICallSessionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('AICallSession', AICallSessionSchema);
