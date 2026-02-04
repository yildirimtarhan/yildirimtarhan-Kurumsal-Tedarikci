document.addEventListener('DOMContentLoaded', function() {
    // MOBİL MENÜ KONTROLLERİ
    const mobileMenu = document.getElementById('mobileMenu');
    const menuBtn = document.getElementById('menuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const body = document.body;
    
    let isMenuOpen = false;
    
    function openMenu() {
        isMenuOpen = true;
        mobileMenu.classList.add('active');
        body.classList.add('menu-open');
        if(menuBtn) menuBtn.innerHTML = '<i class="fas fa-times"></i>';
    }
    
    function closeMenu() {
        isMenuOpen = false;
        mobileMenu.classList.remove('active');
        body.classList.remove('menu-open');
        if(menuBtn) menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }
    
    // Menü butonu
    if(menuBtn) {
        menuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            isMenuOpen ? closeMenu() : openMenu();
        });
    }
    
    // Kapatma butonu
    if(closeMenuBtn) {
        closeMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeMenu();
        });
    }
    
    // Dışarı tıklayınca kapat
    if(mobileMenu) {
        mobileMenu.addEventListener('click', function(e) {
            if(e.target === mobileMenu) closeMenu();
        });
    }
    
    // MENÜ LİNKLERİ - SADECE CLICK (touch yok, çift tetiklemeyi engeller)
    const mobileLinks = document.querySelectorAll('.mobile-nav-links a');
    mobileLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Boş link kontrolü
            if(!href || href === '#') {
                e.preventDefault();
                return;
            }
            
            // Menüyü kapat
            closeMenu();
            
            // Normal yönlendirmeye izin ver (preventDefault YOK!)
            // Tarayıcı kendi yönlendirsin
        });
    });
    
    // ESC ile kapat
    document.addEventListener('keydown', function(e) {
        if(e.key === 'Escape' && isMenuOpen) closeMenu();
    });
    
    // SEPET SAYISI
    function updateCartCount() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const countElement = document.getElementById('cart-count');
        if(countElement) countElement.innerText = cart.length;
    }
    updateCartCount();
});