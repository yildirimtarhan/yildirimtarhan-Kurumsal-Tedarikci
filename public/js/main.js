
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
    // Hem eski hem yeni anahtarları destekle
    let cart = [];
    try {
      const legacy = JSON.parse(localStorage.getItem("kurumsalSepet") || "[]");
      const modern = JSON.parse(localStorage.getItem("cart") || "[]");
      cart = Array.isArray(modern) && modern.length ? modern : legacy;
    } catch (_) {
      cart = [];
    }

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
  // 3) Navbar kullanıcı alanı (tüm sayfalarda, dropdown'lı)
  // -------------------------
  function showLoginButton() {
    const navArea = document.getElementById("navUserArea");
    if (!navArea) return;
    navArea.innerHTML = `
      <a class="login-btn" href="giris.html">Giriş Yap</a>
      <a class="register-btn" href="kayit.html">Kayıt Ol</a>
      <a class="cart-btn" href="odeme.html">
        <i class="fas fa-shopping-cart"></i>
        <span class="cart-count" id="cart-count">0</span>
      </a>
    `;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    alert("Çıkış yapıldı");
    window.location.href = "index.html";
  }
  window.logout = logout;

  function toggleUserMenu() {
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.toggle("show");
  }
  window.toggleUserMenu = toggleUserMenu;

  window.toggleUrunlerMenu = function () {
    const drop = document.getElementById("urunlerDropdown");
    const item = document.getElementById("urunlerNavItem");
    if (!drop || !item) return;
    drop.classList.toggle("show");
    item.classList.toggle("open");
  };

  function renderNavbarUser() {
    // Hem localStorage hem sessionStorage kontrol et (Beni hatırla işaretlenmemişse sessionStorage kullanılır)
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
    const navArea = document.getElementById("navUserArea");

    if (!navArea) {
      updateCartCount();
      return;
    }

    if (!token || !userStr) {
      showLoginButton();
      updateCartCount();
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const userInitial = user.ad ? user.ad.charAt(0).toUpperCase() : "U";
      const userName = user.ad || "Kullanıcı";
      const userEmail = user.email || "";

      navArea.innerHTML = `
        <div class="user-menu" id="userMenu">
          <button class="user-btn" onclick="toggleUserMenu()">
            <div class="user-avatar">${userInitial}</div>
            <span>${userName}</span>
            <i class="fas fa-chevron-down" style="font-size: 12px; margin-left: 5px;"></i>
          </button>
          
          <div class="dropdown-menu" id="userDropdown">
            <div class="dropdown-header">
              <strong>${userName}</strong>
              <span>${userEmail}</span>
            </div>
            <a href="profil.html">
              <i class="fas fa-user"></i> Profilim
            </a>
            <a href="siparisler.html">
              <i class="fas fa-box"></i> Siparişlerim
            </a>
            <a href="musteri/faturalarim.html">
              <i class="fas fa-file-invoice"></i> Faturalarım
            </a>
            <a href="adreslerim.html">
              <i class="fas fa-map-marker-alt"></i> Adreslerim
            </a>
            <a href="destek-sorularim.html">
              <i class="fas fa-headset"></i> Destek Sorularım
            </a>
            <a href="kargo-takip.html">
              <i class="fas fa-shipping-fast"></i> Kargo Takip
            </a>
            <a href="sifre-degistir.html">
              <i class="fas fa-lock"></i> Şifre Değiştir
            </a>
            <div class="dropdown-divider"></div>
            <button onclick="logout()">
              <i class="fas fa-sign-out-alt"></i> Çıkış Yap
            </button>
          </div>
        </div>

        <a class="cart-btn" href="odeme.html">
          <i class="fas fa-shopping-cart"></i>
          <span class="cart-count" id="cart-count">0</span>
        </a>
      `;

      // Dışarı tıklayınca menüyü kapat
      document.addEventListener("click", (e) => {
        const userMenu = document.getElementById("userMenu");
        const dropdown = document.getElementById("userDropdown");
        if (userMenu && dropdown && !userMenu.contains(e.target)) {
          dropdown.classList.remove("show");
        }
        const urunlerItem = document.getElementById("urunlerNavItem");
        const urunlerDrop = document.getElementById("urunlerDropdown");
        if (urunlerDrop && urunlerItem && !urunlerItem.contains(e.target)) {
          urunlerDrop.classList.remove("show");
          urunlerItem.classList.remove("open");
        }
      });
    } catch (e) {
      console.error("Kullanıcı verisi hatası:", e);
      showLoginButton();
    }

    updateCartCount();
  }

  // İlk yükleme
  renderNavbarUser();
  updateCartCount();

  // Sepet değişince sayıyı güncelle (aynı tab)
  window.addEventListener("storage", updateCartCount);
});
