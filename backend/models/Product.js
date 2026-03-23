const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  // Temel bilgiler
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  barcode: { type: String, default: "", unique: true, sparse: true },
  description: { type: String, default: "" },
  
  // Fiyat (artı KDV = fiyat KDV hariç)
  price: { type: Number, required: true, default: 0 },
  wholesalePrice: { type: Number, default: null }, // Bayi/toptan fiyat (B2B); yoksa perakende kullanılır
  minQuantityWholesale: { type: Number, default: 1 }, // Toptan için min adet
  costPrice: { type: Number, default: 0 },
  kdvDahil: { type: Boolean, default: false },   // false = fiyat KDV hariç (artı KDV)
  kdvOrani: { type: Number, default: 20 },       // % (18, 20 vb.)
  
  // Stok
  stock: { type: Number, required: true, default: 0 },
  minStock: { type: Number, default: 10 },
  maxStock: { type: Number, default: 1000 },
  
  // Kategori (serbest metin; frontend dropdown ile gelir, Unicode farkları nedeniyle enum kaldırıldı)
  category: { type: String, default: 'Diğer', trim: true },
  
  unit: { type: String, default: 'Adet' },
  image: { type: String, default: '' }, // Ürün resmi URL (örn. /uploads/products/xxx.jpg)
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