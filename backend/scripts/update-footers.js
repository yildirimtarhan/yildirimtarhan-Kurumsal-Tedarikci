const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', '..', 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

const newFooterHtml = `
<footer class="footer">
  <div class="container">
    <div style="margin-bottom: 2rem;">
      <a href="mailto:iletisim@tedarikci.org.tr" style="color: white; font-size: 1.5rem; margin-right: 1rem;"><i class="fas fa-envelope"></i></a>
      <a href="https://wa.me/905059112749" target="_blank" style="color: #25d366; font-size: 1.5rem;"><i class="fab fa-whatsapp"></i></a>
    </div>

    <div class="etbis-wrap">
      <div class="etbis-badge"><i class="fas fa-shield-halved" aria-hidden="true"></i> ETBİS</div>
      <span class="etbis-text">Bu site, T.C. Ticaret Bakanlığı Elektronik Ticaret Bilgi Sistemi (ETBİS) kapsamında kayıtlı bir elektronik ticaret ortamıdır.</span>
      <div class="etbis-links">
        <a href="gizlilik-ve-guvenlik-politikasi.html">Gizlilik Politikası</a> <span>|</span>
        <a href="mesafeli-satis-sozlesmesi.html">Mesafeli Satış Sözleşmesi</a> <span>|</span>
        <a href="iptal-ve-iade-kosullari.html">İade Koşulları</a> <span>|</span>
        <a href="kullanim-kosullari.html">Kullanım Şartları</a>
      </div>
    </div>

    <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 2rem; line-height: 1.6;">
        [ŞİRKET TAM ADI] | MERSİS No: [MERSİS NO] | Vergi No: [VERGİ NO]<br>
        Kep Adresi: [KEP ADRESİ]
    </div>

    <p>© 2026 Kurumsal Tedarikçi. Tüm hakları saklıdır.</p>
  </div>
</footer>
`;

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Regex to find the footer block
    const footerRegex = /<footer[\s\S]*?<\/footer>/g;
    
    if (footerRegex.test(content)) {
        console.log(`Updating footer in ${file}...`);
        content = content.replace(footerRegex, newFooterHtml);
        fs.writeFileSync(filePath, content);
    }
});

console.log('✅ All footers updated successfully.');
