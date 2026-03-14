const mongoose = require("mongoose");

const PackageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subtitle: { type: String, default: "" },
  price: { type: Number, required: true },
  period: { type: String, default: "ay" }, // ay, yıl
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
