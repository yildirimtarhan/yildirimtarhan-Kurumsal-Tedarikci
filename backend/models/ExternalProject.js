const mongoose = require('mongoose');

const externalProjectSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    unique: true
  },
  apiKey: {
    type: String,
    required: true,
    unique: true
  },
  webhookUrl: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Kendi iç projeniz olduğu için bakiye kontrolüne şimdilik gerek yok
  // Ancak ileride lazım olabilir diye şimdilik saklıyoruz
  balance: {
    type: Number,
    default: 0 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ExternalProject', externalProjectSchema);
