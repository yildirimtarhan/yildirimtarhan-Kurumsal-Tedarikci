const fs = require('fs');
const path = require('path');

const publicPath = path.join(process.cwd(), 'public');
const files = fs.readdirSync(publicPath).filter(f => f.endsWith('.html'));

const corpTitle = "KURUMSAL TEDARİKÇİ - YILDIRIM AYLUÇTARHAN";
const corpAddress = "Hacı Yusuf Mah. Eser Sokak No:4/10 Bandırma/Balıkesir";
const corpTaxOffice = "BANDIRMA";
const corpTaxNo = "1230162474";
const corpKep = "yildirim.ayluctarhan@hs03.kep.tr";
const corpEmail = "iletisim@tedarikci.org.tr";

const footerHtml = `
    <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 2rem; line-height: 1.6;">
        ${corpTitle} | Vergi Dairesi: ${corpTaxOffice} | Vergi No: ${corpTaxNo}<br>
        Adres: ${corpAddress} | Kep Adresi: ${corpKep}
    </div>
`;

files.forEach(file => {
    const filePath = path.join(publicPath, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace footer patterns
    const footerRegex = /<div style="font-size: 0\.85rem; opacity: 0\.7; margin-bottom: 2rem; line-height: 1\.6;">[\s\S]*?<\/div>/g;
    
    if (content.match(footerRegex)) {
        content = content.replace(footerRegex, footerHtml);
        fs.writeFileSync(filePath, content);
        console.log(`Updated footer in ${file}`);
    } else {
        // If not found, try a generic placeholder replace
        if (content.includes('[ŞİRKET TAM ADI]')) {
             content = content.replace('[ŞİRKET TAM ADI]', corpTitle)
                              .replace('[MERSİS NO]', '-')
                              .replace('[VERGİ NO]', corpTaxNo)
                              .replace('[KEP ADRESİ]', corpKep)
                              .replace('[ŞİRKET ADRESİ]', corpAddress);
             fs.writeFileSync(filePath, content);
             console.log(`Replaced placeholders in ${file}`);
        }
    }
});
