# Kurumsal Tedarikçi

Kurumsal ve bireysel tedarik siparişleri, faturalama, kargo ve müşteri yönetimi için web uygulaması.

## Proje Yapısı

- **backend/** – Node.js (Express) API, MongoDB, ERP/e-fatura entegrasyonları
- **public/** – Statik frontend (HTML, CSS, JS), müşteri ve admin sayfaları

## Gereksinimler

- Node.js 18+
- MongoDB
- (Opsiyonel) ERP, Taxten, SMTP, SMS, kargo servisleri için hesap

## Kurulum

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# .env dosyasını düzenleyin (MONGODB_URI, JWT_SECRET vb.)
npm run dev
```

API varsayılan olarak `http://localhost:3000` adresinde çalışır.

### 2. Ortam Değişkenleri

`backend/.env.example` dosyası tüm değişkenleri listeler. En azından şunları ayarlayın:

- `MONGODB_URI` – MongoDB bağlantı adresi
- `JWT_SECRET` – Güçlü, rastgele bir secret (production’da mutlaka kullanın)
- `ADMIN_USER` / `ADMIN_PASS` – Admin panel girişi

### 3. Frontend

Backend çalışırken statik dosyalar aynı sunucudan servis edilir. Tarayıcıda:

- Site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin/login.html`

## Scriptler

| Komut | Açıklama |
|-------|----------|
| `npm start` | Sunucuyu başlatır |
| `npm run dev` | Nodemon ile geliştirme modu |

## Özellikler

- Kullanıcı kayıt/giriş, profil, adres yönetimi
- Sipariş oluşturma, takip, e-posta bildirimi
- Admin: sipariş, ürün, paket, cari, fatura, tahsilat, raporlar
- ERP entegrasyonu (cari, satış)
- E-fatura (Taxten), kargo entegrasyonları
- Destek talepleri, e-posta/SMS bildirimleri

## Daha Fazla Bilgi

- Profesyonel geliştirme ve iyileştirme önerileri için **PROFESYONEL.md** dosyasına bakın.
