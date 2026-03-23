# E-İmza Paketlerini Siteye Ekleme

Görseldeki gibi **1 Yıllık**, **2 Yıllık** ve **3 Yıllık** E-İmza paketlerini E-İmza bölümünde göstermek için aşağıdaki adımları uygulayın.

---

## 1. Kategoriyi Kontrol Edin

1. Admin panele giriş yapın.
2. **Kategori Yönetimi** sayfasına gidin (`admin/kategori-yonetim.html`).
3. Listede **"E-İmza Paketleri"** adında bir kategori var mı kontrol edin.
4. **Yoksa:** "Yeni Kategori" ile ekleyin:
   - **Kategori adı:** `E-İmza Paketleri`
   - **Sıra:** Örn. 1

> Ürünler sayfasında E-İmza bölümünde görünmesi için kategori adı tam olarak **E-İmza Paketleri** olmalı (E-imza da kabul edilir).

---

## 2. Ürünleri Stok Yönetimi'nden Ekleyin

1. **Stok Yönetimi** sayfasına gidin (`admin/products-manage.html`).
2. **"Yeni Ürün Ekle"** (veya ürün ekle) butonuna tıklayın.
3. Aşağıdaki üç ürünü **sırayla** ekleyin. Her birinde **Kategori** alanından **"E-İmza Paketleri"** seçin.

### Ürün 1 – 1 Yıllık
| Alan        | Değer |
|------------|--------|
| **Ürün adı** | 1 Yıllık E-İmza Paketi |
| **Kategori** | E-İmza Paketleri |
| **Fiyat**   | 2149 |
| **Birim**   | Adet |
| **Açıklama** | Kart Okuyucu dahil. 1 yıl geçerli elektronik imza sertifikası. |
| **KDV dahil** | İşaretli (görselde "KDV dahildir" yazıyor) |

### Ürün 2 – 2 Yıllık
| Alan        | Değer |
|------------|--------|
| **Ürün adı** | 2 Yıllık E-İmza Paketi |
| **Kategori** | E-İmza Paketleri |
| **Fiyat**   | 3699 |
| **Birim**   | Adet |
| **Açıklama** | Kart Okuyucu dahil. 2 yıl geçerli elektronik imza sertifikası. |
| **KDV dahil** | İşaretli |

### Ürün 3 – 3 Yıllık (En Çok Tercih Edilen)
| Alan        | Değer |
|------------|--------|
| **Ürün adı** | 3 Yıllık E-İmza Paketi |
| **Kategori** | E-İmza Paketleri |
| **Fiyat**   | 4249 |
| **Birim**   | Adet |
| **Açıklama** | Kart Okuyucu dahil. 3 yıl geçerli elektronik imza sertifikası. En çok tercih edilen paket. |
| **KDV dahil** | İşaretli |

4. Her ürün için **Kaydet** deyin.

---

## 3. Sonuç

- **Ürünler** sayfasında (`urunler.html`) menüden **"Elektronik İmza (E-İmza) Paketleri"** veya **Ürünler → E-İmza** ile girdiğinizde bu üç paket listelenecektir.
- **Ürünler** sayfasında **"Tümünü göster"** ile tüm kategorilere baktığınızda da E-İmza accordion’u altında bu ürünler görünür.

---

## Notlar

- **SKU:** İsterseniz boş bırakabilirsiniz; sistem otomatik üretebilir.
- **Stok:** Stok takibi yapıyorsanız uygun bir stok adedi girin.
- Fiyatlar görseldeki gibi KDV dahil kabul edildi; admin’de **KDV dahil** kutusunu işaretleyin.
