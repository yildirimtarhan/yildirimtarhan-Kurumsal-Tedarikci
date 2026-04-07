// 1) HER ŞEYDEN ÖNCE
require("dotenv").config();

// 🛡️ GLOBAL HATA KALKANI (Sunucunun çökmesini engeller)
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [Unhandled Rejection] Hata:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🚨 [Uncaught Exception] Hata:', err.message);
  // NOT: Kritik bir hata değilse sunucuyu açık tutmaya çalışıyoruz.
});

// ✅ DNS AYARLARI - MONGOOSE'DAN ÖNCE
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);
console.log('✅ Google DNS ayarlandı');
// (İsteğe bağlı) Sadece var mı diye kontrol et, secret'ı basma!
console.log("ENV OK:", {
  MONGODB_URI: !!process.env.MONGODB_URI,
  JWT_SECRET: !!process.env.JWT_SECRET,
  SMTP_HOST: !!process.env.SMTP_HOST,
  ERP_BASE_URL: !!process.env.ERP_BASE_URL,
});

// 2) Sonra importlar
const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const { JWT_SECRET } = require("./config/jwt");

// ... gerisi aynı kalacak
// ✅ ERP Service Import
const { createCariInERP, createSaleInERP } = require('./services/erpService');
// Modeller
const User = require("./models/User");
const Order = require("./models/Order");


const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const session = require("express-session");
const passport = require("passport");
require("./config/passportStrategies")(passport);

/* ======================================================
   ✅ MongoDB Bağlantısı
====================================================== */
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/kurumsal-tedarikci";

