/**
 * API Render'da, site Vercel/statik başka yerdeyse: aşağıdaki sabiti Render'daki servis URL'nizle doldurun.
 * Örnek: "https://kurumsal-api-xxxx.onrender.com/api" (Render Dashboard → servis → URL, sonuna /api ekleyin)
 *
 * Site ile API aynı domainde tek Node'da ise boş bırakın.
 */
const KT_RENDER_API_BASE = "https://api.tedarikci.org.tr/api";

window.__KT_API_BASE__ = window.__KT_API_BASE__ || KT_RENDER_API_BASE;

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
