/**
 * Türkiye Adres API - İl, İlçe, Mahalle
 * Veri kaynağı: metinyildirimnet/turkiye-adresler-json
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Türkçe büyük harf (karşılaştırma için)
function toUpperTR(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
}

// Başlık formatı (ADANA -> Adana, İSTANBUL -> İstanbul)
function toTitleTR(s) {
  if (!s || typeof s !== 'string') return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Cache - uygulama çalışırken bir kez yüklenir
let cache = {
  iller: null,
  ilceler: null,
  mahalleler: null,
  mahalleIndex: null, // { "IL|ILCE": ["mahalle1", ...] }
};

function loadCache() {
  if (cache.iller) return;
  try {
    const sehirlerPath = path.join(DATA_DIR, 'sehirler.json');
    const ilcelerPath = path.join(DATA_DIR, 'ilceler.json');
    if (fs.existsSync(sehirlerPath)) {
      cache.iller = JSON.parse(fs.readFileSync(sehirlerPath, 'utf8'));
    }
    if (fs.existsSync(ilcelerPath)) {
      cache.ilceler = JSON.parse(fs.readFileSync(ilcelerPath, 'utf8'));
    }
    // Mahalleler - 4 dosyayı birleştir
    cache.mahalleler = [];
    cache.mahalleIndex = {};
    for (let i = 1; i <= 4; i++) {
      const p = path.join(DATA_DIR, `mahalleler-${i}.json`);
      if (fs.existsSync(p)) {
        const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(arr)) {
          cache.mahalleler = cache.mahalleler.concat(arr);
          for (const m of arr) {
            const sehir = toUpperTR((m.sehir_adi || '').trim());
            const ilce = toUpperTR((m.ilce_adi || '').trim());
            const mah = (m.mahalle_adi || '').trim();
            if (!sehir || !ilce || !mah) continue;
            const key = `${sehir}|${ilce}`;
            if (!cache.mahalleIndex[key]) cache.mahalleIndex[key] = [];
            if (!cache.mahalleIndex[key].includes(mah)) {
              cache.mahalleIndex[key].push(mah);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Adres verisi yüklenemedi:', err.message);
  }
}

// Normalize il/ilçe adı - JSON büyük harf kullanıyor
function normalizeAd(s) {
  return (s || '').toString().trim();
}

/**
 * GET /api/adres/iller
 * Tüm illeri döndürür
 */
router.get('/iller', (req, res) => {
  loadCache();
  if (!cache.iller || !Array.isArray(cache.iller)) {
    return res.json({ success: true, iller: [] });
  }
  const iller = cache.iller
    .map((s) => toTitleTR((s.sehir_adi || '').trim()))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'tr'));
  res.json({ success: true, iller });
});

/**
 * GET /api/adres/ilceler?il=İstanbul
 * Verilen ile ait ilçeleri döndürür
 */
router.get('/ilceler', (req, res) => {
  loadCache();
  const il = normalizeAd(req.query.il);
  if (!il) {
    return res.json({ success: true, ilceler: [] });
  }
  const ilUpper = toUpperTR(il);
  if (!cache.ilceler || !Array.isArray(cache.ilceler)) {
    return res.json({ success: true, ilceler: [] });
  }
  const ilceler = cache.ilceler
    .filter((c) => toUpperTR(c.sehir_adi) === ilUpper)
    .map((c) => toTitleTR((c.ilce_adi || '').trim()))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'tr'));
  const unique = [...new Set(ilceler)];
  res.json({ success: true, ilceler: unique });
});

/**
 * GET /api/adres/mahalleler?il=İstanbul&ilce=Kadıköy
 * Verilen il ve ilçeye ait mahalleleri döndürür
 */
router.get('/mahalleler', (req, res) => {
  loadCache();
  const il = normalizeAd(req.query.il);
  const ilce = normalizeAd(req.query.ilce);
  if (!il || !ilce) {
    return res.json({ success: true, mahalleler: [] });
  }
  const ilUpper = toUpperTR(il);
  const ilceUpper = toUpperTR(ilce);
  const key = `${ilUpper}|${ilceUpper}`;
  let mahalleler = (cache.mahalleIndex && cache.mahalleIndex[key]) || [];
  if (Array.isArray(mahalleler)) {
    mahalleler = [...mahalleler].map((m) => toTitleTR(String(m))).sort((a, b) => a.localeCompare(b, 'tr'));
  } else {
    mahalleler = [];
  }
  res.json({ success: true, mahalleler });
});

/**
 * GET /api/adres/sokaklar?il=...&ilce=...&mahalle=...
 * Sokak verisi - şu an kaynak yok, boş dönüyor (ileride genişletilebilir)
 */
router.get('/sokaklar', (req, res) => {
  res.json({ success: true, sokaklar: [] });
});

module.exports = router;