mongoose
  .connect(mongoUri, { family: 4 })
  .then(() => console.log("✅ MongoDB bağlandı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

/* ======================================================
   ✅ Güvenlik: Helmet (HTTP başlıkları)
====================================================== */
app.use(helmet({ contentSecurityPolicy: false }));

/* ======================================================
   ✅ Middleware
====================================================== */
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5500", "https://tedarikci.org.tr", "https://www.tedarikci.org.tr"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      process.env.JWT_SECRET ||
      "oauth-session-dev-only",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

/* ======================================================
   ✅ Rate limiting: Genel API (brute-force / spam azaltma)
====================================================== */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin." },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/register", authLimiter);

// TEST: Basit log testi
app.get("/api/test/log", (req, res) => {
  console.log("🧪 TEST LOG:", new Date().toISOString());
  console.log("🧪 Bu log Render'da görünmeli!");
  res.json({ success: true, message: "Log testi", time: new Date().toISOString() });

  });

 
// ===================== ROUTES =====================
// Önce route'ları import et
const authRoutes = require("./routes/auth");
const addressRoutes = require("./routes/addresses");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const productRoutes = require("./routes/products");
const packageRoutes = require("./routes/packages");
// ==================== YENİ ROUTE IMPORTLARI ====================
const cariRoutes = require('./routes/cari');
const faturaRoutes = require('./routes/fatura');
const tahsilatRoutes = require('./routes/tahsilat');
const adresRoutes = require('./routes/adres');
const supportRoutes = require('./routes/support');
const categoryRoutes = require('./routes/categories');
const bayiBasvuruRoutes = require('./routes/bayiBasvuru');
const uploadRoutes = require('./routes/upload');
const muhasebeRoutes = require('./routes/muhasebe');
const kasaRoutes = require('./routes/kasa');


const oauthRoutes = require('./routes/oauth');

// Sonra kullan (OAuth önce)
app.use("/api/auth", oauthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/packages", packageRoutes);
// ==================== YENİ ROUTE KULLANIMLARI ====================
app.use('/api/cari', cariRoutes);
app.use('/api/fatura', faturaRoutes);
app.use('/api/faturalar', faturaRoutes);
app.use('/api/tahsilat', tahsilatRoutes);
app.use('/api/adres', adresRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bayi-basvuru', bayiBasvuruRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/muhasebe', muhasebeRoutes);
app.use('/api/kasa', kasaRoutes);



/* ======================================================
   Teklif Al - Form gönderimi
====================================================== */
app.post("/api/teklif", (req, res) => {
  try {
    const { ad, firma, email, telefon, hizmetler, kullaniciSayisi, mesaj } = req.body;
    if (!ad || !email || !telefon) {
      return res.status(400).json({ success: false, message: "Ad, e-posta ve telefon zorunludur." });
    }
    console.log("📋 Teklif talebi:", { ad, firma, email, telefon, hizmetler, kullaniciSayisi });
    res.json({ success: true, message: "Teklif talebiniz alındı. En kısa sürede size dönüş yapacağız." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Bir hata oluştu." });
  }
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // 587 => false
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


/* ======================================================
   ✅ AUTHENTICATE TOKEN MIDDLEWARE
====================================================== */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Token gerekli"
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;          // decoded = { userId: ... }
    req.userId = decoded.userId; // kolay erişim

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token geçersiz veya süresi dolmuş"
    });
  }
}


/* ======================================================
   ✅ Brevo Mail Setup
====================================================== */
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const resetCodes = new Map();

/* ======================================================
   ✅ Email Gönderme Fonksiyonları
====================================================== */
async function sendEmail(toEmail, subject, htmlContent) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = {
      name: "Kurumsal Tedarikçi",
      email: process.env.SMTP_FROM_EMAIL || "yildirimtarhan@tedarikci.org.tr",
    };
    sendSmtpEmail.to = [{ email: toEmail }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email gönderildi:", toEmail);
    return true;
  } catch (err) {
    console.error("❌ Email hatası:", err.message);
    return false;
  }
}

// Hoşgeldin emaili
async function sendWelcomeEmail(toEmail, userName, uyelikTipi) {
  const subject = "Hoş Geldiniz - Kurumsal Tedarikçi";
  const htmlContent = `
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
        
        <a href="https://tedarikci.org.tr/urunler.html" 
           style="display: inline-block; background: #6366f1; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px;">
          Alışverişe Başla
        </a>
        
        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
          Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
        </p>
      </div>
    </div>
  `;
  
  return await sendEmail(toEmail, subject, htmlContent);
}

// Şifre sıfırlama emaili
async function sendResetEmail(toEmail, kod, userName) {
  const subject = "Şifre Sıfırlama Kodunuz";
  const htmlContent = `
    <h2>Merhaba ${userName}</h2>
    <p>Şifre sıfırlama kodunuz:</p>
    <h1 style="color: #6366f1; font-size: 32px; letter-spacing: 5px;">${kod}</h1>
    <p>Bu kod 15 dakika geçerlidir.</p>
  `;
  
  return await sendEmail(toEmail, subject, htmlContent);
}

// Sipariş onay emaili
async function sendOrderConfirmationEmail(toEmail, order, userName) {
  const subject = `Sipariş Alındı - ${order.orderId || order._id}`;
  
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.ad || item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.adet || item.qty}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₺${((item.fiyat || item.price) * (item.adet || item.qty)).toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; color: white;">
        <h1>Siparişiniz Alındı!</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2 style="color: #1f2937;">Merhaba ${userName},</h2>
        <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
          Siparişiniz başarıyla oluşturuldu. En kısa sürede hazırlanıp kargoya verilecektir.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #6366f1; margin-bottom: 15px;">Sipariş Detayları</h3>
          <p><strong>Sipariş No:</strong> ${order.orderId || order._id}</p>
          <p><strong>Tarih:</strong> ${new Date(order.createdAt || order.tarih).toLocaleString('tr-TR')}</p>
          <p><strong>Ödeme Yöntemi:</strong> ${order.odemeYontemi || order.paymentMethod}</p>
          
          <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left;">Ürün</th>
                <th style="padding: 10px; text-align: center;">Adet</th>
                <th style="padding: 10px; text-align: right;">Tutar</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 15px; text-align: right; font-size: 18px; font-weight: bold; color: #6366f1;">
            Toplam: ₺${order.toplam || order.total}
          </div>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #6366f1; margin-bottom: 15px;">Teslimat Adresi</h3>
          <p>${order.shippingAddress?.fullName || order.firmaAdi}<br>
          ${order.shippingAddress?.phone || order.telefon}<br>
          ${order.shippingAddress?.address || order.adres}<br>
          ${order.shippingAddress?.district || ''} / ${order.shippingAddress?.city || ''}</p>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
          Siparişlerinizi <a href="https://tedarikci.org.tr/siparisler.html" style="color: #6366f1;">buradan</a> takip edebilirsiniz.
        </p>
      </div>
    </div>
  `;
  
  return await sendEmail(toEmail, subject, htmlContent);
}

/* ======================================================
   ✅ AUTH ROUTES
====================================================== */

/* ---------- Register (Kayıt Ol) - GÜNCELLENMİŞ ---------- */
app.post("/api/auth/register", async (req, res) => {
   // ✅ EN BAŞTA - KESİNLİKLE ÇALIŞMALİ
  console.log("========================================");
  console.log("🚨 REGISTER ENDPOINT ÇAĞRILDI:", new Date().toISOString());
  console.log("📧 Email:", req.body?.email);
  console.log("📱 Telefon:", req.body?.telefon);
  console.log("🏢 Firma:", req.body?.firma);
  console.log("========================================");
  try {
    const { 
      ad, email, password, telefon, uyelikTipi,
      firma, vergiNo, vergiDairesi, tcNo,
      faturaAdresi, teslimatAdresi, city, district
    } = req.body;

    // Email kontrolü
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Bu email zaten kayıtlı" });
    }

    // Şifreyi hashle
    const hashed = await bcrypt.hash(password, 10);

    // Adres array'ini oluştur (kayıt formundan gelen obje yapısı)
    const addresses = [];
    const faturaObj = (faturaAdresi && typeof faturaAdresi === 'object') ? faturaAdresi : null;
    const teslimatObj = (teslimatAdresi && typeof teslimatAdresi === 'object') ? teslimatAdresi : null;

    if (faturaObj) {
      addresses.push({
        baslik: faturaObj.baslik || "Fatura Adresi",
        adSoyad: ad,
        telefon: telefon || "",
        sehir: faturaObj.sehir || city || "İstanbul",
        ilce: faturaObj.ilce || district || "",
        mahalle: faturaObj.mahalle || "",
        sokak: faturaObj.sokak || "",
        postaKodu: faturaObj.postaKodu || "",
        acikAdres: faturaObj.acikAdres || "",
        tip: 'fatura',
        varsayilan: true
      });
    }
    if (teslimatObj && JSON.stringify(teslimatObj) !== JSON.stringify(faturaObj)) {
      addresses.push({
        baslik: teslimatObj.baslik || "Teslimat Adresi",
        adSoyad: ad,
        telefon: telefon || "",
        sehir: teslimatObj.sehir || city || "İstanbul",
        ilce: teslimatObj.ilce || district || "",
        mahalle: teslimatObj.mahalle || "",
        sokak: teslimatObj.sokak || "",
        postaKodu: teslimatObj.postaKodu || "",
        acikAdres: teslimatObj.acikAdres || (faturaObj?.acikAdres || ""),
        tip: 'teslimat',
        varsayilan: false
      });
    } else if (faturaObj && addresses.length) {
      addresses.push({
        baslik: "Teslimat Adresi",
        adSoyad: ad,
        telefon: telefon || "",
        sehir: faturaObj.sehir || city || "İstanbul",
        ilce: faturaObj.ilce || district || "",
        mahalle: faturaObj.mahalle || "",
        sokak: faturaObj.sokak || "",
        postaKodu: faturaObj.postaKodu || "",
        acikAdres: faturaObj.acikAdres || "",
        tip: 'teslimat',
        varsayilan: false
      });
    }

    // Kullanıcı oluştur - faturaAdresi ve teslimatAdresi objeleri (profil sayfası için)
    const newUser = await User.create({
      ad,
      email,
      password: hashed,
      telefon: telefon || "",
      uyelikTipi: uyelikTipi || 'bireysel',
      rol: 'user',
      firma: firma || "",
      vergiNo: vergiNo || "",
      vergiDairesi: vergiDairesi || "",
      tcNo: tcNo || "",
      faturaAdresi: faturaObj || (typeof faturaAdresi === 'string' ? { acikAdres: faturaAdresi, sehir: city, ilce: district } : {}),
      teslimatAdresi: teslimatObj || faturaObj || (typeof teslimatAdresi === 'string' ? { acikAdres: teslimatAdresi, sehir: city, ilce: district } : {}),
      addresses: addresses
    });

   // Hoşgeldin emaili gönder
sendWelcomeEmail(email, ad, uyelikTipi || 'bireysel').catch(err => {
  console.log("Hoşgeldin emaili gönderilemedi:", err.message);
});

// ✅ ERP'ye Cari Aktarımı (GÜNCELLENMİŞ - Detaylı Log)
console.log('========== ERP AKTARIM BAŞLADI ==========');
console.log('🔄 ERP aktarımı başlıyor...');
console.log('📋 ERP_BASE_URL:', process.env.ERP_BASE_URL || 'TANIMLI DEĞİL!');
console.log('📋 Kullanıcı:', newUser.email, '| Tip:', newUser.uyelikTipi);

try {
  const erpData = {
    ad: newUser.ad,
    email: newUser.email,
    telefon: newUser.telefon,
    firma: newUser.firma,
    vergiNo: newUser.vergiNo,
    vergiDairesi: newUser.vergiDairesi,
    tcNo: newUser.tcNo,
    faturaAdresi: newUser.faturaAdresi,
    teslimatAdresi: newUser.teslimatAdresi,
    uyelikTipi: newUser.uyelikTipi,
    city: newUser.addresses?.[0]?.city || "İstanbul",
    district: newUser.addresses?.[0]?.district || ""
  };
  
  console.log('📤 ERP\'ye gönderilen data:', JSON.stringify(erpData, null, 2));
  
  const erpResult = await createCariInERP(erpData);
  
  console.log('📥 ERP Sonuç:', JSON.stringify(erpResult, null, 2));
  
  if (erpResult.success) {
    newUser.erpSynced = true;
    newUser.erpCariId = erpResult.cariId;
    newUser.erpSyncDate = new Date();
    await newUser.save();
    console.log("✅ Kullanıcı ERP'ye aktarıldı - Cari ID:", erpResult.cariId);
  } else {
    console.error("⚠️ ERP aktarım başarısız - Hata:", erpResult.error);
    console.error("⚠️ Hata Detayı:", JSON.stringify(erpResult, null, 2));
  }
} catch (erpErr) {
  console.error("❌ ERP HATA (Exception):", erpErr.message);
  console.error("❌ Stack Trace:", erpErr.stack);
  if (erpErr.response) {
    console.error("❌ HTTP Status:", erpErr.response.status);
    console.error("❌ HTTP Data:", JSON.stringify(erpErr.response.data, null, 2));
  }
}
console.log('========== ERP AKTARIM BİTTİ ==========');

// ✅ Token üret
const token = jwt.sign(
  {
    userId: newUser._id,
    email: newUser.email,
    rol: newUser.rol
  },
  JWT_SECRET,
  { expiresIn: "24h" }
);

    // ✅ Artık sadece userId değil, token + user dönüyoruz
    res.json({
      success: true,
      message: "Kayıt başarılı! Hoş geldiniz.",
      token,
      user: {
        id: newUser._id,
        ad: newUser.ad,
        email: newUser.email,
        rol: newUser.rol,
        uyelikTipi: newUser.uyelikTipi,
        telefon: newUser.telefon,
        firma: newUser.firma,
        vergiNo: newUser.vergiNo,
        vergiDairesi: newUser.vergiDairesi,
        tcNo: newUser.tcNo,
        faturaAdresi: newUser.faturaAdresi,
        teslimatAdresi: newUser.teslimatAdresi,
        addresses: newUser.addresses || [],
        erpSynced: newUser.erpSynced,
        erpCariId: newUser.erpCariId
      }
    });

  } catch (err) {
    console.error("Register hatası:", err);
    res.status(500).json({ success: false, message: "Kayıt sırasında hata: " + err.message });
  }
});

/* ---------- Login (Giriş Yap) ---------- */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Email veya şifre yanlış" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      if (user.googleId || user.facebookId || user.instagramId) {
        return res.status(400).json({
          success: false,
          message: "Bu hesap sosyal giriş ile kayıtlı (Google, Facebook veya Instagram). Lütfen ilgili yöntemi kullanın.",
        });
      }
      return res.status(400).json({ success: false, message: "Email veya şifre yanlış" });
    }

   const token = jwt.sign(
  {
    userId: user._id,
    email: user.email,
    rol: user.rol
  },
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
        telefon: user.telefon,
        firma: user.firma,
        vergiNo: user.vergiNo,
        vergiDairesi: user.vergiDairesi,
        tcNo: user.tcNo,
        faturaAdresi: user.faturaAdresi,
        teslimatAdresi: user.teslimatAdresi,
        addresses: user.addresses || []
      },
    });
  } catch (err) {
    console.error("Login hatası:", err);
    res.status(500).json({ success: false, message: "Giriş hatası: " + err.message });
  }
});

/* ---------- Profil Getir ---------- */
app.get("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
.select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        ad: user.ad,
        email: user.email,
        rol: user.rol,
        uyelikTipi: user.uyelikTipi,
        telefon: user.telefon,
        firma: user.firma,
        vergiNo: user.vergiNo,
        vergiDairesi: user.vergiDairesi,
        tcNo: user.tcNo,
        faturaAdresi: user.faturaAdresi,
        teslimatAdresi: user.teslimatAdresi,
        addresses: user.addresses || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Profil hatası: " + err.message });
  }
});

/* ---------- Forgot Password ---------- */
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ success: true, message: "Eğer kayıtlıysa kod gönderildi" });
  }

  const kod = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes.set(email, { kod, expiry: Date.now() + 900000 });

  const sent = await sendResetEmail(email, kod, user.ad);
  if (!sent) {
    return res.status(500).json({ success: false, message: "Mail gönderilemedi" });
  }

  res.json({ success: true, message: "Kod mail ile gönderildi" });
});

/* ---------- Reset Password ---------- */
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const data = resetCodes.get(email);
    if (!data || data.kod !== code) {
      return res.status(400).json({ success: false, message: "Kod hatalı" });
    }

    if (Date.now() > data.expiry) {
      return res.status(400).json({ success: false, message: "Kod süresi doldu" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email }, { $set: { password: hashed } });
    resetCodes.delete(email);

    res.json({ success: true, message: "Şifre güncellendi" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Reset hatası: " + err.message });
  }
});

/* ======================================================
   ✅ ADRES ROUTES (YENİ)
====================================================== */

/* ---------- Tüm Adresleri Getir ---------- */
app.get("/api/addresses", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }
    
    // Eğer addresses boşsa ama eski adres alanları doluysa, onları çevir
    let addresses = user.addresses || [];
    
    if (addresses.length === 0 && (user.faturaAdresi || user.teslimatAdresi)) {
      // Eski adresleri yeni formata çevir
      if (user.faturaAdresi) {
        addresses.push({
          _id: 'addr_old_1',
          title: "Fatura Adresi",
          fullName: user.ad,
          phone: user.telefon || "",
          city: "İstanbul",
          district: "",
          address: user.faturaAdresi,
          isDefault: true
        });
      }
      if (user.teslimatAdresi && user.teslimatAdresi !== user.faturaAdresi) {
        addresses.push({
          _id: 'addr_old_2',
          title: "Teslimat Adresi",
          fullName: user.ad,
          phone: user.telefon || "",
          city: "İstanbul",
          district: "",
          address: user.teslimatAdresi,
          isDefault: false
        });
      }
    }
    
    res.json({ 
      success: true, 
      addresses: addresses 
    });
  } catch (error) {
    console.error('Adres getirme hatası:', error);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

/* ---------- Yeni Adres Ekle ---------- */
app.post("/api/addresses", authenticateToken, async (req, res) => {
  try {
    const { title, fullName, phone, city, district, address, isDefault } = req.body;
    
    if (!fullName || !phone || !city || !district || !address) {
      return res.status(400).json({ success: false, message: "Tüm alanlar zorunludur" });
    }

    const user = await User.findById(req.userId);

    
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const newAddress = {
      title: title || "Yeni Adres",
      fullName,
      phone,
      city,
      district,
      address,
      isDefault: isDefault || false
    };

    if (newAddress.isDefault && user.addresses) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    if (!user.addresses) user.addresses = [];
    
    user.addresses.push(newAddress);
    await user.save();

    res.json({ 
      success: true, 
      message: "Adres eklendi",
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Adres ekleme hatası:', error);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

/* ---------- Adres Sil ---------- */
app.delete("/api/addresses/:index", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const index = parseInt(req.params.index);
    if (user.addresses && user.addresses[index]) {
      user.addresses.splice(index, 1);
      await user.save();
    }

    res.json({ success: true, message: "Adres silindi", addresses: user.addresses });
  } catch (error) {
    console.error('Adres silme hatası:', error);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

/* ======================================================
   ✅ Public Static Dosyalar
====================================================== */
// ==================== PUBLIC PATH (FINAL FIX) ====================
const publicPath = path.join(__dirname, "..", "public");

// Static dosyaları buradan servis et
app.use(express.static(publicPath));


/* ======================================================
   ✅ HTML Sayfa Route Garantisi
====================================================== */
const htmlPages = ['index', 'sepet', 'profil', 'odeme', 'siparisler', 'giris', 'kayit', 'sifremi-unuttum', 'hakkimizda', 'hizmetlerimiz', 'urunler', 'referanslarimiz', 'iletisim', 'teklif-al', 'destek-sorularim', 'kargo-takip'];
htmlPages.forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(publicPath, `${page}.html`));
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

/* ======================================================
   ✅ 404 - Bulunamayan route (API ve sayfa)
====================================================== */
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "Endpoint bulunamadı" });
  }
  res.status(404).sendFile(path.join(publicPath, "index.html"));
});

/* ======================================================
   ✅ Merkezi hata middleware (son sırada)
====================================================== */
app.use((err, req, res, next) => {
  console.error("[HATA]", err.message);
  if (process.env.NODE_ENV === "production") {
    res.status(500).json({ success: false, message: "Bir hata oluştu." });
  } else {
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});

// ==================== TAXTEN OTOMATIK SENKRONIZASYON ====================
const cron = require('node-cron');
const TaxtenService = require('./services/taxtenService');

// Her 4 saatte bir fatura durumlarını senkronize et
cron.schedule('0 */4 * * *', async () => {
  console.log('[CRON] Taxten fatura durumları senkronize ediliyor...');
  
  try {
    const Fatura = require('./models/Fatura');
    const taxtenService = new TaxtenService();
    
    const birGunOnce = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const faturalar = await Fatura.find({
      durum: { $in: ['GÖNDERİLDİ', 'BEKLİYOR'] },
      taxtenGonderimTarihi: { $gte: birGunOnce }
    }).select('uuid envUUID _id');
    
    for (const fatura of faturalar) {
      try {
        const statusResult = await taxtenService.getInvoiceStatus(fatura.envUUID, fatura.uuid);
        
        if (statusResult.success) {
          const code = statusResult.data.ResponseCode;
          let yeniDurum = fatura.durum;
          
          if (code === '1300') yeniDurum = '1300-BAŞARILI';
          else if (code.startsWith('1')) yeniDurum = 'BEKLİYOR';
          else yeniDurum = 'HATA';
          
          await Fatura.findByIdAndUpdate(fatura._id, {
            durum: yeniDurum,
            sistemYanitKodu: code,
            sistemYanitAciklama: taxtenService.getStatusDescription(code),
            sonGuncelleme: new Date()
          });
          
          console.log(`[CRON] Fatura ${fatura._id} durumu: ${yeniDurum} (${code})`);
        }
      } catch (err) {
        console.error(`[CRON] Fatura ${fatura._id} hata:`, err.message);
      }
    }
    
    console.log(`[CRON] ${faturalar.length} fatura kontrol edildi`);
    
  } catch (error) {
    console.error('[CRON] Genel hata:', error);
  }
});

console.log('[CRON] Taxten senkronizasyon zamanlayıcısı aktif (her 4 saat)');
/* ======================================================
   ✅ Server Start
====================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server çalışıyor: http://localhost:" + PORT);
});