require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const path = require("path");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

const app = express();

/* ======================================================
   ✅ MongoDB Bağlantısı
====================================================== */
const mongoUri =
  process.env.MONGODB_URI || "mongodb://localhost:27017/kurumsal-tedarikci";

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB bağlandı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

/* ======================================================
   ✅ User Model Import (Yeni Sistem)
====================================================== */
const User = require("./models/User");

/* ======================================================
   ✅ CORS Ayarları
====================================================== */
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5500",
    "https://kurumsal-final.vercel.app",
    "https://kurumsal-tedarikci.onrender.com",
    "https://www.tedarikci.org.tr",
    "https://tedarikci.org.tr",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

/* ======================================================
   ✅ Body Parser
====================================================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   ✅ Static Dosyalar
====================================================== */
app.use(express.static(path.join(__dirname, "..", "public")));

/* ======================================================
   ✅ Brevo API Setup
====================================================== */
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

/* ======================================================
   ✅ Reset Kodları (Geçici)
====================================================== */
const resetCodes = new Map();

/* ======================================================
   ✅ JWT Secret
====================================================== */
const JWT_SECRET =
  process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";


// MAIL GÖNDERİM FONKSİYONU (Brevo API ile - SMTP yerine)
async function sendResetEmail(toEmail, kod, userName) {
    try {
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        
        sendSmtpEmail.subject = "Şifre Sıfırlama Kodunuz - Kurumsal Tedarikçi";
        sendSmtpEmail.htmlContent = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f9fafb; border-radius: 10px;">
                <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #6366f1; margin: 0; font-size: 28px;">Kurumsal Tedarikçi</h1>
                        <div style="width: 50px; height: 4px; background: #6366f1; margin: 10px auto; border-radius: 2px;"></div>
                    </div>
                    
                    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 20px;">Şifre Sıfırlama İsteği</h2>
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Merhaba <strong>${userName}</strong>,</p>
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki 6 haneli kodu kullanarak şifrenizi sıfırlayabilirsiniz:</p>
                    
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 25px; text-align: center; border-radius: 10px; margin: 30px 0;">
                        <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px; font-family: monospace;">${kod}</span>
                    </div>
                    
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <p style="color: #92400e; font-size: 14px; margin: 0;"><i style="margin-right: 8px;">⏱️</i> Bu kod <strong>15 dakika</strong> içinde geçerlidir.</p>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">Eğer bu talebi siz yapmadıysanız, lütfen bu e-postayı dikkate almayın. Hesabınız güvende olmaya devam edecektir.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                        Kurumsal Tedarikçi | ${process.env.SMTP_FROM_EMAIL || 'yildirimtarhan@tedarikci.org.tr'}<br>
                        Bu e-posta otomatik olarak gönderilmiştir, lütfen yanıtlamayınız.
                    </p>
                </div>
            </div>
        `;
        sendSmtpEmail.textContent = `Şifre sıfırlama kodunuz: ${kod}. Bu kod 15 dakika içinde geçerlidir.`;
        sendSmtpEmail.sender = { 
            name: process.env.SMTP_FROM_NAME || 'Kurumsal Tedarikci', 
            email: process.env.SMTP_FROM_EMAIL || 'yildirimtarhan@tedarikci.org.tr'
        };
        sendSmtpEmail.to = [{ email: toEmail }];
        sendSmtpEmail.replyTo = { email: process.env.NOTIFY_EMAIL || 'iletisim@tedarikci.org.tr' };
        
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ Mail gönderildi: ${toEmail} (Message ID: ${data.messageId})`);
        return true;
    } catch (error) {
        console.error('❌ Mail gönderim hatası:', error.message);
        if (error.response && error.response.text) {
            console.error('Brevo API Hatası:', error.response.text);
        }
        return false;
    }
}

