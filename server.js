// 1) HER ŞEYDEN ÖNCE
require("dotenv").config();

// (İsteğe bağlı) Sadece var mı diye kontrol et, secret'ı basma!
console.log("ENV OK:", {
  MONGODB_URI: !!process.env.MONGODB_URI,
  JWT_SECRET: !!process.env.JWT_SECRET,
  SMTP_HOST: !!process.env.SMTP_HOST,
});

// 2) Sonra importlar
const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const SibApiV3Sdk = require("sib-api-v3-sdk");  // ✅ EKLENDİ

// Modeller
const User = require("./models/User");
const Order = require("./models/Order");

const app = express();

/* ======================================================
   ✅ MongoDB Bağlantısı
====================================================== */
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/kurumsal-tedarikci";

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB bağlandı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

/* ======================================================
   ✅ JWT Secret
====================================================== */
const JWT_SECRET = process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";

/* ======================================================
   ✅ Middleware
====================================================== */
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5500", "https://tedarikci.org.tr", "https://www.tedarikci.org.tr"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================== ROUTES =====================
// Önce route'ları import et
const authRoutes = require("./routes/auth");
const addressRoutes = require("./routes/addresses");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const productRoutes = require("./routes/products");


// Sonra kullan
app.use("/api/auth", authRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);

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
      email: process.env.SMTP_FROM_EMAIL || "info@tedarikci.org.tr",
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

    // Adres array'ini oluştur
    const addresses = [];
    
    // Fatura adresi varsa ekle
    if (faturaAdresi) {
      addresses.push({
        title: "Fatura Adresi",
        fullName: ad,
        phone: telefon || "",
        city: city || "İstanbul",
        district: district || "",
        address: faturaAdresi,
        isDefault: true
      });
    }
    
    // Teslimat adresi varsa ve faturadan farklıysa ekle
    if (teslimatAdresi && teslimatAdresi !== faturaAdresi) {
      addresses.push({
        title: "Teslimat Adresi",
        fullName: ad,
        phone: telefon || "",
        city: city || "İstanbul",
        district: district || "",
        address: teslimatAdresi,
        isDefault: false
      });
    }

    // Kullanıcı oluştur
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
      faturaAdresi: faturaAdresi || "",
      teslimatAdresi: teslimatAdresi || faturaAdresi || "",
      addresses: addresses
    });

   // Hoşgeldin emaili gönder
sendWelcomeEmail(email, ad, uyelikTipi || 'bireysel').catch(err => {
  console.log("Hoşgeldin emaili gönderilemedi:", err.message);
});

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
    addresses: newUser.addresses || []
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
   ✅ ORDERS ROUTES (GÜNCELLENMİŞ)
====================================================== */

/* ---------- Sipariş Oluştur (Ödeme Sayfası İçin) ---------- */
app.post("/api/orders", authenticateToken, async (req, res) => {
  try {
    const { items, shippingAddressId, invoiceAddressId, paymentMethod, subtotal, total } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Sepet boş" });
    }

   const user = await User.findById(req.userId);

    
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Adres ID'si index veya string olabilir
    let shippingAddress, invoiceAddress;
    
    if (shippingAddressId && shippingAddressId.startsWith('addr_old_')) {
      // Eski adres formatı
      shippingAddress = {
        title: user.faturaAdresi === user.teslimatAdresi ? "Fatura/Teslimat" : "Teslimat",
        fullName: user.ad,
        phone: user.telefon || "",
        city: "İstanbul",
        district: "",
        address: user.teslimatAdresi || user.faturaAdresi
      };
    } else {
      // Yeni adres formatı - index olarak kullan
      const addrIndex = parseInt(shippingAddressId) || 0;
      shippingAddress = user.addresses[addrIndex] || user.addresses[0] || {
        title: "Varsayılan",
        fullName: user.ad,
        phone: user.telefon || "",
        city: "İstanbul",
        district: "",
        address: user.faturaAdresi || ""
      };
    }

    // Fatura adresi
    if (invoiceAddressId === shippingAddressId || !invoiceAddressId) {
      invoiceAddress = shippingAddress;
    } else if (invoiceAddressId && invoiceAddressId.startsWith('addr_old_')) {
      invoiceAddress = {
        title: "Fatura",
        fullName: user.ad,
        phone: user.telefon || "",
        city: "İstanbul",
        district: "",
        address: user.faturaAdresi || ""
      };
    } else {
      const invIndex = parseInt(invoiceAddressId) || 0;
      invoiceAddress = user.addresses[invIndex] || shippingAddress;
    }

    // Toplam tutarı parse et
    let totalAmount = 0;
    if (typeof total === 'string') {
      totalAmount = parseFloat(total.replace('₺', '').replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      totalAmount = parseFloat(total) || 0;
    }

    // Sipariş verilerini hazırla
    const orderData = {
      firmaAdi: user.firma || user.ad,
      email: user.email,
      telefon: user.telefon,
      adres: `${shippingAddress.address}, ${shippingAddress.district}/${shippingAddress.city}`,
      items: items.map(item => ({
        ad: item.name || item.ad,
        fiyat: parseFloat(item.price || item.fiyat || 0),
        adet: parseInt(item.qty || item.adet || 1)
      })),
      toplam: totalAmount,
      odemeYontemi: paymentMethod === 'card' ? 'Kredi Kartı' : paymentMethod === 'transfer' ? 'Havale/EFT' : 'Kapıda Ödeme',
      not: '',
      status: "Yeni",
      userId: user._id,
      shippingAddress: shippingAddress,
      invoiceAddress: invoiceAddress,
      paymentMethod: paymentMethod,
      createdAt: new Date()
    };

    const newOrder = await Order.create(orderData);

    // Sipariş onay emaili gönder
    sendOrderConfirmationEmail(user.email, orderData, user.ad).catch(err => {
      console.log("Sipariş emaili gönderilemedi:", err.message);
    });

    res.json({ 
      success: true, 
      message: "Sipariş oluşturuldu",
      orderId: newOrder._id
    });
  } catch (error) {
    console.error('Sipariş oluşturma hatası:', error);
    res.status(500).json({ success: false, message: "Sipariş oluşturulamadı: " + error.message });
  }
});

