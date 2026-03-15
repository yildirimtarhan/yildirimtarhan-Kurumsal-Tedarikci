# Projeyi Daha Profesyonel Hale Getirme Rehberi

Bu dokümanda Kurumsal Tedarikçi projesini daha profesyonel, sürdürülebilir ve güvenli hale getirmek için öneriler ve adımlar yer alıyor.

---

## 1. Güvenlik (Öncelikli)

### Yapılan düzeltme
- **Auth middleware**: Test amaçlı "token yoksa/admin say" bypass'ı kaldırıldı. Artık token yoksa veya geçersizse `401` dönülüyor. `adminMiddleware` sadece `rol === 'admin'` olanlara izin veriyor.

### Yapılan ek düzeltmeler
- **JWT config**: `config/jwt.js` tek kaynak; production’da JWT_SECRET yoksa uygulama başlamıyor. Tüm route ve middleware’ler `require('../config/jwt').JWT_SECRET` kullanıyor.
- **Rate limiting**: `express-rate-limit` eklendi; genel API 200 istek/15 dk, login/register/forgot-password 20 istek/15 dk ile sınırlı.
- **Helmet**: HTTP güvenlik başlıkları için `helmet` middleware’i eklendi (CSP devre dışı, statik site uyumu için).
- **Merkezi hata middleware**: `app.use((err, req, res, next) => ...)` eklendi; production’da stack trace dönülmüyor.
- **404**: API için JSON, diğer istekler için index.html fallback.

### Yapılması önerilenler
- **CORS**: Origin listesini sadece gerçek domain’lerle sınırlayın; production’da `*` kullanmayın.
- **Girdi doğrulama**: Tüm kullanıcı girdilerinde `express-validator` veya benzeri ile validasyon yapın (zaten projede var, kullanımı yaygınlaştırın).

---

## 2. Kod Yapısı ve Bakım

### server.js tek dosyada çok fazla sorumluluk
- Auth, adres, sipariş, e-posta mantığı hem `server.js` içinde hem de `routes/auth.js`, `routes/orders.js` vb. dosyalarda tanımlı. Aynı path’ler için iki tanım var; Express ilk eşleşeni kullandığı için `server.js`’teki uzun bloklar gereksiz tekrar.
- **Öneri**: Tüm route tanımlarını route dosyalarına taşıyın. `server.js` sadece:
  - dotenv, DB, CORS, body parser
  - Route mount’ları (`app.use('/api/auth', authRoutes)` vb.)
  - E-posta/nodemailer gibi tek yerde kalması mantıklı olan yardımcılar (veya bunları da `services/emailService.js` gibi modüllere taşıyın)
  - Static dosyalar, 404 handler, sunucuyu dinleme  
  olsun. Auth/register/login, addresses, orders kodunu route modüllerine taşıyıp `server.js`’ten silebilirsiniz.

### Ortak JWT ve config
- JWT_SECRET birçok dosyada tekrarlanıyor. Tek kaynak kullanın: `config/jwt.js` veya `config/index.js` içinde `JWT_SECRET` export edin, tüm route ve middleware’ler oradan import etsin.

### Hata yönetimi
- Merkezi bir hata middleware’i ekleyin (`app.use((err, req, res, next) => { ... })`). Beklenmeyen hatalarda kullanıcıya jenerik mesaj, log’a detay yazın. Production’da stack trace kullanıcıya dönmesin.
- Mümkünse `async` route’larda try/catch yerine bir wrapper (örn. `express-async-errors`) kullanarak tek yerde hata yakalayın.

---

## 3. Veritabanı ve API

- **Mongoose şemaları**: Tüm alanlarda `required`, `trim`, uygun `type` ve gerekiyorsa `enum` kullanın. Gelecekteki değişiklikler için migration/versiyonlama düşünün.
- **Index**: Sık filtrelediğiniz/sıraladığiniz alanlara (örn. `Order.createdAt`, `User.email`, `Fatura.durum`) index ekleyin.
- **API tutarlılığı**: Tüm başarılı yanıtları `{ success: true, data?: ..., message?: ... }`, hataları `{ success: false, message: ... }` formatında standartlaştırın. HTTP status kodlarını doğru kullanın (400, 401, 403, 404, 500).

---

## 4. Frontend

- **Tek sayfa / modüler yapı**: İleride bakımı kolaylaştırmak için tek sayfa uygulama (SPA) veya en azından ortak header/footer/nav’ı tek yerden yükleyen bir yapı düşünülebilir (vanilla JS ile bile modüler komponentler mümkün).
- **API çağrıları**: Tüm API isteklerini tek bir `api.js` veya servis katmanında toplayın; base URL ve token’ı orada yönetin.
- **Hata ve yükleme durumları**: Her form ve liste için “yükleniyor” ve “hata” mesajlarını kullanıcıya net gösterin.
- **Erişilebilirlik**: Form etiketleri, buton isimleri ve klavye ile gezinme (tab order, focus) standartlara uygun olsun.

---

## 5. DevOps ve Kalite

- **.env**: Gerçek secret’lar asla repo’da olmasın. `.env.example` (eklendi) ile gerekli değişkenleri dokümante edin; takım `.env`’i kendi ortamına göre doldurur.
- **Loglama**: Production’da `console.log` yerine yapılandırılmış bir logger (örn. `pino`, `winston`) kullanın; seviye (info, warn, error) ve rotasyon ayarlayın.
- **Test**: En azından kritik API’ler (auth, sipariş oluşturma) için otomatik test yazın (Jest + Supertest gibi). CI’da her commit’te testler çalışsın.
- **Git**: Anlamlı commit mesajları, `main`/`develop` gibi basit bir branch stratejisi ve mümkünse PR tabanlı ilerleyin.

---

## 6. Özet Kontrol Listesi

| Konu | Durum / Öneri |
|------|----------------|
| Auth bypass kaldırıldı | ✅ Yapıldı (middleware) |
| JWT secret / config | ✅ config/jwt.js tek kaynak; prod’da zorunlu |
| Merkezi hata middleware | ✅ Eklendi |
| Rate limit + Helmet | ✅ Eklendi |
| .env.example | ✅ Eklendi |
| README | ✅ Eklendi |
| Ortak config (JWT) | ✅ Tüm route’lar config/jwt kullanıyor |
| 404 (API + sayfa) | ✅ Eklendi |
| server.js sadeleştirme | Route’lar modüllere taşınmalı (opsiyonel) |
| API standart yanıt formatı | Tutarlı hale getirilmeli |
| Test ve logger | Planlanmalı |

Bu adımlar projeyi daha profesyonel, güvenli ve uzun vadede bakımı kolay bir hale getirir. Önceliği güvenlik ve `server.js` refaktörüne vermeniz faydalı olur.