// ADMIN MIDDLEWARE - Token doğrulama
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token gerekli' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gizli-anahtar');
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Yetkisiz erişim' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// ADMIN GİRİŞ (İlk admin için MongoDB'ye elle ekleme yapmalısın)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Bağlantı kontrolü eklendi
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ error: 'Veritabanına bağlanılamadı' });
    }
    
    // DÜZELTİLDİ: mongoose.connection.db.collection kullanıldı
    const admin = await mongoose.connection.db.collection('admins').findOne({ username });
    
    if (!admin || !await bcrypt.compare(password, admin.password)) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }
    
    const token = jwt.sign(
      { id: admin._id, username: admin.username, isAdmin: true },
      process.env.JWT_SECRET || 'gizli-anahtar',
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { username: admin.username } });
  } catch (err) {
    console.error('Admin login hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

// DASHBOARD İSTATİSTİKLERİ
app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    // DÜZELTİLDİ
    const totalUsers = await mongoose.connection.db.collection('users').countDocuments();
    const todayOrders = await mongoose.connection.db.collection('orders').countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
    });
    const pendingOrders = await mongoose.connection.db.collection('orders').countDocuments({ status: 'pending' });
    
    res.json({
      stats: {
        totalUsers,
        todayOrders,
        pendingOrders,
        totalRevenue: 0 // Sonra hesaplanacak
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KULLANICI LİSTESİ (ERP'ye aktarılmamışlar)
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    // DÜZELTİLDİ
    const users = await mongoose.connection.db.collection('users').find().toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ERP ENTEGRASYONU - Cari Hesap Oluşturma
app.post('/api/admin/sync-cari', adminAuth, async (req, res) => {
  const { userId } = req.body;
  
  try {
    // DÜZELTİLDİ
    const user = await mongoose.connection.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    
    // ERP'nize istek at
    const erpResponse = await fetch('http://localhost:3001/api/cari/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': process.env.ERP_API_KEY // Environment variable olarak tanımla
      },
      body: JSON.stringify({
        ad: user.firmaAdi || user.ad,
        email: user.email,
        telefon: user.telefon,
        kaynak: 'web'
      })
    });
    
    if (erpResponse.ok) {
      // DÜZELTİLDİ
      await mongoose.connection.db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { erpSynced: true, erpSyncDate: new Date() } }
      );
      res.json({ success: true, message: 'ERP\'ye aktarıldı' });
    } else {
      throw new Error('ERP API hatası');
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÜRÜN LİSTESİ (ERP'den çek)
app.get('/api/admin/erp-products', adminAuth, async (req, res) => {
  try {
    const response = await fetch('http://localhost:3001/pages/api/sales', {
      headers: { 'x-api-key': process.env.ERP_API_KEY }
    });
    const products = await response.json();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'ERP bağlantı hatası' });
  }
});

// SİPARİŞ OLUŞTURMA ve ERP'ye Gönderme
app.post('/api/admin/create-order', adminAuth, async (req, res) => {
  const { userId, items, total } = req.body;
  
  try {
    // 1. MongoDB'ye kaydet - DÜZELTİLDİ
    const order = await mongoose.connection.db.collection('orders').insertOne({
      userId: new ObjectId(userId),
      items,
      total,
      status: 'pending',
      createdAt: new Date()
    });
    
    // 2. ERP'ye gönder
    const erpResponse = await fetch('http://localhost:3001/pages/api/satis/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ERP_API_KEY
      },
      body: JSON.stringify({
        cariId: userId, // Veya ERP cari kodu
        items,
        total,
        kaynak: 'web-sitesi'
      })
    });
    
    if (erpResponse.ok) {
      // DÜZELTİLDİ
      await mongoose.connection.db.collection('orders').updateOne(
        { _id: order.insertedId },
        { $set: { erpOrderId: (await erpResponse.json()).id, status: 'completed' } }
      );
    }
    
    res.json({ success: true, orderId: order.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API ROUTES

// 1. Kayıt Ol
app.post("/api/auth/register", async (req, res) => {
  try {
    const { ad, email, password, firma, telefon } = req.body;

    // 1) Email zaten var mı?
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Bu e-posta adresi zaten kayıtlı",
      });
    }

    // 2) Şifre hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3) MongoDB’ye yeni kullanıcı oluştur
    const newUser = await User.create({
      ad,
      email,
      password: hashedPassword,
      firma: firma || "",
      telefon: telefon || "",
    });

    console.log("✅ Yeni kullanıcı kaydedildi:", email);

    // 4) Response dön
    res.json({
      success: true,
      message: "Kayıt başarılı",
      userId: newUser._id,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});

// 2. Giriş Yap
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) MongoDB’den kullanıcıyı bul
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "E-posta veya şifre hatalı",
      });
    }

    // 2) Şifre doğrula
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "E-posta veya şifre hatalı",
      });
    }

    // 3) JWT Token oluştur
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 4) Response dön
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        ad: user.ad,
        email: user.email,
        firma: user.firma,
        telefon: user.telefon,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});


// 3. Şifre Sıfırlama - Kod Gönder
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // 1) MongoDB’den kullanıcıyı bul
    const user = await User.findOne({ email });

    // Güvenlik: kullanıcı yoksa bile başarılı dön
    if (!user) {
      return res.json({
        success: true,
        message: "Eğer bu e-posta kayıtlıysa kod gönderildi",
      });
    }

    // 2) 6 haneli kod oluştur
    const kod = Math.floor(100000 + Math.random() * 900000).toString();

    // 3) Kodu sakla (15 dakika)
    resetCodes.set(email, {
      kod,
      userId: user._id,
      expiry: Date.now() + 900000,
    });

    console.log("📩 Reset kodu üretildi:", email, kod);

    // 4) Brevo ile mail gönder
    const sent = await sendResetEmail(email, kod, user.ad);

    if (!sent) {
      return res.status(500).json({
        success: false,
        message: "E-posta gönderilemedi, lütfen tekrar deneyin",
      });
    }

    res.json({
      success: true,
      message: "Doğrulama kodu e-posta adresinize gönderildi",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});

