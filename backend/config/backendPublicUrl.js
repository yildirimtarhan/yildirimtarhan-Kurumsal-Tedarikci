/**
 * OAuth redirect_uri ve dış API URL'leri için kamuya açık backend kökü.
 * Render'da BACKEND_PUBLIC_URL unutulursa RENDER_EXTERNAL_URL kullanılır.
 */
function backendPublicUrl() {
  const explicit =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN;
  if (explicit) {
    const u = String(explicit).replace(/\/$/, "");
    if (!/^https?:\/\//i.test(u) && process.env.RAILWAY_PUBLIC_DOMAIN) {
      return `https://${u}`;
    }
    return u;
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}

module.exports = { backendPublicUrl };
