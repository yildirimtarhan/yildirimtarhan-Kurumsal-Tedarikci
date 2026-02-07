const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  firmaAdi: String,
  email: String,

  items: [
    {
      ad: String,
      fiyat: Number,
      adet: Number,
    },
  ],

  toplam: Number,

  status: {
    type: String,
    default: "Yeni",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", OrderSchema);
