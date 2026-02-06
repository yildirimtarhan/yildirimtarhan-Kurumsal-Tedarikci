
document.addEventListener('DOMContentLoaded', function () {

  const mobileMenu = document.getElementById('mobileMenu');
  const menuBtn = document.getElementById('menuBtn');
  const closeMenuBtn = document.getElementById('closeMenuBtn');
  const body = document.body;

  let isMenuOpen = false;

  function openMenu() {
    if (!mobileMenu) return;
    isMenuOpen = true;
    mobileMenu.classList.add('active');
    body.classList.add('menu-open');
    if (menuBtn) menuBtn.innerHTML = '<i class="fas fa-times"></i>';
  }

  function closeMenu() {
    if (!mobileMenu) return;
    isMenuOpen = false;
    mobileMenu.classList.remove('active');
    body.classList.remove('menu-open');
    if (menuBtn) menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      isMenuOpen ? closeMenu() : openMenu();
    });
  }

  if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeMenu();
    });
  }

  if (mobileMenu) {
    mobileMenu.addEventListener('click', function (e) {
      if (e.target === mobileMenu) closeMenu();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isMenuOpen) closeMenu();
  });

  // Menü linkine basınca kapat
  document.querySelectorAll('.mobile-nav-links a').forEach(link => {
    link.addEventListener('click', () => closeMenu());
  });

  // SEPET SAYISI – TEK STANDARD
  function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('kurumsalSepet')) || [];
    const countElement = document.getElementById('cart-count');
    if (countElement) countElement.innerText = cart.length;
  }

  updateCartCount();
});
