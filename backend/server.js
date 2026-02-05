require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const path = require('path');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

const app = express();

/** =========================
 * MongoDB
 * ========================= */
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci';

// Make connection resilient
mongoose.set('strictQuery', true);
mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB bağlandı'))
  .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

/** =========================
 * CORS (Render + Vercel + Domain)
 * ========================= */
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5500',
    'https://kurumsal-final.vercel.app',
    'https://kurumsal-tedarikci.onrender.com',
    'https://www.tedarikci.org.tr',
    'https://tedarikci.org.tr',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// STATIC DOSYALAR
// NOTE: backend ayrı repo/klasör ise public yolu projenize göre ayarlayın
app.use(express.static(path.join(__dirname, '..', 'public')));

/** =========================
 * Brevo (Sendinblue) API
 * ========================= */
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const JWT_SECRET = process.env.JWT_SECRET || 'kurumsal-tedarikci-secret-key-2024';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function maskEmail(email) {
  const e = normalizeEmail(email);
  const [u, d] = e.split('@');
  if (!u || !d) return e;
  const masked = u.length <= 2 ? u[0] + '*' : (u.slice(0, 2) + '*'.repeat(Math.max(1, u.length - 2)));
  return masked + '@' + d;
}

function random6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createResetNonce() {
  // short random id to bind verify-code -> reset-password
  return require('crypto').randomBytes(16).toString('hex');
}

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
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Merhaba <strong>${userName || ''}</strong>,</p>
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
    if (error.response && error.response.text) console.error('Brevo API Hatası:', error.response.text);
    return false;
  }
}

/** =========================
 * Admin Auth Middleware (unchanged)
 * ========================= */
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

/** =========================
 * Helpers: DB guards
 * ========================= */
function ensureDbReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ success: false, message: 'Veritabanı bağlantısı hazır değil' });
    return false;
  }
  return true;
}

function usersCol() {
  return mongoose.connection.db.collection('users');
}

/** =========================
 * ADMIN ROUTES
 * ========================= */

// ADMIN GİRİŞ (İlk admin için MongoDB'ye elle ekleme yapmalısın)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!ensureDbReady(res)) return;

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
    if (!ensureDbReady(res)) return;

    const totalUsers = await mongoose.connection.db.collection('users').countDocuments();
    const todayOrders = await mongoose.connection.db.collection('orders').countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    const pendingOrders = await mongoose.connection.db.collection('orders').countDocuments({ status: 'pending' });

    res.json({
      stats: { totalUsers, todayOrders, pendingOrders, totalRevenue: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KULLANICI LİSTESİ
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const users = await mongoose.connection.db.collection('users').find().project({ password: 0, resetCode: 0, resetNonce: 0 }).toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ERP ENTEGRASYONU - Cari Hesap Oluşturma
app.post('/api/admin/sync-cari', adminAuth, async (req, res) => {
  const { userId } = req.body;

  try {
    if (!ensureDbReady(res)) return;

    const user = await mongoose.connection.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const erpResponse = await fetch('http://localhost:3001/api/cari/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ERP_API_KEY
      },
      body: JSON.stringify({
        ad: user.firmaAdi || user.firma || user.ad,
        email: user.email,
        telefon: user.telefon,
        kaynak: 'web'
      })
    });

    if (erpResponse.ok) {
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
    if (!ensureDbReady(res)) return;

    const order = await mongoose.connection.db.collection('orders').insertOne({
      userId: new ObjectId(userId),
      items,
      total,
      status: 'pending',
      createdAt: new Date()
    });

    const erpResponse = await fetch('http://localhost:3001/pages/api/satis/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ERP_API_KEY
      },
      body: JSON.stringify({
        cariId: userId,
        items,
        total,
        kaynak: 'web-sitesi'
      })
    });

    if (erpResponse.ok) {
      const erpJson = await erpResponse.json().catch(() => ({}));
      await mongoose.connection.db.collection('orders').updateOne(
        { _id: order.insertedId },
        { $set: { erpOrderId: erpJson.id, status: 'completed' } }
      );
    }

    res.json({ success: true, orderId: String(order.insertedId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** =========================
 * AUTH ROUTES (MongoDB tabanlı - stabil)
 * ========================= */

// 1. Kayıt Ol
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const payload = req.body || {};
    const email = normalizeEmail(payload.email);

    if (!email || !payload.password || !payload.ad) {
      return res.status(400).json({ success: false, message: 'Ad, e-posta ve şifre zorunludur' });
    }

    const existing = await usersCol().findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı' });

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const doc = {
      ad: payload.ad,
      email,
      password: hashedPassword,
      firma: payload.firma || '',
      telefon: payload.telefon || '',
      uyelikTipi: payload.uyelikTipi || '',
      vergiNo: payload.vergiNo || '',
      vergiDairesi: payload.vergiDairesi || '',
      tcNo: payload.tcNo || '',
      faturaTipi: payload.faturaTipi || '',
      faturaAdresi: payload.faturaAdresi || '',
      teslimatAdresi: payload.teslimatAdresi || '',
      kayitTarihi: new Date().toLocaleDateString('tr-TR'),
      createdAt: new Date(),
      approved: false,
      erpSynced: false
    };

    const result = await usersCol().insertOne(doc);

    res.json({ success: true, message: 'Kayıt başarılı', userId: String(result.insertedId) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
});

// 2. Giriş Yap
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    const user = await usersCol().findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'E-posta veya şifre hatalı' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'E-posta veya şifre hatalı' });

    const token = jwt.sign(
      { userId: String(user._id), email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: String(user._id),
        ad: user.ad,
        email: user.email,
        firma: user.firma,
        telefon: user.telefon
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
});

// 3. Şifre Sıfırlama - Kod Gönder
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "E-posta gerekli"
      });
    }

    // Kullanıcı MongoDB’den bulunur
    const user = await usersCol().findOne({ email });

    // Güvenlik için kullanıcı yoksa bile başarılı dön
    if (!user) {
      return res.json({
        success: true,
        message: "Eğer bu e-posta kayıtlıysa kod gönderildi"
      });
    }

    // ✅ 6 haneli kod üret
    const kod = String(Math.floor(100000 + Math.random() * 900000));

    // ✅ MongoDB’ye resetCode + resetExpires yaz
    await usersCol().updateOne(
      { email },
      {
        $set: {
          resetCode: kod,
          resetExpires: new Date(Date.now() + 15 * 60 * 1000) // 15 dk
        }
      }
    );

    console.log("✅ Reset kodu DB’ye yazıldı:", email, kod);

    // ✅ Mail gönder
    const mailSent = await sendResetEmail(email, kod, user.ad);

    if (!mailSent) {
      return res.status(500).json({
        success: false,
        message: "Mail gönderilemedi"
      });
    }

    res.json({
      success: true,
      message: "Şifre sıfırlama kodu e-posta adresinize gönderildi"
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası"
    });
  }
});


