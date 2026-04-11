
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

  document.querySelectorAll("#mobileMenu a").forEach((a) => {
    a.addEventListener("click", () => window.toggleMenu(true));
  });

  // -------------------------
  // 1.5) Scroll effects (Navbar glassmorphism)
  // -------------------------
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    });
  }

  // -------------------------
  // 1.8) Dinamik Kategori Yükleme (Ürünler Menüsü)
  // -------------------------
  async function loadNavbarData() {
    const urunlerNav = document.getElementById("urunlerNavItem");
    const urunlerDropdown = document.getElementById("urunlerDropdown");
    
    if (!urunlerDropdown) return;

    try {
      const response = await fetch("/api/categories/public");
      const data = await response.json();

      if (data.success && data.categories && data.categories.length > 0) {
        // Dropdown içeriğini temizle (opsiyonel, statik yedekleri korumak istersen kalsın)
        // urunlerDropdown.innerHTML = ""; 

        let html = "";
        data.categories.forEach(cat => {
          // İkon belirleme (isime göre eşleşme)
          let icon = "fa-tag";
          const name = cat.name.toLowerCase();
          if (name.includes("imza")) icon = "fa-pen-fancy";
          else if (name.includes("fatura")) icon = "fa-file-invoice";
          else if (name.includes("kep")) icon = "fa-envelope";
          else if (name.includes("mühür")) icon = "fa-stamp";
          else if (name.includes("damga")) icon = "fa-clock";
          else if (name.includes("irsaliye")) icon = "fa-truck-loading";
          else if (name.includes("defter")) icon = "fa-book";

          html += `<a href="urunler.html?kategori=${encodeURIComponent(cat.name)}"><i class="fas ${icon}"></i> ${cat.name}</a>`;
        });
        
        // "Tümünü Göster" linkini en sona ekle
        html += `<a href="urunler.html" style="border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: 5px;"><i class="fas fa-th-list"></i> Tümünü Göster</a>`;
        
        urunlerDropdown.innerHTML = html;
        console.log("✅ Kategoriler başarıyla yüklendi.");
      }
    } catch (err) {
      console.error("❌ Kategoriler yüklenirken hata oluştu:", err);
      // Hata durumunda HTML'deki statik yedekler görünecektir (hiçbir şey yapma)
    }
  }

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
      <div id="navUserAreaContent" style="display: flex; align-items: center; gap: 1rem;">
        <a class="login-btn" href="giris.html">Giriş Yap</a>
        <a class="register-btn" href="kayit.html">Kayıt Ol</a>
      </div>
      <a class="cart-btn" href="odeme.html" style="margin-left: 10px;">
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
    window.toggleDropdown('userDropdown');
  }
  window.toggleUserMenu = toggleUserMenu;

  // Global Dropdown Toggle (Daha robust)
  // Global Dropdown Toggle (Daha robust)
  window.toggleDropdown = function (id) {
    const drop = document.getElementById(id);
    if (!drop) return;
    
    const isOpen = drop.classList.contains("show");
    
    // Diğer TÜM dropdown'ları kapat (User menüsü dahil)
    document.querySelectorAll(".nav-dropdown-menu, .dropdown-menu").forEach(d => {
      if (d.id !== id) d.classList.remove("show");
    });
    
    // Tıklananı aç/kapat
    drop.classList.toggle("show", !isOpen);
    
    // Parent elemente 'open' class'ı ekle (ikon rotasyonu için)
    const parent = drop.closest('.nav-item-dropdown');
    if (parent) {
        parent.classList.toggle("open", !isOpen);
    }
  };

  function renderNavbarUser() {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
    const navArea = document.getElementById("navUserArea");

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
          <button class="user-btn" onclick="window.toggleDropdown('userDropdown')">
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
            <a href="faturalarim.html">
              <i class="fas fa-file-invoice"></i> Faturalarım
            </a>
            <a href="adreslerim.html">
              <i class="fas fa-map-marker-alt"></i> Adreslerim
            </a>
            <a href="destek-sorularim.html">
              <i class="fas fa-headset"></i> Destek Sorularım
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
    } catch (e) {
      console.error("Kullanıcı verisi hatası:", e);
      showLoginButton();
    }
    updateCartCount();
  }

  // Menülerin dışına tıklandığında her şeyi kapat
  document.addEventListener("click", (e) => {
    // Dropdown açan butonlara veya dropdown içine tıklanmadıysa kapat
    if (!e.target.closest('.nav-item-dropdown') && !e.target.closest('.user-menu')) {
        document.querySelectorAll(".nav-dropdown-menu, .dropdown-menu").forEach(d => {
            d.classList.remove("show");
        });
        document.querySelectorAll('.nav-item-dropdown').forEach(p => p.classList.remove('open'));
    }
  });

  // -------------------------
  // 4) Mobil Menü Dinamik İçerik (Giriş/Çıkış Linkleri)
  // -------------------------
  function renderMobileMenu() {
    const mobileNavLinks = document.querySelector(".mobile-nav-links");
    if (!mobileNavLinks) return;

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");

    // Mevcut linkleri koruyalım ama kullanıcıya özel olanları güncelleyelim
    // Veya basitleştirmek için sadece auth linklerini sona ekleyelim/güncelleyelim
    
    // Önce varsa eski auth linklerini temizleyelim (dinamik eklenenler)
    document.querySelectorAll(".mobile-auth-link").forEach(el => el.remove());

    if (!token || !userStr) {
      mobileNavLinks.insertAdjacentHTML('beforeend', `
        <li class="mobile-auth-link"><a href="giris.html" style="color: var(--secondary); border-top: 1px solid #f1f5f9; margin-top: 10px;"><i class="fas fa-sign-in-alt"></i> Giriş Yap</a></li>
        <li class="mobile-auth-link"><a href="kayit.html" style="color: var(--accent);"><i class="fas fa-user-plus"></i> Kayıt Ol</a></li>
      `);
    } else {
      try {
        const user = JSON.parse(userStr);
        mobileNavLinks.insertAdjacentHTML('beforeend', `
          <li class="mobile-auth-link" style="background: #f8fafc; margin-top: 10px; border-top: 1px solid #f1f5f9;">
            <a href="profil.html"><i class="fas fa-user-circle"></i> ${user.ad || 'Profilim'}</a>
          </li>
          <li class="mobile-auth-link"><a href="siparisler.html"><i class="fas fa-box"></i> Siparişlerim</a></li>
          <li class="mobile-auth-link"><a href="#" onclick="logout(); return false;" style="color: #ef4444;"><i class="fas fa-sign-out-alt"></i> Çıkış Yap</a></li>
        `);
      } catch (e) {
        console.error("Mobil menü render hatası:", e);
      }
    }
  }

  // İlk yükleme
  renderNavbarUser();
  loadNavbarData();
  updateCartCount();
  renderMobileMenu();

  // Sepet değişince sayıyı güncelle
  window.addEventListener("storage", updateCartCount);
});
