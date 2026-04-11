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
const corsAllowList = new Set([
  "http://localhost:3000",
  "http://localhost:5500",
  "https://tedarikci.org.tr",
  "https://www.tedarikci.org.tr",
]);
if (process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => corsAllowList.add(o));
}

function isAllowedCorsOrigin(origin) {
  if (!origin) return false;
  if (corsAllowList.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && u.hostname.endsWith(".vercel.app")) return true;
  } catch (_) {}
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedCorsOrigin(origin)) return callback(null, origin);
      callback(null, false);
    },
    credentials: true,
  })
);

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
const musteriRoutes = require('./routes/musteri');

// OAuth kaldırıldı (Kullanıcı isteği: Sosyal medya kalmasın)
// const oauthRoutes = require('./routes/oauth');

const marketingRoutes = require('./routes/marketing');

// Route Kullanımları
app.use("/api/auth", authRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/packages", packageRoutes);
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
app.use('/api/musteri', musteriRoutes);
app.use('/api/marketing', marketingRoutes);



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
const htmlPages = ['index', 'sepet', 'profil', 'odeme', 'siparisler', 'giris', 'kayit', 'sifremi-unuttum', 'hakkimizda', 'hizmetlerimiz', 'urunler', 'referanslarimiz', 'iletisim', 'teklif-al', 'destek-sorularim', 'kargo-takip', 'gizlilik-ve-guvenlik-politikasi', 'mesafeli-satis-sozlesmesi', 'iptal-ve-iade-kosullari', 'kullanim-kosullari', 'on-bilgilendirme-formu', 'faturalarim', 'faturalar'];
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