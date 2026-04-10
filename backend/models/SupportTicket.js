const mongoose = require("mongoose");

const MesajSchema = new mongoose.Schema({
  from: { type: String, enum: ["kullanici", "admin", "destek"], default: "kullanici" },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const SupportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  konu: { type: String, required: true },
  mesajlar: [MesajSchema],
  durum: {
    type: String,
    enum: ["açık", "beklemede", "cevaplandı", "çözüldü", "kapalı"],
    default: "açık"
  },
  siparisNo: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);