/* ---------- Eski Sipariş Oluştur (Geriye Uyumluluk) ---------- */
app.post("/api/orders/create", authenticateToken, async (req, res) => {
  try {
    const { firmaAdi, email, telefon, adres, items, odemeYontemi, not } = req.body;

    if (!firmaAdi || !email || !items?.length) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const toplam = items.reduce((sum, item) => sum + (item.fiyat * item.adet), 0);

    const newOrder = await Order.create({
      firmaAdi,
      email,
      telefon,
      adres,
      items,
      toplam,
      odemeYontemi: odemeYontemi || 'card',
      not: not || '',
      status: "Yeni",
      tarih: new Date(),
      userId: req.user.userId
    });

    res.json({
      success: true,
      message: "Sipariş kaydedildi",
      orderId: newOrder._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Sipariş hatası: " + err.message });
  }
});

/* ---------- Kullanıcının Siparişlerini Getir ---------- */
app.get("/api/orders/my", authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { email: req.user.email },
        { userId: req.user.userId }
      ]
    }).sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Siparişler alınamadı: " + err.message
    });
  }
});


/* ---------- Tüm Siparişleri Getir (Admin Panel) ---------- */
app.get("/api/orders", authenticateToken, async (req, res) => {
  try {

    // ✅ Admin token kontrolü
    // Admin login tokenı: { role: "admin" }
    // User login tokenı: { userId, rol }

    const isAdmin =
      req.user.rol === "admin" || req.user.role === "admin";

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Yetkisiz erişim (Admin gerekli)"
      });
    }

    // ✅ Admin ise tüm siparişleri getir
    const orders = await Order.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      orders
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Siparişler alınamadı: " + err.message
    });
  }
});

/* ---------- Sipariş Durum Güncelle (Admin) ---------- */
app.put("/api/orders/:orderId/status", authenticateToken, async (req, res) => {
  try {
    // ✅ Admin kontrol
    const isAdmin =
      req.user.rol === "admin" || req.user.role === "admin";

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Yetkisiz erişim (Admin gerekli)",
      });
    }

    // ✅ Yeni status al
    const { status } = req.body;

    const allowedStatuses = [
      "Yeni",
      "Hazırlanıyor",
      "Kargoya Verildi",
      "Teslim Edildi",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz durum",
      });
    }

    // ✅ Siparişi güncelle
    const order = await Order.findByIdAndUpdate(
      req.params.orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı",
      });
    }

    res.json({
      success: true,
      message: "Sipariş durumu güncellendi ✅",
      order,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Durum güncelleme hatası: " + err.message,
    });
  }
});




/* ---------- Tek Sipariş Detayı ---------- */
app.get("/api/orders/:orderId", authenticateToken, async (req, res) => {
  try {

    const isAdmin =
      req.user.rol === "admin" || req.user.role === "admin";

    let order;

    if (isAdmin) {
      // ✅ Admin tüm siparişleri görebilir
      order = await Order.findById(req.params.orderId);
    } else {
      // ✅ Normal kullanıcı sadece kendi siparişini görür
      order = await Order.findOne({
        _id: req.params.orderId,
        $or: [
          { email: req.user.email },
          { userId: req.user.userId }
        ]
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı"
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (err) {
     console.error("KARGO HATA DETAYI:", err);  // ✅ BU SATIRI EKLE
    res.status(500).json({
      success: false,
      message: "Sipariş detay hatası: " + err.message
    });
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
const htmlPages = ['index', 'sepet', 'profil', 'odeme', 'siparisler', 'giris', 'kayit', 'sifremi-unuttum', 'hakkimizda', 'hizmetlerimiz', 'urunler', 'referanslarimiz', 'iletisim', 'teklif-al'];
htmlPages.forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(publicPath, `${page}.html`));
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

/* ======================================================
   ✅ Server Start
====================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server çalışıyor: http://localhost:" + PORT);
});