// 4. Kod Doğrulama
app.post('/api/auth/verify-code', (req, res) => {
    try {
        const { email, code } = req.body;
        const data = resetCodes.get(email);
        
        if (!data || data.kod !== code) {
            return res.status(400).json({ success: false, message: 'Hatalı doğrulama kodu' });
        }
        
        if (Date.now() > data.expiry) {
            resetCodes.delete(email);
            return res.status(400).json({ success: false, message: 'Kod süresi dolmuş, lütfen yeni kod talep edin' });
        }
        
        // Geçici reset token oluştur
        const resetToken = jwt.sign(
            { email, userId: data.userId, type: 'password-reset' }, 
            JWT_SECRET, 
            { expiresIn: '15m' }
        );
        
        res.json({ success: true, resetToken });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// 5. Yeni Şifre Kaydetme
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    // 1) Eksik alan kontrolü
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, token ve yeni şifre zorunludur",
      });
    }

    // 2) Token doğrula
    const decoded = jwt.verify(resetToken, JWT_SECRET);

    if (decoded.email !== email || decoded.type !== "password-reset") {
      return res.status(400).json({
        success: false,
        message: "Geçersiz veya süresi dolmuş token",
      });
    }

    // 3) Şifreyi hashle
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4) MongoDB’de kullanıcıyı güncelle
    const result = await User.updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    // 5) Reset kodunu temizle
    resetCodes.delete(email);

    console.log("✅ Şifre sıfırlandı:", email);

    res.json({
      success: true,
      message: "Şifreniz başarıyla güncellendi",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        success: false,
        message: "İşlem süresi dolmuş, lütfen tekrar deneyin",
      });
    }

    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});

// 6. Profil Şifre Değiştirme
app.post('/api/auth/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Yetkisiz erişim' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const { currentPassword, newPassword } = req.body;
        
        const user = users.find(u => u.id === decoded.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
        }
        
        // Mevcut şifreyi kontrol et
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mevcut şifreniz hatalı' });
        }
        
        // Yeni şifreyi kaydet
        user.password = await bcrypt.hash(newPassword, 10);
        
        res.json({ success: true, message: 'Şifreniz başarıyla güncellendi' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Oturum süresi dolmuş, lütfen tekrar giriş yapın' });
        }
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// 7. Token Doğrulama
app.get('/api/auth/verify', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token bulunamadı' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = users.find(u => u.id === decoded.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
        }
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                ad: user.ad, 
                email: user.email, 
                firma: user.firma 
            } 
        });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Geçersiz token' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Sayfa bulunamadı' });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;

