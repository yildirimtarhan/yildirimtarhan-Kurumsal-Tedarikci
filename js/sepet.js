// Sepet State
let sepet = JSON.parse(localStorage.getItem('kurumsalSepet')) || [];

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', () => {
    sepetGuncelle();
});

// Sepeti Aç/Kapat
function toggleSepet() {
    const dropdown = document.getElementById('cartDropdown');
    const overlay = document.querySelector('.overlay') || createOverlay();
    
    dropdown.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Overlay oluştur
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.onclick = toggleSepet;
    document.body.appendChild(overlay);
    return overlay;
}

// Sepete Ürün Ekle
function sepeteEkle(urunAdi, fiyat, id) {
    const mevcutUrun = sepet.find(item => item.id === id);
    
    if (mevcutUrun) {
        mevcutUrun.adet++;
    } else {
        sepet.push({
            id: id,
            ad: urunAdi,
            fiyat: fiyat,
            adet: 1
        });
    }
    
    sepetKaydet();
    sepetGuncelle();
    
    // Buton feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Eklendi';
    btn.classList.add('added');
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('added');
    }, 1500);
    
    // Sepeti aç
    setTimeout(() => {
        document.getElementById('cartDropdown').classList.add('active');
        createOverlay().classList.add('active');
    }, 500);
}

// Sepetten Ürün Çıkar
function sepettenCikar(id) {
    sepet = sepet.filter(item => item.id !== id);
    sepetKaydet();
    sepetGuncelle();
}

// Adet Güncelle
function adetGuncelle(id, islem) {
    const urun = sepet.find(item => item.id === id);
    if (urun) {
        if (islem === 'artir') {
            urun.adet++;
        } else if (islem === 'azalt') {
            urun.adet--;
            if (urun.adet <= 0) {
                sepettenCikar(id);
                return;
            }
        }
        sepetKaydet();
        sepetGuncelle();
    }
}

// Sepet UI Güncelle
function sepetGuncelle() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    
    if (!cartItems) return;
    
    // Sayı badge'i
    const toplamAdet = sepet.reduce((sum, item) => sum + item.adet, 0);
    cartCount.textContent = toplamAdet;
    
    if (toplamAdet === 0) {
        cartCount.style.display = 'none';
    } else {
        cartCount.style.display = 'flex';
    }
    
    // Sepet içeriği
    if (sepet.length === 0) {
        cartItems.innerHTML = `
            <div class="bos-sepet" style="text-align:center;padding:40px;color:#999;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:10px;opacity:0.3;">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <p>Sepetiniz boş</p>
                <a href="#paketler" onclick="toggleSepet()" style="color:#6366f1;">Paketlere Göz At</a>
            </div>
        `;
    } else {
        cartItems.innerHTML = sepet.map(item => `
            <div class="cart-item">
                <div class="cart-item-info" style="flex:1;">
                    <h4>${item.ad}</h4>
                    <div class="cart-item-price">₺${item.fiyat}</div>
                    <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
                        <button onclick="adetGuncelle('${item.id}', 'azalt')" style="padding:2px 8px;border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;">-</button>
                        <span>${item.adet}</span>
                        <button onclick="adetGuncelle('${item.id}', 'artir')" style="padding:2px 8px;border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="sepettenCikar('${item.id}')">Sil</button>
            </div>
        `).join('');
    }
    
    // Toplam tutar
    const toplam = sepet.reduce((sum, item) => sum + (item.fiyat * item.adet), 0);
    cartTotal.textContent = `₺${toplam.toLocaleString('tr-TR')}`;
}

// LocalStorage'a Kaydet
function sepetKaydet() {
    localStorage.setItem('kurumsalSepet', JSON.stringify(sepet));
}