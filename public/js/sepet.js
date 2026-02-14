// Sepet Yönetim Sistemi - GÜNCELLENMİŞ VERSİYON (KDV %20 + Senkronizasyon Fix)
// Tüm sayfalarda aynı localStorage anahtarını kullan: 'cart'

const KDV_ORANI = 0.20; // %20 KDV

// Sepeti getir - GLOBAL değişken
let sepet = [];

// Sayfa yüklendiğinde sepeti yükle
function initSepet() {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
        try {
            sepet = JSON.parse(savedCart);
            // Eski format kontrolü ve düzeltme
            sepet = sepet.map(item => ({
                id: item.id || Date.now().toString(),
                name: item.name || item.ad || 'Ürün',
                ad: item.name || item.ad || 'Ürün', // Geriye uyumluluk
                price: parseFloat(item.price || item.fiyat || 0),
                fiyat: parseFloat(item.price || item.fiyat || 0),
                qty: parseInt(item.qty || item.adet || 1),
                adet: parseInt(item.qty || item.adet || 1),
                category: item.category || 'Ürün',
                kdvOrani: 20
            }));
        } catch (e) {
            console.error("Sepet yükleme hatası:", e);
            sepet = [];
        }
    }
    // Eski anahtarı temizle
    localStorage.removeItem("kurumsalSepet");
    sepetiKaydet();
    sepetGuncelle();
    return sepet;
}

// Sepeti kaydet
function sepetiKaydet() {
    localStorage.setItem("cart", JSON.stringify(sepet));
    // Tüm sayfalarda güncelleme yapılması için event dispatch et
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'cart',
        newValue: JSON.stringify(sepet)
    }));
}

// Fiyat hesaplama fonksiyonları
function hesaplaKDV(tutar) {
    return tutar * KDV_ORANI;
}

function hesaplaKDVsiz(tutar) {
    return tutar / (1 + KDV_ORANI);
}

function formatFiyat(fiyat) {
    return parseFloat(fiyat).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Sepete ürün ekle
function sepeteEkle(urunAd, fiyat, id, adet = 1) {
    // Fiyat KDV dahil olarak kaydedilir
    const kdvDahilFiyat = parseFloat(fiyat);
    
    const mevcutIndex = sepet.findIndex(item => 
        (id && item.id === id) || item.name === urunAd || item.ad === urunAd
    );
    
    if (mevcutIndex >= 0) {
        sepet[mevcutIndex].qty += adet;
        sepet[mevcutIndex].adet = sepet[mevcutIndex].qty;
    } else {
        sepet.push({
            id: id || Date.now().toString(),
            name: urunAd,
            ad: urunAd,
            price: kdvDahilFiyat,
            fiyat: kdvDahilFiyat,
            qty: adet,
            adet: adet,
            category: 'Ürün',
            kdvOrani: 20
        });
    }
    
    sepetiKaydet();
    sepetGuncelle();
    bildirimGoster(`${urunAd} sepete eklendi!`);
    
    // Diğer sayfaları da güncelle
    if (typeof loadCart === 'function') {
        loadCart();
    }
}

// Ürün adetini güncelle (artır/azalt)
function adetGuncelle(urunAd, degisim) {
    const index = sepet.findIndex(item => item.name === urunAd || item.ad === urunAd);
    if (index === -1) return;
    
    const mevcutAdet = sepet[index].qty || sepet[index].adet || 1;
    const yeniAdet = mevcutAdet + degisim;
    
    if (yeniAdet <= 0) {
        urunSil(urunAd);
        return;
    }
    
    sepet[index].qty = yeniAdet;
    sepet[index].adet = yeniAdet;
    
    sepetiKaydet();
    sepetGuncelle();
    
    // Tüm sayfalarda güncelle
    broadcastUpdate();
}

// Ürünü sepetten sil
function urunSil(urunAd) {
    sepet = sepet.filter(item => item.name !== urunAd && item.ad !== urunAd);
    sepetiKaydet();
    sepetGuncelle();
    broadcastUpdate();
    bildirimGoster("Ürün sepetten kaldırıldı");
}

// Tüm sayfalarda güncelleme yap
function broadcastUpdate() {
    // Sepet sayfasını güncelle
    if (typeof sepetiGoster === 'function') {
        sepetiGoster();
    }
    // Ödeme sayfasını güncelle
    if (typeof loadCart === 'function') {
        loadCart();
    }
}

// Sepet özetini hesapla
function hesaplaSepetOzeti() {
    const araToplamKDVsiz = sepet.reduce((toplam, item) => {
        const adet = item.qty || item.adet || 1;
        const birimFiyat = item.price || item.fiyat || 0;
        const kdvHaric = birimFiyat / (1 + KDV_ORANI);
        return toplam + (kdvHaric * adet);
    }, 0);
    
    const kdvTutari = araToplamKDVsiz * KDV_ORANI;
    const araToplamKDVli = araToplamKDVsiz + kdvTutari;
    const kargo = araToplamKDVli > 500 ? 0 : 29.90;
    const genelToplam = araToplamKDVli + kargo;
    
    return {
        araToplamKDVsiz,
        kdvTutari,
        araToplamKDVli,
        kargo,
        genelToplam
    };
}

// Sepet sayacını güncelle
function sepetGuncelle() {
    const countEl = document.getElementById("cart-count");
    if (countEl) {
        const toplamAdet = sepet.reduce((toplam, item) => toplam + (item.qty || item.adet || 1), 0);
        countEl.innerText = toplamAdet;
        countEl.style.display = toplamAdet > 0 ? 'flex' : 'none';
    }
}

// Sepeti görüntüle
function sepetGoster() {
    if (sepet.length === 0) {
        bildirimGoster("Sepetiniz boş!");
        return;
    }
    window.location.href = "sepet.html";
}

// Sepeti temizle
function sepetiTemizle() {
    if (confirm("Sepeti tamamen temizlemek istiyor musunuz?")) {
        sepet = [];
        sepetiKaydet();
        sepetGuncelle();
        broadcastUpdate();
        bildirimGoster("Sepet temizlendi");
    }
}

// Bildirim göster
function bildirimGoster(mesaj, type = 'success') {
    const existingToast = document.querySelector('.sepet-toast');
    if (existingToast) existingToast.remove();
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const color = type === 'success' ? '#10b981' : '#ef4444';
    
    const toast = document.createElement('div');
    toast.className = 'sepet-toast';
    toast.innerHTML = `
        <div style="
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: ${color};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 9999;
            font-weight: 600;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 250px;
        ">
            <i class="fas ${icon}"></i>
            ${mesaj}
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Sayfa yüklendiğinde sepeti başlat
document.addEventListener("DOMContentLoaded", () => {
    initSepet();
    
    // Storage event'ini dinle (diğer sayfalardan gelen değişiklikler)
    window.addEventListener('storage', (e) => {
        if (e.key === 'cart') {
            initSepet();
            if (typeof sepetiGoster === 'function') {
                sepetiGoster();
            }
            if (typeof loadCart === 'function') {
                loadCart();
            }
        }
    });
});

// CSS Animasyonları
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 1; }
    }
`;
document.head.appendChild(style);