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

// Register - YENİ ADRES YAPISI
router.post("/register", async (req, res) => {
  try {
    const {
      ad,
      email,
      password,
      telefon,
      tcNo,
      uyelikTipi,
      // Kurumsal bilgiler
      firma,
      vergiNo,
      vergiDairesi,
      // Yeni adres yapısı
      faturaAdresi,
      teslimatAdresi,
      // Eski alanlar (geriye uyumluluk)
      city,
      district,
      faturaAdresi: eskiFaturaAdresi,
      teslimatAdresi: eskiTeslimatAdresi
    } = req.body;

    // Email kontrol
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: "Email zaten kayıtlı" 
      });
    }

    // Şifre hash
    const hashed = await bcrypt.hash(password, 10);

    // ✅ YENİ: Fatura adresi objesi
    const yeniFaturaAdresi = faturaAdresi || {
      baslik: "Fatura Adresi",
      sehir: city || "İstanbul",
      ilce: district || "",
      postaKodu: "",
      acikAdres: eskiFaturaAdresi || "",
      vergiDairesi: vergiDairesi || "",
      vergiNo: vergiNo || ""
    };

    // ✅ YENİ: Teslimat adresi objesi
    const yeniTeslimatAdresi = teslimatAdresi || {
      baslik: "Teslimat Adresi",
      adSoyad: ad,
      telefon: telefon || "",
      sehir: city || "İstanbul",
      ilce: district || "",
      postaKodu: "",
      acikAdres: eskiTeslimatAdresi || eskiFaturaAdresi || ""
    };

    // Eski adres array (geriye uyumluluk için)
    const addresses = [];
    
    // Fatura adresi ekle
    addresses.push({
      baslik: yeniFaturaAdresi.baslik || "Fatura Adresi",
      fullName: ad,
      phone: telefon || "",
      city: yeniFaturaAdresi.sehir,
      district: yeniFaturaAdresi.ilce,
      address: yeniFaturaAdresi.acikAdres,
      isDefault: true,
      tip: 'fatura'
    });

    // Teslimat adresi ekle (farklıysa)
    const teslimatFarkli = JSON.stringify(yeniTeslimatAdresi) !== JSON.stringify(yeniFaturaAdresi);
    if (teslimatFarkli || !yeniTeslimatAdresi.acikAdres) {
      addresses.push({
        baslik: yeniTeslimatAdresi.baslik || "Teslimat Adresi",
        fullName: ad,
        phone: telefon || "",
        city: yeniTeslimatAdresi.sehir,
        district: yeniTeslimatAdresi.ilce,
        address: yeniTeslimatAdresi.acikAdres || yeniFaturaAdresi.acikAdres,
        isDefault: false,
        tip: 'teslimat'
      });
    }

    // ✅ Kullanıcı oluştur
    const newUser = await User.create({
      ad,
      email,
      password: hashed,
      telefon: telefon || "",
      tcNo: tcNo || "",
      uyelikTipi: uyelikTipi || 'bireysel',
      
      // Kurumsal bilgiler
      firma: firma || "",
      vergiNo: vergiNo || "",
      vergiDairesi: vergiDairesi || "",

      // YENİ: Detaylı adresler
      faturaAdresi: yeniFaturaAdresi,
      teslimatAdresi: yeniTeslimatAdresi,

      // Eski alanlar (geriye uyumluluk)
      faturaAdresi: yeniFaturaAdresi.acikAdres,
      teslimatAdresi: yeniTeslimatAdresi.acikAdres,

      // Adres array
      addresses: addresses,

      rol: "user",
    });

    // Token oluştur
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, rol: newUser.rol },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      message: "Kayıt başarılı",
      token,
      user: {
        id: newUser._id,
        ad: newUser.ad,
        email: newUser.email,
        rol: newUser.rol,
        uyelikTipi: newUser.uyelikTipi,
        firma: newUser.firma,
        telefon: newUser.telefon,
        // Adresleri de gönder
        faturaAdresi: newUser.faturaAdresi,
        teslimatAdresi: newUser.teslimatAdresi
      }
    });
  } catch (err) {
    console.error("Register hatası:", err);
    res.status(500).json({
      success: false,
      message: "Register hatası: " + err.message,
    });
  }
});

// Login - Adresleri de döndür
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
      user: { 
        id: user._id, 
        ad: user.ad, 
        email: user.email, 
        rol: user.rol, 
        uyelikTipi: user.uyelikTipi,
        firma: user.firma,
        telefon: user.telefon,
        tcNo: user.tcNo,
        vergiNo: user.vergiNo,
        vergiDairesi: user.vergiDairesi,
        // YENİ: Adresleri ekle
        faturaAdresi: user.faturaAdresi,
        teslimatAdresi: user.teslimatAdresi
      }
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

// Profil Güncelle
router.put("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token gerekli" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const { uyelikTipi, firma, vergiNo, vergiDairesi, telefon } = req.body;

    const updateData = {};
    if (uyelikTipi) updateData.uyelikTipi = uyelikTipi;
    if (firma !== undefined) updateData.firma = firma;
    if (vergiNo !== undefined) updateData.vergiNo = vergiNo;
    if (vergiDairesi !== undefined) updateData.vergiDairesi = vergiDairesi;
    if (telefon !== undefined) updateData.telefon = telefon;

    const user = await User.findByIdAndUpdate(decoded.id, { $set: updateData }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Profil güncelleme hatası" });
  }
});

// Profil Getir - Tüm adresleri döndür
router.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token gerekli" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        ad: user.ad,
        email: user.email,
        rol: user.rol,
        uyelikTipi: user.uyelikTipi,
        firma: user.firma,
        telefon: user.telefon,
        tcNo: user.tcNo,
        vergiNo: user.vergiNo,
        vergiDairesi: user.vergiDairesi,
        // YENİ: Detaylı adresler
        faturaAdresi: user.faturaAdresi,
        teslimatAdresi: user.teslimatAdresi,
        addresses: user.addresses
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Profil hatası" });
  }
});

// YENİ: Kullanıcı adreslerini getir (Ödeme için)
router.get("/adreslerim", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token gerekli" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('faturaAdresi teslimatAdresi addresses firma vergiNo vergiDairesi tcNo ad telefon');
    
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    
    res.json({
      success: true,
      faturaAdresi: user.faturaAdresi,
      teslimatAdresi: user.teslimatAdresi,
      addresses: user.addresses,
      // Fatura bilgileri
      faturaBilgisi: {
        adSoyad: user.ad,
        tcNo: user.tcNo,
        firma: user.firma,
        vergiNo: user.vergiNo,
        vergiDairesi: user.vergiDairesi,
        telefon: user.telefon
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Adres getirme hatası" });
  }
});

// YENİ: Adres güncelle
router.put("/adres-guncelle", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token gerekli" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const { faturaAdresi, teslimatAdresi } = req.body;

    const updateData = {};
    if (faturaAdresi) updateData.faturaAdresi = faturaAdresi;
    if (teslimatAdresi) updateData.teslimatAdresi = teslimatAdresi;

    const user = await User.findByIdAndUpdate(
      decoded.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: "Adresler güncellendi",
      user: {
        faturaAdresi: user.faturaAdresi,
        teslimatAdresi: user.teslimatAdresi
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Adres güncelleme hatası" });
  }
});

module.exports = router;