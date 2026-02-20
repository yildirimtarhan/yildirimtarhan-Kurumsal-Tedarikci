// config/jwt.js

if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET environment variable tanımlı değil!");
    process.exit(1);
}

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: "24h"
};
