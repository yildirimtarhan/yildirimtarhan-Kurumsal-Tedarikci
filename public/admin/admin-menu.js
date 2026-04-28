(() => {
  const MENU = [
    { href: "index.html", icon: "fa-home", label: "Dashboard" },
    { href: "users.html", icon: "fa-users", label: "Kullanıcılar" },
    { href: "orders.html", icon: "fa-box", label: "Siparişler" },
    { href: "fatura-yonetim.html", icon: "fa-file-invoice-dollar", label: "Faturalar" },
    { href: "kasa-banka.html", icon: "fa-wallet", label: "Kasa & Banka" },
    { href: "cari-yonetim.html", icon: "fa-address-book", label: "Cari Hesaplar" },
    { href: "tahsilat-yonetim.html", icon: "fa-money-bill-wave", label: "Tahsilatlar" },
    { href: "muhasebe.html", icon: "fa-calculator", label: "Muhasebe & Beyan" },
    { href: "raporlar.html", icon: "fa-chart-bar", label: "Raporlar" },
    { href: "pazarlama.html", icon: "fa-bullhorn", label: "AI Pazarlama" },
    { href: "products.html", icon: "fa-cubes", label: "Ürünler (ERP)" },
    { href: "kargo-bildirim.html", icon: "fa-truck", label: "Kargo Bildirim" },
    { href: "hepsijet-test.html", icon: "fa-vial", label: "Hepsijet Test" },
    { href: "products-manage.html", icon: "fa-warehouse", label: "Stok Yönetimi" },
    { href: "paket-yonetim.html", icon: "fa-box-open", label: "Paket Yönetimi" },
    { href: "kategori-yonetim.html", icon: "fa-folder-tree", label: "Kategori Yönetimi" },
    { href: "bayilik-basvurulari.html", icon: "fa-store", label: "Bayilik Başvuruları" },
    { href: "support.html", icon: "fa-headset", label: "Destek Talepleri" },
  ];

  const LOGIN_PAGES = new Set(["login.html"]);

  function currentFileName() {
    const parts = String(window.location.pathname || "").split("/");
    const last = parts[parts.length - 1] || "";
    return last || "index.html";
  }

  function ensureAuth() {
    const file = currentFileName();
    if (LOGIN_PAGES.has(file)) return;

    const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
    if (!token) {
      window.location.href = "login.html";
    }
  }

  function ensureLogout() {
    if (typeof window.logout === "function") return;
    window.logout = function logout() {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("token");
      localStorage.removeItem("adminUser");
      window.location.href = "login.html";
    };
  }

  function isTailwindSidebar(navEl) {
    // Heuristic: our tailwind pages use <span class="menu-text"> in links.
    return Boolean(navEl && navEl.querySelector(".menu-text"));
  }

  function buildTailwindLink(item, active) {
    const base =
      "flex items-center gap-3 px-4 py-3 rounded-lg mb-1 " +
      (active
        ? "bg-blue-600 text-white"
        : "text-gray-300 hover:bg-slate-800 hover:text-white");
    return `
      <a href="${item.href}" class="${base}">
        <i class="fas ${item.icon} w-5"></i>
        <span class="menu-text">${item.label}</span>
      </a>
    `;
  }

  function buildSimpleLink(item, active) {
    const cls = active ? "active" : "";
    return `<a href="${item.href}" class="${cls}"><i class="fas ${item.icon}"></i> ${item.label}</a>`;
  }

  function renderMenu() {
    const file = currentFileName();
    if (LOGIN_PAGES.has(file)) return;

    const sidebarById = document.getElementById("sidebar");
    const sidebarByClass = document.querySelector(".sidebar");

    const nav =
      (sidebarById && sidebarById.querySelector("nav")) ||
      (sidebarByClass && sidebarByClass.querySelector("nav")) ||
      null;

    if (!nav) {
      // Simple sidebar pages often have links directly in .sidebar.
      if (!sidebarByClass) return;

      const h2 = sidebarByClass.querySelector("h2");
      const titleHtml = h2 ? `<h2>${h2.textContent || "Kurumsal Tedarikçi"}</h2>` : `<h2>Kurumsal Tedarikçi</h2>`;
      const links = MENU.map((it) => buildSimpleLink(it, it.href === file)).join("\n");
      const logout = `<a href="#" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Çıkış Yap</a>`;
      sidebarByClass.innerHTML = `${titleHtml}\n${links}\n${logout}`;
      return;
    }

    const useTailwind = isTailwindSidebar(nav);
    const html = MENU.map((it) =>
      useTailwind ? buildTailwindLink(it, it.href === file) : buildSimpleLink(it, it.href === file)
    ).join("\n");

    if (useTailwind) {
      nav.innerHTML =
        html +
        `
        <a href="#" onclick="logout()" class="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-slate-800 hover:text-white rounded-lg mb-1">
          <i class="fas fa-sign-out-alt w-5"></i>
          <span class="menu-text">Çıkış Yap</span>
        </a>
      `;
    } else {
      nav.innerHTML = html + `\n<a href="#" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Çıkış Yap</a>`;
    }
  }

  ensureLogout();
  ensureAuth();
  // Wait for DOM (some pages put scripts in <head>)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMenu);
  } else {
    renderMenu();
  }
})();

