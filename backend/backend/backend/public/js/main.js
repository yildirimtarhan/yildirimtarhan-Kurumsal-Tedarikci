
console.log("✅ main.js yüklendi!");

document.addEventListener("DOMContentLoaded", () => {
  // -------------------------
  // 1) Mobil Menü (eski HTML yapına uyumlu)
  // -------------------------
  const mobileMenu = document.getElementById("mobileMenu");
  const menuIcon = document.getElementById("menuIcon"); // senin HTML’de var
  const body = document.body;

  function setMenuOpen(open) {
    if (!mobileMenu) return;
    mobileMenu.classList.toggle("active", open);
    body.classList.toggle("menu-open", open);
    if (menuIcon) menuIcon.className = open ? "fas fa-times" : "fas fa-bars";
  }

  // HTML’de onclick="toggleMenu()" kullandığın için global fonksiyon bırakıyoruz
  window.toggleMenu = function (forceClose) {
    if (!mobileMenu) return;
    const isOpen = mobileMenu.classList.contains("active");
    const next = forceClose === true ? false : !isOpen;
    setMenuOpen(next);
  };

  // overlay tıkla kapat
  document.addEventListener("click", (e) => {
    if (!mobileMenu || !mobileMenu.classList.contains("active")) return;
    if (e.target === mobileMenu) window.toggleMenu(true);
  });

  // ESC kapat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") window.toggleMenu(true);
  });

  // Mobil menüde linke basınca kapat
  document.querySelectorAll("#mobileMenu a").forEach((a) => {
    a.addEventListener("click", () => window.toggleMenu(true));
  });

  // -------------------------
  // 2) Sepet sayısı (adet toplamı)
  // -------------------------
  function getCartCount() {
    const cart = JSON.parse(localStorage.getItem("kurumsalSepet") || "[]");
    // qty / adet alanlarına uyumlu
    return cart.reduce((sum, item) => {
      const q = Number(item.qty ?? item.adet ?? 1);
      return sum + (isNaN(q) ? 1 : q);
    }, 0);
  }

  function updateCartCount() {
    const countEl = document.getElementById("cart-count");
    if (countEl) countEl.textContent = String(getCartCount());
  }

  // -------------------------
  // 3) Navbar kullanıcı alanı (tüm sayfalarda)
  // -------------------------
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // istersen sepeti silme: sipariş öncesi lazım olabilir
    // localStorage.removeItem("kurumsalSepet");
    window.location.href = "index.html";
  }
  window.logout = logout; // buton onclick için

  function renderNavbarUser() {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    // Senin sayfalarında bazen "navUserArea" yok, bazen login-btn var.
    const navArea = document.getElementById("navUserArea"); // önerilen
    const loginBtn = document.querySelector(".login-btn, .btn-login"); // mevcut yapın
    const navRight = document.querySelector(".nav-right"); // bazı sayfalarda var

    let user = null;
    try {
      if (userStr) user = JSON.parse(userStr);
    } catch (_) {}

    const isLogged = Boolean(token && user && (user.ad || user.email));

    // 1) Eğer navUserArea varsa onu doldur (en temiz yöntem)
    if (navArea) {
      if (!isLogged) {
        navArea.innerHTML = `
          <a class="login-btn" href="giris.html">Giriş Yap</a>
          <a class="cart-btn" href="odeme.html">
            <i class="fas fa-shopping-cart"></i>
            <span class="cart-count" id="cart-count">0</span>
          </a>
        `;
      } else {
        const name = (user.ad || user.email || "Hesabım").toUpperCase();
        navArea.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <a href="giris.html" class="login-btn" title="Hesabım">
              👤 ${name}
            </a>
            <button onclick="logout()"
              style="
                background:#ef4444;color:#fff;border:none;
                padding:8px 14px;border-radius:10px;
                cursor:pointer;font-weight:600;
              ">Çıkış</button>
            <a class="cart-btn" href="odeme.html">
              <i class="fas fa-shopping-cart"></i>
              <span class="cart-count" id="cart-count">0</span>
            </a>
          </div>
        `;
      }
      updateCartCount();
      return;
    }

    // 2) navUserArea yoksa: mevcut login butonunu dönüştür (minimal müdahale)
    if (isLogged && loginBtn) {
      loginBtn.textContent = "👤 " + (user.ad || user.email);
      loginBtn.setAttribute("href", "giris.html"); // profil.html yoksa hata vermesin
      // Çıkış butonu ekle (yanına)
      if (navRight && !document.getElementById("logoutBtn")) {
        const btn = document.createElement("button");
        btn.id = "logoutBtn";
        btn.textContent = "Çıkış";
        btn.onclick = logout;
        btn.style.cssText =
          "background:#ef4444;color:#fff;border:none;padding:8px 14px;border-radius:10px;cursor:pointer;font-weight:600;";
        navRight.insertBefore(btn, navRight.querySelector(".cart-btn"));
      }
    }

    updateCartCount();
  }

  // İlk yükleme
  renderNavbarUser();
  updateCartCount();

  // Sepet değişince sayıyı güncelle (aynı tab)
  window.addEventListener("storage", updateCartCount);
});