// =====================================================
// SİPARİŞ OLUŞTUR (WEB) -> MongoDB'ye kaydet -> ERP'ye gönder
// Endpoint: POST /api/order/create
// Not: ERP multi-tenant olduğu için, ERP'ye sipariş göndermek için
//      siparişi oluşturan kullanıcının JWT token'ı kullanılır.
// =====================================================
app.post("/api/order/create", async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    // Kullanıcı token al (web login token'ı)
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Giriş yapmanız gerekiyor (token yok)." });
    }

    // Token doğrula (multi-tenant: companyId token içinden gelir)
    const decoded = jwt.verify(token, JWT_SECRET);

    const email = normalizeEmail(req.body?.email);
    const firma = String(req.body?.firma || "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const total = Number(req.body?.total || 0);

    if (!items.length) {
      return res.status(400).json({ success: false, message: "Sepet boş." });
    }

    // Sipariş kaydı (orders collection otomatik oluşur)
    const orderDoc = {
      userId: new ObjectId(decoded.id),
      companyId: decoded.companyId || null,
      email,
      firma,
      items: items.map(it => ({
        productId: it.productId || it.id || null,
        title: it.title || it.name || "Ürün",
        qty: Number(it.qty || 1),
        price: Number(it.price || 0)
      })),
      total,
      status: "pending",
      erpSync: false,
      erpSaleNo: null,
      // Admin panelden "Tekrar Dene" için (token expire olursa yeniden login gerekir)
      erpForwardToken: token,
      erpForwardTokenExp: decoded.exp ? new Date(decoded.exp * 1000) : null,
      lastErpError: null,
      createdAt: new Date()
    };

    const orderResult = await mongoose.connection.db.collection("orders").insertOne(orderDoc);
    const orderId = orderResult.insertedId;

    // ERP'ye satış gönder (kullanıcının token'ı ile)
    const erpResp = await fetch("https://satistakip.online/api/satis/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        orderId: String(orderId),
        items: orderDoc.items,
        total: orderDoc.total
      })
    });

    let erpData = null;
    try { erpData = await erpResp.json(); } catch (e) { erpData = null; }

    if (!erpResp.ok) {
      await mongoose.connection.db.collection("orders").updateOne(
        { _id: orderId },
        { $set: { lastErpError: erpData || { message: "ERP hata döndü" }, status: "pending" } }
      );

      return res.status(502).json({
        success: false,
        message: "Sipariş kaydedildi ama ERP'ye aktarılamadı.",
        orderId: String(orderId),
        erpError: erpData
      });
    }

    // Başarılı -> siparişi güncelle
    await mongoose.connection.db.collection("orders").updateOne(
      { _id: orderId },
      {
        $set: {
          erpSync: true,
          erpSaleNo: erpData?.saleNo || erpData?.sale_id || null,
          status: "completed",
          lastErpError: null,
          syncedAt: new Date()
        }
      }
    );

    return res.json({
      success: true,
      message: "Sipariş oluşturuldu ve ERP'ye aktarıldı.",
      orderId: String(orderId),
      saleNo: erpData?.saleNo || null
    });
  } catch (err) {
    console.error("Order create error:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// =====================================================
// ADMIN: Siparişleri listele
// Endpoint: GET /api/admin/orders
// Query: ?onlyPending=true -> sadece ERP'ye aktarılmamışlar
// =====================================================
app.get("/api/admin/orders", adminAuth, async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const onlyPending = String(req.query?.onlyPending || "") === "true";
    const filter = onlyPending ? { erpSync: { $ne: true } } : {};

    const orders = await mongoose.connection.db.collection("orders")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    // kullanıcı bilgisi ekle (email/firma)
    const userIds = [...new Set(orders.map(o => o.userId).filter(Boolean).map(String))];
    let usersById = {};
    if (userIds.length) {
      
      usersById = Object.fromEntries(users.map(u => [String(u._id), u]));
    }

    const out = orders.map(o => ({
      ...o,
      _id: String(o._id),
      userId: o.userId ? String(o.userId) : null,
      companyId: o.companyId || null,
      user: o.userId ? (usersById[String(o.userId)] || null) : null
    }));

    res.json({ success: true, orders: out });
  } catch (err) {
    console.error("Admin orders error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// ADMIN: ERP'ye tekrar gönder (retry)
// Endpoint: POST /api/admin/orders/sync
// Body: { orderId }
// Not: Sipariş oluşturulurken kaydedilen erpForwardToken ile dener.
// Token expired ise kullanıcı yeniden login olmalı.
// =====================================================
app.post("/api/admin/orders/sync", adminAuth, async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const orderId = String(req.body?.orderId || "").trim();
    if (!orderId) return res.status(400).json({ success: false, message: "orderId gerekli" });

    const order = await mongoose.connection.db.collection("orders")
      .findOne({ _id: new ObjectId(orderId) });

    if (!order) return res.status(404).json({ success: false, message: "Sipariş bulunamadı" });

    const token = order.erpForwardToken;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Bu sipariş için kullanıcı token'ı kayıtlı değil. Kullanıcı yeniden sipariş vermeli veya yeniden giriş yapmalı."
      });
    }

    // token expiry kontrolü (varsa)
    if (order.erpForwardTokenExp && new Date() > new Date(order.erpForwardTokenExp)) {
      return res.status(400).json({
        success: false,
        message: "Kullanıcı oturumu süresi dolmuş. Kullanıcı yeniden giriş yapıp tekrar denemeli."
      });
    }

    const erpResp = await fetch("https://satistakip.online/api/satis/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        orderId: String(order._id),
        items: order.items || [],
        total: Number(order.total || 0)
      })
    });

    let erpData = null;
    try { erpData = await erpResp.json(); } catch (e) { erpData = null; }

    if (!erpResp.ok) {
      await mongoose.connection.db.collection("orders").updateOne(
        { _id: order._id },
        { $set: { lastErpError: erpData || { message: "ERP hata döndü" } } }
      );
      return res.status(502).json({ success: false, message: "ERP'ye gönderilemedi", erpError: erpData });
    }

    await mongoose.connection.db.collection("orders").updateOne(
      { _id: order._id },
      { $set: { erpSync: true, erpSaleNo: erpData?.saleNo || erpData?.sale_id || null, status: "completed", lastErpError: null, syncedAt: new Date() } }
    );

    return res.json({ success: true, message: "ERP'ye tekrar gönderildi", saleNo: erpData?.saleNo || null });
  } catch (err) {
    console.error("Admin sync order error:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
    console.log(`📧 Brevo API: ${process.env.BREVO_API_KEY ? 'Aktif' : 'Eksik!'}`);
    console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? 'Bağlandı' : 'Local mod'}`);
});