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

// MongoDB Bağlantısı
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB bağlandı'))
.catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

const db = mongoose.connection;

// CORS AYARLARI (Render + Vercel için)
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
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STATIC DOSYALAR
app.use(express.static(path.join(__dirname, '..', 'public')));

// BREVO API YAPILANDIRMASI
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// Geçici kod saklama
const resetCodes = new Map();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'kurumsal-tedarikci-secret-key-2024';

// ADMIN MIDDLEWARE - Token doğrulama
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token gerekli' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Yetkisiz erişim' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// MAIL GÖNDERİM FONKSİYONU (Brevo API)
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
                    </div>
                    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 20px;">Şifre Sıfırlama İsteği</h2>
                    <p style="color: #4b5563; font-size: 16px;">Merhaba <strong>${userName}</strong>,</p>
                    <p style="color: #4b5563; font-size: 16px;">Şifre sıfırlama kodunuz:</p>
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 25px; text-align: center; border-radius: 10px; margin: 30px 0;">
                        <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px;">${kod}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Bu kod 15 dakika içinde geçerlidir.</p>
                </div>
            </div>
        `;
        sendSmtpEmail.sender = { 
            name: 'Kurumsal Tedarikci', 
            email: process.env.SMTP_FROM_EMAIL || 'yildirimtarhan@tedarikci.org.tr'
        };
        sendSmtpEmail.to = [{ email: toEmail }];
        
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ Mail gönderildi: ${toEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Mail gönderim hatası:', error.message);
        return false;
    }
}

// Basit veritabanı (Mevcut kullanıcılar - Geçiş aşamasında)
const users = [
    {
        id: '1',
        ad: 'Test Kullanıcı',
        email: 'test@tedarikci.org.tr',
        password: '$2a$10$YourHashedPasswordHere',
        firma: 'Test Firması',
        telefon: '05551234567',
        kayitTarihi: new Date().toLocaleDateString()
    }
];

// ================= ADMIN ROUTES =================

// ADMIN GİRİŞ
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = await db.collection('admins').findOne({ username });
    
    if (!admin || !await bcrypt.compare(password, admin.password)) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }
    
    const token = jwt.sign(
      { id: admin._id, username: admin.username, isAdmin: true },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { username: admin.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DASHBOARD İSTATİSTİKLERİ
app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const totalUsers = await db.collection('users').countDocuments();
    const todayOrders = await db.collection('orders').countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
    });
    const pendingOrders = await db.collection('orders').countDocuments({ status: 'pending' });
    
    res.json({
      stats: {
        totalUsers,
        todayOrders,
        pendingOrders,
        totalRevenue: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KULLANICI LİSTESİ
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await db.collection('users').find().toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ERP ENTEGRASYONU - Cari Hesap Oluşturma
app.post('/api/admin/sync-cari', adminAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    
    const erpResponse = await fetch(process.env.ERP_BASE_URL + '/api/cari/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': process.env.ERP_API_KEY
      },
      body: JSON.stringify({
        ad: user.firmaAdi || user.ad,
        email: user.email,
        telefon: user.telefon,
        kaynak: 'web'
      })
    });
    
    if (erpResponse.ok) {
      await db.collection('users').updateOne(
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
    const response = await fetch(process.env.ERP_BASE_URL + '/pages/api/sales', {
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
  try {
    const { userId, items, total } = req.body;
    
    const order = await db.collection('orders').insertOne({
      userId: new ObjectId(userId),
      items,
      total,
      status: 'pending',
      createdAt: new Date()
    });
    
    const erpResponse = await fetch(process.env.ERP_BASE_URL + '/pages/api/satis/create', {
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
      await db.collection('orders').updateOne(
        { _id: order.insertedId },
        { $set: { erpOrderId: (await erpResponse.json()).id, status: 'completed' } }
      );
    }
    
    res.json({ success: true, orderId: order.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= AUTH ROUTES =================

// Kayıt Ol
app.post('/api/auth/register', async (req, res) => {
    try {
        const { ad, email, password, firma, telefon } = req.body;
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            ad,
            email,
            password: hashedPassword,
            firma: firma || '',
            telefon: telefon || '',
            kayitTarihi: new Date().toLocaleDateString('tr-TR')
        };
        
        users.push(newUser);
        
        // Ayrıca MongoDB'ye de kaydet (Admin panelinde görmek için)
        await db.collection('users').insertOne({
            ...newUser,
            _id: newUser.id,
            createdAt: new Date()
        });
        
        res.json({ success: true, message: 'Kayıt başarılı' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// Giriş Yap
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(400).json({ success: false, message: 'E-posta veya şifre hatalı' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'E-posta veya şifre hatalı' });
        }
        
        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.json({ 
            success: true, 
            token,
            user: { 
                id: user.id, 
                ad: user.ad, 
                email: user.email, 
                firma: user.firma,
                telefon: user.telefon
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// Şifre Sıfırlama - Kod Gönder
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.json({ success: true, message: 'Eğer bu e-posta kayıtlıysa kod gönderildi' });
        }
        
        const kod = Math.floor(100000 + Math.random() * 900000).toString();
        
        resetCodes.set(email, { 
            kod, 
            userId: user.id,
            expiry: Date.now() + 900000
        });
        
        const sent = await sendResetEmail(email, kod, user.ad);
        
        if (sent) {
            res.json({ success: true, message: 'Doğrulama kodu e-posta adresinize gönderildi' });
        } else {
            res.status(500).json({ success: false, message: 'E-posta gönderilemedi' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// Kod Doğrulama
app.post('/api/auth/verify-code', (req, res) => {
    try {
        const { email, code } = req.body;
        const data = resetCodes.get(email);
        
        if (!data || data.kod !== code) {
            return res.status(400).json({ success: false, message: 'Hatalı doğrulama kodu' });
        }
        
        if (Date.now() > data.expiry) {
            resetCodes.delete(email);
            return res.status(400).json({ success: false, message: 'Kod süresi dolmuş' });
        }
        
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

// Yeni Şifre Kaydetme
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;
        
        const decoded = jwt.verify(resetToken, JWT_SECRET);
        
        if (decoded.email !== email || decoded.type !== 'password-reset') {
            return res.status(400).json({ success: false, message: 'Geçersiz token' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const userIndex = users.findIndex(u => u.email === email);
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
        }
        
        users[userIndex].password = hashedPassword;
        resetCodes.delete(email);
        
        res.json({ success: true, message: 'Şifreniz başarıyla güncellendi' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// Profil Şifre Değiştirme
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
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mevcut şifreniz hatalı' });
        }
        
        user.password = await bcrypt.hash(newPassword, 10);
        
        res.json({ success: true, message: 'Şifreniz başarıyla güncellendi' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// Token Doğrulama
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
app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
    console.log(`📧 Brevo API: ${process.env.BREVO_API_KEY ? 'Aktif' : 'Eksik!'}`);
    console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? 'Bağlandı' : 'Local mod'}`);
});