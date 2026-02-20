const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  // Temel bilgiler
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  
  // Fiyat
  price: { type: Number, required: true, default: 0 },
  costPrice: { type: Number, default: 0 },
  
  // Stok
  stock: { type: Number, required: true, default: 0 },
  minStock: { type: Number, default: 10 },
  maxStock: { type: Number, default: 1000 },
  
  // Kategori
  category: { 
    type: String, 
    enum: ['E-Fatura', 'E-İrsaliye', 'Mali Mühür', 'E-Defter', 'Diğer'],
    default: 'Diğer'
  },
  
  unit: { type: String, default: 'Adet' },
  isActive: { type: Boolean, default: true },
  
  // ERP entegrasyonu
  erpCode: { type: String, default: "" },
  erpSynced: { type: Boolean, default: false },
  
  // Stok hareketleri
  movements: [{
    type: { type: String, enum: ['giris', 'cikis', 'duzeltme'] },
    quantity: { type: Number },
    oldStock: { type: Number },
    newStock: { type: Number },
    reason: { type: String },
    date: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Product", ProductSchema);