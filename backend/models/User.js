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

  firma: { type: String, default: "" },
  telefon: { type: String, default: "" },

  erpSynced: { type: Boolean, default: false },
  erpSyncDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
