const mongoose = require("mongoose");

// Adres alt şeması
const AddressSchema = new mongoose.Schema({
  baslik: { type: String, default: "Adres" }, // Ev, İşyeri, vb.
  adSoyad: { type: String, default: "" },
  telefon: { type: String, default: "" },
  sehir: { type: String, default: "" },
  ilce: { type: String, default: "" },
  mahalle: { type: String, default: "" },
  sokak: { type: String, default: "" },
  postaKodu: { type: String, default: "" },
  acikAdres: { type: String, default: "" },
  vergiDairesi: { type: String, default: "" }, // Kurumsal için
  vergiNo: { type: String, default: "" },      // Kurumsal için
  tip: { 
    type: String, 
    enum: ['fatura', 'teslimat'], 
    default: 'teslimat' 
  },
  varsayilan: { type: Boolean, default: false }
}, { _id: true });

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
  
  // YENİ: Detaylı adresler (fatura ve teslimat)
  faturaAdresi: {
    baslik: { type: String, default: "" },
    sehir: { type: String, default: "" },
    ilce: { type: String, default: "" },
    mahalle: { type: String, default: "" },
    sokak: { type: String, default: "" },
    postaKodu: { type: String, default: "" },
    acikAdres: { type: String, default: "" },
    vergiDairesi: { type: String, default: "" },
    vergiNo: { type: String, default: "" }
  },
  
  teslimatAdresi: {
    baslik: { type: String, default: "" },
    adSoyad: { type: String, default: "" },
    telefon: { type: String, default: "" },
    sehir: { type: String, default: "" },
    ilce: { type: String, default: "" },
    mahalle: { type: String, default: "" },
    sokak: { type: String, default: "" },
    postaKodu: { type: String, default: "" },
    acikAdres: { type: String, default: "" }
  },
  
  // Eski adres array (geriye uyumluluk için)
  addresses: [AddressSchema],
  
  // ERP entegrasyonu için YENİ ALANLAR
  erpCariId: { type: String, default: "" },
  erpSynced: { type: Boolean, default: false },
  erpSyncDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);