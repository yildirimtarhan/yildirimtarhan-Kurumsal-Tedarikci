const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const JWT_SECRET = process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";

// Brevo Setup
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const resetCodes = new Map();

// Reset Mail Gönderme
async function sendResetEmail(toEmail, kod, userName) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = "Şifre Sıfırlama Kodunuz";
    sendSmtpEmail.htmlContent = `
      <h2>Merhaba ${userName}</h2>
      <p>Şifre sıfırlama kodunuz:</p>
      <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 5px;">${kod}</h1>
      <p>Bu kod 15 dakika geçerlidir.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">Kurumsal Tedarikçi Platformu</p>
    `;
    sendSmtpEmail.sender = { name: "Kurumsal Tedarikçi", email: process.env.SMTP_FROM_EMAIL };
    sendSmtpEmail.to = [{ email: toEmail }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (err) {
    console.error("Mail hatası:", err.message);
    return false;
  }
}

// Register
router.post("/register", async (req, res) => {
  try {
    const {
      ad,
      email,
      password,
      telefon,
      firmaAdi,
      vergiNo,
      faturaAdresi,
      teslimatAdresi,
      city,
      district
    } = req.body;

    // Email kontrol
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email zaten kayıtlı" });
    }

    // Şifre hash
    const hashed = await bcrypt.hash(password, 10);

    // ✅ Adres array oluştur
    const addresses = [];

    // Fatura adresi ekle
    if (faturaAdresi) {
      addresses.push({
        title: "Fatura Adresi",
        fullName: ad,
        phone: telefon || "",
        city: city || "İstanbul",
        district: district || "",
        address: faturaAdresi,
        isDefault: true,
      });
    }

    // Teslimat adresi farklıysa ekle
    if (teslimatAdresi && teslimatAdresi !== faturaAdresi) {
      addresses.push({
        title: "Teslimat Adresi",
        fullName: ad,
        phone: telefon || "",
        city: city || "İstanbul",
        district: district || "",
        address: teslimatAdresi,
        isDefault: false,
      });
    }

    // ✅ Kullanıcı oluştur
    const newUser = await User.create({
      ad,
      email,
      password: hashed,
      telefon: telefon || "",
      firmaAdi: firmaAdi || "",
      vergiNo: vergiNo || "",

      // eski alanlar
      faturaAdresi: faturaAdresi || "",
      teslimatAdresi: teslimatAdresi || faturaAdresi || "",

      // yeni sistem
      addresses: addresses,

      rol: "user",
    });

    res.json({
      success: true,
      message: "Kayıt başarılı",
      userId: newUser._id,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Register hatası: " + err.message,
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "Email veya şifre yanlış" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ success: false, message: "Email veya şifre yanlış" });

    const token = jwt.sign(
      { id: user._id, email: user.email, rol: user.rol },
    
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: { id: user._id, ad: user.ad, email: user.email, rol: user.rol, firmaAdi: user.firmaAdi }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login hatası" });
  }
});

// Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, message: "Eğer kayıtlıysa kod gönderildi" });

    const kod = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(email, { kod, expiry: Date.now() + 900000 });

    const sent = await sendResetEmail(email, kod, user.ad);
    if (!sent) return res.status(500).json({ success: false, message: "Mail gönderilemedi" });

    res.json({ success: true, message: "Kod mail ile gönderildi" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Forgot password hatası" });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    const data = resetCodes.get(email);
    if (!data || data.kod !== code) return res.status(400).json({ success: false, message: "Kod hatalı" });
    if (Date.now() > data.expiry) return res.status(400).json({ success: false, message: "Kod süresi doldu" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email }, { $set: { password: hashed } });
    resetCodes.delete(email);

    res.json({ success: true, message: "Şifre güncellendi" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Reset hatası" });
  }
});

// Profil Getir
router.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token gerekli" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id) .select('-password');
    
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Profil hatası" });
  }
});

module.exports = router;