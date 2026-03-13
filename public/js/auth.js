document.addEventListener("DOMContentLoaded", () => {

  // Kullanıcı alanı
  const navArea = document.getElementById("navUserArea");

  // LocalStorage veya sessionStorage'dan user al (Beni hatırla işaretlenmemişse sessionStorage kullanılır)
  const userData = localStorage.getItem("user") || sessionStorage.getItem("user");

  // Kullanıcı giriş yaptıysa navbar değiştir
  if (userData && navArea) {

    const user = JSON.parse(userData);

    navArea.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">

        <a href="giris.html" class="login-btn">
          👤 ${user.ad}
        </a>

        <button onclick="logout()"
          style="
            background:#ef4444;
            color:white;
            border:none;
            padding:8px 14px;
            border-radius:10px;
            cursor:pointer;
            font-weight:600;
          ">
          Çıkış
        </button>

        <a class="cart-btn" href="odeme.html">
          <i class="fas fa-shopping-cart"></i>
          <span class="cart-count" id="cart-count">0</span>
        </a>

      </div>
    `;
  }

  updateCartCount();
});


// Çıkış fonksiyonu
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  alert("Çıkış yapıldı");
  window.location.href = "index.html";
}


// Sepet sayısını güncelle
function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("kurumsalSepet")) || [];
  const countEl = document.getElementById("cart-count");

  if (countEl) {
    countEl.innerText = cart.length;
  }
}
