/**
 * Statik hosting (ör. Vercel) kullanıyorsanız, Node backend'in /api kökünün tam URL'sini yazın.
 * Boş bırakılırsa tarayıcı aynı siteden /api kullanır (sunucu + nginx/Vercel rewrite gerekir).
 * Örnek: window.__KT_API_BASE__ = "https://kurumsal-backend.onrender.com/api";
 */
window.__KT_API_BASE__ = window.__KT_API_BASE__ || "";

(function () {
  const h = window.location.hostname;
  const o = (window.__KT_API_BASE__ || "").trim();
  if (h === "localhost" || h === "127.0.0.1") {
    window.KT_API_URL = "http://localhost:3000/api";
  } else if (o) {
    window.KT_API_URL = o.replace(/\/$/, "");
  } else {
    window.KT_API_URL = "/api";
  }
})();
