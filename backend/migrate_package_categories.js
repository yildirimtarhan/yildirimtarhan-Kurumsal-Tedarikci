/**
 * migrate_package_categories.js
 * ---------------------------------------------------
 * Mevcut paketlerin category alanını isimlerine göre otomatik atar.
 * Çalıştırma: node backend/migrate_package_categories.js
 */

require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const Package  = require('./models/Package');

function tahminEt(name) {
    const n = (name || '').toLowerCase()
        .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o')
        .replace(/ç/g, 'c');

    if (n.includes('irsaliye'))                                   return 'E-İrsaliye Paketleri';
    if (n.includes('smm') || n.includes('serbest') || n.includes('meslek')) return 'E-SMM Paketleri';
    if (n.includes('mmm') || n.includes('mustahsil') || (n.includes('e-mm') && !n.includes('smm')) || (n.startsWith('emm') && !n.startsWith('esmm'))) return 'E-MMM Paketleri';
    if (n.includes('defter'))                                      return 'E-Defter Paketleri';
    if (n.includes('kep') || n.includes('kayitli'))                return 'KEP Paketleri';
    if (n.includes('muhur'))                                       return 'Mali Mühür Paketleri';
    if (n.includes('damga'))                                       return 'Zaman Damgası Paketleri';
    if (n.includes('fatura') || n.includes('kontor') || n.includes('arsiv')) return 'E-Dönüşüm (E-Fatura Köntörü) Paketleri';
    if (n.includes('imza'))                                        return 'E-İmza Paketleri';
    return 'Diğer';
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ MongoDB bağlandı.');

    const pkgs = await Package.find({});
    console.log(`📦 Toplam ${pkgs.length} paket bulundu.\n`);

    let updated = 0;
    for (const pkg of pkgs) {
        // 'Diğer' olanları da yeniden sınıflandır
        if (pkg.category && pkg.category !== 'E-İmza Paketleri' && pkg.category !== 'Diğer') {
            console.log(`  ⏭  ${pkg.name} → zaten "${pkg.category}" var, atlandı.`);
            continue;
        }
        const yeniKat = tahminEt(pkg.name);
        await Package.updateOne({ _id: pkg._id }, { $set: { category: yeniKat } });
        console.log(`  ✏️  ${pkg.name} → "${yeniKat}"`);
        updated++;
    }

    console.log(`\n🎉 ${updated} paket güncellendi.`);
    await mongoose.disconnect();
}

run().catch(err => { console.error('❌ Hata:', err.message); process.exit(1); });
