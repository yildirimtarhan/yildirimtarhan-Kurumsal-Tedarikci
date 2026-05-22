const express = require('express');
const router = express.Router();

router.get('/corp-info', (req, res) => {
  res.json({
    success: true,
    corp: {
      unvan: process.env.FIRMA_UNVAN || 'KURUMSAL TEDARİKÇİ - YILDIRIM AYLUÇTARHAN',
      adres: process.env.FIRMA_ADRES || 'Hacı Yusuf Mah. Eser Sokak No:4/10 Bandırma/Balıkesir',
      telefon: process.env.FIRMA_TELEFON || '0505 911 27 49',
      telefonDisplay: process.env.FIRMA_TELEFON || '+90 505 911 27 49',
      email: process.env.FIRMA_EMAIL || 'iletisim@tedarikci.org.tr',
      kep: process.env.FIRMA_KEP || 'yildirim.ayluctarhan@hs03.kep.tr',
      vergiDairesi: process.env.FIRMA_VERGI_DAIRESI || 'BANDIRMA',
      vkn: process.env.FIRMA_VKN || process.env.TAXTEN_VKN || '1230162474',
      mersisNo: process.env.FIRMA_MERSIS || '',
      etbisNo: process.env.FIRMA_ETBIS_NO || '',
      website: process.env.FIRMA_WEBSITE || 'www.tedarikci.org.tr',
      websiteUrl: process.env.FRONTEND_URL || 'https://www.tedarikci.org.tr',
    },
  });
});

module.exports = router;
