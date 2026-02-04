// Loading Animation
window.addEventListener('load', () => {
    const loader = document.querySelector('.loader');
    if(loader) loader.classList.add('hidden');
    
    // Start counter animation
    animateCounters();
});

// Header Scroll Effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    const backToTop = document.querySelector('.back-to-top');
    
    if (window.scrollY > 100) {
        if(header) header.style.boxShadow = '0 2px 30px rgba(0,0,0,0.1)';
        if(backToTop) backToTop.classList.add('visible');
    } else {
        if(header) header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.05)';
        if(backToTop) backToTop.classList.remove('visible');
    }
});

// Smooth Scroll (Sadece # ile başlayan linkler için)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Counter Animation
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-count');
        if(!target) return;
        
        const increment = target / 50;
        let current = 0;
        
        const updateCounter = () => {
            if (current < target) {
                current += increment;
                counter.innerText = Math.ceil(current);
                setTimeout(updateCounter, 30);
            } else {
                counter.innerText = target + (target === 99 ? '' : '+');
            }
        };
        
        updateCounter();
    });
}

// Scroll to Top
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Intersection Observer for Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements
document.querySelectorAll('.feature-card, .why-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
});

// Logo error handling (Eğer logo-img varsa)
document.addEventListener('DOMContentLoaded', () => {
    const logoImg = document.getElementById('logo-img');
    if(logoImg) {
        logoImg.addEventListener('error', function() {
            this.src = 'https://via.placeholder.com/50x50/2563eb/ffffff?text=KT';
        });
    }
});

// NOT: Mobil menü kodu artık index.html içinde inline olarak var!
// Eski toggleMenu() fonksiyonu kaldırıldı çünkü index.html içindeki kodla çakışıyordu.