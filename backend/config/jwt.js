// config/jwt.js - Tek kaynak; production'da JWT_SECRET zorunlu

const isProd = process.env.NODE_ENV === "production";
const secret = process.env.JWT_SECRET;

if (isProd && !secret) {
    console.error("❌ Production'da JWT_SECRET zorunludur. .env dosyasını kontrol edin.");
    process.exit(1);
}
if (!secret && !isProd) {
    console.warn("⚠️ JWT_SECRET tanımlı değil; geliştirme secret kullanılıyor. Production'da mutlaka ayarlayın.");
}

module.exports = {
    JWT_SECRET: secret || "dev-secret-change-in-production",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h"
};
