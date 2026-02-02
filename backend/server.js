require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS AYARLARI (Render + Vercel için güncellendi)
const corsOptions = {
  origin: [
    'http://localhost:3000', 
    'http://localhost:5500',
    'https://kurumsal-final.vercel.app',  // Vercel adresiniz (deploy sonrası buraya yazın)
    'https://kurumsal-tedarikci.onrender.com', // Render adresiniz (deploy sonrası buraya yazın)
    '*' // Tüm domainlere izin ver (geliştirme aşamasında güvenli, canlıda kaldırın)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// STATIC DOSYALAR (public klasörünü serve et - opsiyonel, Render sadece API için kullanılacaksa)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Nodemailer SMTP yapılandırması (Brevo SMTP)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// SMTP bağlantısını test et
transporter.verify(function(error, success) {
    if (error) {
        console.error('❌ SMTP Bağlantı hatası:', error);
    } else {
        console.log('✅ SMTP Sunucusu hazır (Brevo)');
    }
});

// Geçici kod saklama
const resetCodes = new Map();

// Basit veritabanı
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

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'kurumsal-tedarikci-secret-key-2024';

// MAIL GÖNDERİM FONKSİYONU
async function sendResetEmail(toEmail, kod, userName) {
    try {
        const mailOptions = {
            from: {
                name: process.env.SMTP_FROM_NAME || 'Kurumsal Tedarikçi',
                address: process.env.SMTP_FROM_EMAIL || 'yildirimtarhan@tedarikci.org.tr'
            },
            to: toEmail,
            subject: 'Şifre Sıfırlama Kodunuz - Kurumsal Tedarikçi',
            replyTo: process.env.NOTIFY_EMAIL || 'iletisim@tedarikci.org.tr',
            html: `
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
                        
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">Eğer bu talebi siz yapmadıysanız, lütfen bu e-postayı dikkate almayın.</p>
                        
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                            Kurumsal Tedarikçi | ${process.env.SMTP_FROM_EMAIL || 'yildirimtarhan@tedarikci.org.tr'}<br>
                            Bu e-posta otomatik olarak gönderilmiştir.
                        </p>
                    </div>
                </div>
            `,
            text: `Şifre sıfırlama kodunuz: ${kod}. Bu kod 15 dakika içinde geçerlidir.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Mail gönderildi: ${toEmail} (ID: ${info.messageId})`);
        return true;
    } catch (error) {
        console.error('❌ Mail gönderim hatası:', error.message);
        return false;
    }
}

// API ROUTES

// 1. Kayıt Ol
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
        console.log('Yeni kullanıcı:', email);
        
        res.json({ success: true, message: 'Kayıt başarılı' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// 2. Giriş Yap
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

// 3. Şifre Sıfırlama - Kod Gönder
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

// 5. Yeni Şifre Kaydetme
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
        
        console.log(`Şifre sıfırlandı: ${email}`);
        res.json({ success: true, message: 'Şifreniz başarıyla güncellendi' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ success: false, message: 'İşlem süresi dolmuş' });
        }
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
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
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mevcut şifreniz hatalı' });
        }
        
        user.password = await bcrypt.hash(newPassword, 10);
        
        res.json({ success: true, message: 'Şifreniz başarıyla güncellendi' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Oturum süresi dolmuş' });
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

// Health check (Render için önemli)
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
    console.log(`📧 SMTP: ${process.env.SMTP_HOST || 'smtp-relay.brevo.com'}`);
    console.log(`🔒 CORS: Çoklu domain desteği aktif`);
});