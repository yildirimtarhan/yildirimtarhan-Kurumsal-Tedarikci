const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: { type: String, required: true },
  
  // Üyelik tipi ve rol
  uyelikTipi: { 
    type: String, 
    enum: ['bireysel', 'kurumsal'], 
    default: 'bireysel' 
  },
  rol: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  
  // Firma bilgileri (kurumsal için)
  firma: { type: String, default: "" },
  vergiNo: { type: String, default: "" },
  vergiDairesi: { type: String, default: "" },
  
  // Bireysel için
  tcNo: { type: String, default: "" },
  
  telefon: { type: String, default: "" },
  
  // Adresler
  faturaAdresi: { type: String, default: "" },
  teslimatAdresi: { type: String, default: "" },
  
  // Adres array (detaylı adresler için)
  addresses: [{
    title: { type: String, default: "Adres" },
    fullName: { type: String },
    phone: { type: String },
    city: { type: String },
    district: { type: String },
    address: { type: String },
    isDefault: { type: Boolean, default: false }
  }],
  
  erpSynced: { type: Boolean, default: false },
  erpSyncDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);