// 4. Kod Doğrulama
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();

    const user = await usersCol().findOne({ email });
    if (!user || !user.resetCode || !user.resetExpires) {
      return res.status(400).json({ success: false, message: 'Hatalı doğrulama kodu' });
    }

    if (new Date() > new Date(user.resetExpires)) {
      await usersCol().updateOne({ _id: user._id }, { $unset: { resetCode: "", resetExpires: "", resetNonce: "", resetVerifiedAt: "" } });
      return res.status(400).json({ success: false, message: 'Kod süresi dolmuş, lütfen yeni kod talep edin' });
    }

    if (user.resetCode !== code) {
      return res.status(400).json({ success: false, message: 'Hatalı doğrulama kodu' });
    }

    // Verify->Reset bağlama: nonce üret ve JWT içine koy
    const nonce = createResetNonce();
    await usersCol().updateOne(
      { _id: user._id },
      { $set: { resetNonce: nonce, resetVerifiedAt: new Date() } }
    );

    const resetToken = jwt.sign(
      { email, userId: String(user._id), type: 'password-reset', nonce },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ success: true, resetToken });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
});

// 5. Yeni Şifre Kaydetme (Kod ile)
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, kod ve yeni şifre zorunludur"
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Şifre en az 8 karakter olmalı"
      });
    }

    // ✅ Kullanıcı kod ile bulunur
    const user = await usersCol().findOne({
      email,
      resetCode: code,
      resetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Kod geçersiz veya süresi dolmuş"
      });
    }

    // Şifre hashle
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Şifreyi güncelle + reset alanlarını temizle
    await usersCol().updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        },
        $unset: {
          resetCode: "",
          resetExpires: ""
        }
      }
    );

    console.log("✅ Şifre sıfırlandı:", email);

    res.json({
      success: true,
      message: "Şifreniz başarıyla güncellendi"
    });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası"
    });
  }
});


// 6. Profil Şifre Değiştirme
app.post('/api/auth/change-password', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Yetkisiz erişim' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'Şifre en az 8 karakter olmalı' });
    }

    const user = await usersCol().findOne({ _id: new ObjectId(decoded.userId) });
    if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });

    const isMatch = await bcrypt.compare(String(currentPassword || ''), user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Mevcut şifreniz hatalı' });

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await usersCol().updateOne({ _id: user._id }, { $set: { password: hashed, updatedAt: new Date() } });

    res.json({ success: true, message: 'Şifreniz başarıyla güncellendi' });
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Oturum süresi dolmuş, lütfen tekrar giriş yapın' });
    }
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
});

// 7. Token Doğrulama
app.get('/api/auth/verify', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token bulunamadı' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await usersCol().findOne({ _id: new ObjectId(decoded.userId) });
    if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });

    res.json({
      success: true,
      user: { id: String(user._id), ad: user.ad, email: user.email, firma: user.firma }
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
app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📧 Brevo API: ${process.env.BREVO_API_KEY ? 'Aktif' : 'Eksik!'}`);
  console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? 'Bağlandı' : 'Local mod'}`);
});
