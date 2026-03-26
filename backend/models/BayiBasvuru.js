const mongoose = require("mongoose");

const BayiBasvuruSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  email: { type: String, required: true },
  ad: { type: String, default: "" },
  firmaAdi: { type: String, required: true, trim: true },
  vergiDairesi: { type: String, required: true, trim: true },
  vergiNo: { type: String, default: "", trim: true },
  tcNo: { type: String, default: "", trim: true },
  telefon: { type: String, default: "" },
  mesaj: { type: String, default: "" },
  // Fatura adresi
  faturaIl: { type: String, default: "" },
  faturaIlce: { type: String, default: "" },
  faturaMahalle: { type: String, default: "" },
  faturaSokak: { type: String, default: "" },
  faturaAdres: { type: String, default: "" },
  // Teslimat adresi
  teslimatIl: { type: String, default: "" },
  teslimatIlce: { type: String, default: "" },
  teslimatMahalle: { type: String, default: "" },
  teslimatSokak: { type: String, default: "" },
  teslimatAdres: { type: String, default: "" },
  durum: {
    type: String,
    enum: ["beklemede", "onaylandi", "reddedildi"],
    default: "beklemede",
    index: true,
  },
  adminNotu: { type: String, default: "" },
  onaylayanId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  onayTarihi: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("BayiBasvuru", BayiBasvuruSchema);
