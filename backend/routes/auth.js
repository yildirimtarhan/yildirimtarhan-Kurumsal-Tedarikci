const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const { sendCustomerToERP } = require('../services/erpService');

const { JWT_SECRET } = require('../config/jwt');

// Brevo Setup
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const resetCodes = new Map();

// Hoşgeldin e-postası
async function sendWelcomeEmail(toEmail, userName, uyelikTipi) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Hoş Geldiniz - Kurumsal Tedarikçi";
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; color: white;">
          <h1>Kurumsal Tedarikçi'ye Hoş Geldiniz!</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #1f2937;">Merhaba ${userName},</h2>
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
            ${uyelikTipi === 'kurumsal' ? 'Kurumsal' : 'Bireysel'} üyeliğiniz başarıyla oluşturuldu.
          </p>
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #6366f1; margin-bottom: 15px;">🎁 Avantajlarınız:</h3>
            <ul style="color: #374151; line-height: 2;">
              <li>Online sipariş takibi</li>
              <li>Geçmiş alışverişlerinize erişim</li>
              <li>Özel indirim ve kampanyalar</li>
              <li>7/24 destek erişimi</li>
            </ul>
          </div>
          <a href="https://tedarikci.org.tr/urunler.html" style="display: inline-block; background: #6366f1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">Alışverişe Başla</a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">Bu e-posta otomatik olarak gönderilmiştir.</p>
        </div>
      </div>
    `;
    sendSmtpEmail.sender = { name: "Kurumsal Tedarikçi", email: process.env.SMTP_FROM_EMAIL || "noreply@tedarikci.org.tr" };
    sendSmtpEmail.to = [{ email: toEmail }];
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Hoşgeldin e-postası gönderildi:", toEmail);
    return true;
  } catch (err) {
    console.error("Hoşgeldin e-postası hatası:", err.message);
    return false;
  }
}

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

    // Adres dizisi - AddressSchema formatında (baslik, adSoyad, telefon, sehir, ilce, mahalle, sokak, postaKodu, acikAdres, tip)
    const addresses = [];
    
    // Fatura adresi ekle
    addresses.push({
      baslik: yeniFaturaAdresi.baslik || "Fatura Adresi",
      adSoyad: ad,
      telefon: telefon || "",
      sehir: yeniFaturaAdresi.sehir || "",
      ilce: yeniFaturaAdresi.ilce || "",
      mahalle: yeniFaturaAdresi.mahalle || "",
      sokak: yeniFaturaAdresi.sokak || "",
      postaKodu: yeniFaturaAdresi.postaKodu || "",
      acikAdres: yeniFaturaAdresi.acikAdres || "",
      tip: 'fatura',
      varsayilan: true
    });

    // Teslimat adresi ekle (farklıysa veya fatura ile aynı olsa bile ikisi de olsun - adreslerim sayfası için)
    const teslimatFarkli = JSON.stringify(yeniTeslimatAdresi) !== JSON.stringify(yeniFaturaAdresi);
    if (teslimatFarkli || !yeniTeslimatAdresi.acikAdres) {
      addresses.push({
        baslik: yeniTeslimatAdresi.baslik || "Teslimat Adresi",
        adSoyad: ad,
        telefon: telefon || "",
        sehir: yeniTeslimatAdresi.sehir || "",
        ilce: yeniTeslimatAdresi.ilce || "",
        mahalle: yeniTeslimatAdresi.mahalle || "",
        sokak: yeniTeslimatAdresi.sokak || "",
        postaKodu: yeniTeslimatAdresi.postaKodu || "",
        acikAdres: (yeniTeslimatAdresi.acikAdres || yeniFaturaAdresi.acikAdres) || "",
        tip: 'teslimat',
        varsayilan: false
      });
    }

    // ✅ Kullanıcı oluştur - adresler tekil objeler + adres dizisi
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

      // Detaylı adres objeleri (schema ile birebir uyumlu)
      faturaAdresi: yeniFaturaAdresi,
      teslimatAdresi: yeniTeslimatAdresi,

      // Çoklu adres listesi (eski yapı ile uyumluluk için)
      addresses: addresses,

      rol: "user",
    });

    // Hoşgeldin e-postası gönder
    sendWelcomeEmail(newUser.email, newUser.ad || 'Değerli Üyemiz', newUser.uyelikTipi || 'bireysel').catch(err => {
      console.warn("Hoşgeldin e-postası gönderilemedi:", err.message);
    });

    // ERP'ye otomatik cari kaydı
    try {
      const erpResult = await sendCustomerToERP(newUser);
      if (erpResult.success) {
        newUser.erpSynced = true;
        newUser.erpCariId = erpResult.erpCariId || '';
        newUser.erpSyncDate = new Date();
        await newUser.save();
        console.log('✅ Müşteri ERP\'ye aktarıldı:', newUser.email);
      } else {
        console.warn('⚠️ ERP aktarım başarısız (kayıt devam etti):', erpResult.error);
      }
    } catch (erpErr) {
      console.warn('⚠️ ERP hatası (kayıt devam etti):', erpErr.message);
      // Kayıt başarılı sayılır, ERP hatası kullanıcıyı engellemez
    }

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
        faturaAdresi: newUser.faturaAdresi,
        teslimatAdresi: newUser.teslimatAdresi,
        erpSynced: newUser.erpSynced,
        erpCariId: newUser.erpCariId
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

// Login - Sadece gerekli alanlar çekilir (hızlı yanıt)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email })
      .select("password ad email rol uyelikTipi firma telefon tcNo vergiNo vergiDairesi faturaAdresi teslimatAdresi addresses");
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
        faturaAdresi: user.faturaAdresi,
        teslimatAdresi: user.teslimatAdresi,
        addresses: user.addresses || []
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

    const userId = decoded.userId || decoded.id;
    const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).select('-password');
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
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).select('-password');
    
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
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).select('faturaAdresi teslimatAdresi addresses firma vergiNo vergiDairesi tcNo ad telefon');
    
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

    // Adres fallback: fatura/teslimat boş veya anlamsızsa addresses dizisinden üret
    const isEmptyAddr = (a) =>
      !a || (typeof a === 'string' && !a.trim()) ||
      (typeof a === 'object' && !(a.acikAdres || a.sehir || a.ilce || a.mahalle || a.sokak));

    let faturaAdresi = user.faturaAdresi;
    let teslimatAdresi = user.teslimatAdresi;
    const addrList = user.addresses || [];

    if (isEmptyAddr(faturaAdresi) && addrList.length) {
      const fAddr = addrList.find(a => a.tip === 'fatura') || addrList[0];
      if (fAddr) {
        faturaAdresi = {
          baslik: fAddr.baslik || fAddr.title || 'Fatura Adresi',
          sehir: fAddr.sehir || fAddr.city || '',
          ilce: fAddr.ilce || fAddr.district || '',
          mahalle: fAddr.mahalle || '',
          sokak: fAddr.sokak || '',
          postaKodu: fAddr.postaKodu || fAddr.postalCode || '',
          acikAdres: fAddr.acikAdres || fAddr.address || ''
        };
      }
    }

    if (isEmptyAddr(teslimatAdresi) && addrList.length) {
      const tAddr = addrList.find(a => a.tip === 'teslimat') || addrList[1] || addrList[0];
      if (tAddr) {
        teslimatAdresi = {
          baslik: tAddr.baslik || tAddr.title || 'Teslimat Adresi',
          sehir: tAddr.sehir || tAddr.city || '',
          ilce: tAddr.ilce || tAddr.district || '',
          mahalle: tAddr.mahalle || '',
          sokak: tAddr.sokak || '',
          postaKodu: tAddr.postaKodu || tAddr.postalCode || '',
          acikAdres: tAddr.acikAdres || tAddr.address || ''
        };
      }
    }

    res.json({
      success: true,
      faturaAdresi,
      teslimatAdresi,
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
    const userId = decoded.userId || decoded.id;
    const { faturaAdresi, teslimatAdresi } = req.body;

    const updateData = {};
    if (faturaAdresi) updateData.faturaAdresi = faturaAdresi;
    if (teslimatAdresi) updateData.teslimatAdresi = teslimatAdresi;

    const user = await User.findByIdAndUpdate(
      userId,
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