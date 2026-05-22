/**
 * Ödeme sayfası — ön bilgilendirme / mesafeli satış / KVKK modal içerikleri
 */
(function (global) {
  function getBuyer() {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (_) {
      return null;
    }
  }

  function getCartSummary() {
    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (_) {}
    if (!cart.length) return { lines: '<li>Sepet özeti sipariş anında oluşturulacaktır.</li>', total: '—' };
    let sub = 0;
    const lines = cart.map(function (it) {
      const fiyat = parseFloat(it.price || it.fiyat || 0);
      const adet = parseInt(it.quantity || it.qty || it.adet || 1, 10);
      sub += fiyat * adet;
      return '<li>' + (it.name || it.ad || 'Ürün') + ' — ' + adet + ' adet × ₺' + fiyat.toLocaleString('tr-TR') + ' + KDV</li>';
    }).join('');
    const kdv = sub * 0.2;
    const total = sub + kdv;
    return {
      lines: lines,
      sub: sub.toLocaleString('tr-TR'),
      kdv: kdv.toLocaleString('tr-TR'),
      total: total.toLocaleString('tr-TR'),
    };
  }

  function corp() {
    return global.KT_CORP ? global.KT_CORP.get() : {};
  }

  function onBilgiHtml() {
    const c = corp();
    const b = getBuyer();
    const cart = getCartSummary();
    const buyerName = b ? (b.adSoyad || b.fullName || ((b.ad || '') + ' ' + (b.soyad || '')).trim() || b.email) : '[Alıcı]';
    const esc = global.KT_CORP && global.KT_CORP.esc ? global.KT_CORP.esc : function (x) { return String(x == null ? '' : x); };
    return (
      '<div class="legal-modal-doc">' +
      '<h4>Ön Bilgilendirme Formu</h4>' +
      '<p><em>6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında bilgilendirme</em></p>' +
      '<h5>1. Satıcı</h5>' + (global.KT_CORP ? global.KT_CORP.sellerInfoHtml() : '') +
      '<h5>2. Alıcı</h5><p><strong>' + esc(buyerName) + '</strong></p>' +
      (b && b.email ? '<p>E-posta: ' + esc(b.email) + '</p>' : '') +
      '<h5>3. Ürün/Hizmet ve Bedel</h5><ul>' + cart.lines + '</ul>' +
      '<p>Ara toplam (KDV hariç): ₺' + cart.sub + ' · KDV (%20): ₺' + cart.kdv + ' · <strong>Ödenecek toplam (KDV dahil): ₺' + cart.total + '</strong></p>' +
      '<h5>4. Ödeme ve Teslimat</h5><p>Ödeme, sipariş sırasında seçilen yöntemle (banka havalesi, kapıda ödeme veya kredi kartı) yapılır. Dijital hizmetlerde teslimat yasal aktivasyon süreçleri sonrasında gerçekleşir.</p>' +
      '<h5>5. Cayma Hakkı</h5><p>14 gün içinde cayma hakkınız bulunmaktadır. Elektronik ortamda anında ifa edilen ve kişiselleştirilen hizmetlerde (aktive edilmiş e-imza, KEP vb.) cayma hakkı kullanılamaz.</p>' +
      '<p style="margin-top:1rem;"><a href="on-bilgilendirme-formu.html" target="_blank" rel="noopener">Tam metin →</a></p>' +
      '</div>'
    );
  }

  function mesafeliHtml() {
    const c = corp();
    const b = getBuyer();
    const cart = getCartSummary();
    const buyerName = b ? (b.adSoyad || b.fullName || b.email) : '[Alıcı]';
    const esc = global.KT_CORP && global.KT_CORP.esc ? global.KT_CORP.esc : function (x) { return String(x == null ? '' : x); };
    return (
      '<div class="legal-modal-doc">' +
      '<h4>Mesafeli Satış Sözleşmesi</h4>' +
      '<p>İşbu sözleşme, <strong>' + esc(c.website) + '</strong> üzerinden verilen siparişe ilişkindir.</p>' +
      '<h5>Satıcı</h5><p>' + esc(c.unvan) + ' — VKN: ' + esc(c.vkn) + '</p>' +
      '<h5>Alıcı</h5><p>' + esc(buyerName) + '</p>' +
      '<h5>Konu ve Bedel</h5><ul>' + cart.lines + '</ul><p><strong>Toplam (KDV dahil): ₺' + cart.total + '</strong></p>' +
      '<p>Alıcı, ön bilgilendirme formunu okuduğunu ve siparişi onayladığını kabul eder.</p>' +
      '<p style="margin-top:1rem;"><a href="mesafeli-satis-sozlesmesi.html" target="_blank" rel="noopener">Tam metin →</a></p>' +
      '</div>'
    );
  }

  function kvkkHtml() {
    const c = corp();
    const esc = global.KT_CORP && global.KT_CORP.esc ? global.KT_CORP.esc : function (x) { return String(x == null ? '' : x); };
    return (
      '<div class="legal-modal-doc">' +
      '<h4>KVKK Aydınlatma Metni</h4>' +
      '<p>6698 sayılı KVKK kapsamında veri sorumlusu: <strong>' + esc(c.unvan) + '</strong>.</p>' +
      '<p><strong>İşlenen veriler:</strong> Kimlik, iletişim, adres, sipariş ve ödeme bilgileri (kart bilgisi tarafımızca saklanmaz).</p>' +
      '<p><strong>Amaç:</strong> Sipariş, ödeme, e-dönüşüm hizmet aktivasyonu, destek ve yasal yükümlülükler.</p>' +
      '<p><strong>Aktarım:</strong> Ödeme kuruluşu, kargo, BTK onaylı sertifika sağlayıcıları ve yasal merciler.</p>' +
      '<p><strong>Haklarınız:</strong> KVKK md. 11 kapsamında başvuru: <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></p>' +
      '<p style="margin-top:1rem;"><a href="gizlilik-ve-guvenlik-politikasi.html" target="_blank" rel="noopener">Tam metin →</a></p>' +
      '</div>'
    );
  }

  global.KT_LEGAL_CHECKOUT = {
    onBilgiHtml: onBilgiHtml,
    mesafeliHtml: mesafeliHtml,
    kvkkHtml: kvkkHtml,
  };
})(window);
