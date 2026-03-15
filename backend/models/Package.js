const mongoose = require("mongoose");

const PackageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  barcode: { type: String, default: "", unique: true, sparse: true },
  subtitle: { type: String, default: "" },
  price: { type: Number, required: true },
  wholesalePrice: { type: Number, default: null }, // Bayi/toptan fiyat (B2B)
  kdvDahil: { type: Boolean, default: false },   // false = fiyat KDV hariç (artı KDV)
  kdvOrani: { type: Number, default: 20 },       // %
  period: { type: String, default: "ay" },      // ay, yıl
  features: [{ type: String }],
  featuresExcluded: [{ type: String }],
  isPopular: { type: Boolean, default: false },
  accentColor: { type: String, default: "#6366f1" },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Package", PackageSchema);
