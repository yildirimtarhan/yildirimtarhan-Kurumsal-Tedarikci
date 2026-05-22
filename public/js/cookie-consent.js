/**
 * Çerez onay bandı — KVKK uyumu
 */
(function () {
  var KEY = 'kt_cookie_consent_v1';
  if (localStorage.getItem(KEY)) return;

  var bar = document.createElement('div');
  bar.id = 'kt-cookie-bar';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Çerez bildirimi');
  bar.innerHTML =
    '<div class="kt-cookie-inner">' +
    '<p>Bu sitede deneyiminizi iyileştirmek ve yasal yükümlülüklerimizi yerine getirmek için zorunlu ve tercihe bağlı çerezler kullanılmaktadır. ' +
    '<a href="cerez-politikasi.html">Çerez Politikası</a> ve <a href="gizlilik-ve-guvenlik-politikasi.html">Gizlilik Politikası</a>.</p>' +
    '<div class="kt-cookie-actions">' +
    '<button type="button" id="kt-cookie-accept" class="kt-cookie-btn primary">Kabul Et</button>' +
    '<button type="button" id="kt-cookie-essential" class="kt-cookie-btn">Yalnızca Zorunlu</button>' +
    '</div></div>';

  document.body.appendChild(bar);
  document.body.classList.add('has-cookie-bar');

  function save(level) {
    localStorage.setItem(KEY, JSON.stringify({ level: level, at: new Date().toISOString() }));
    bar.remove();
    document.body.classList.remove('has-cookie-bar');
  }

  document.getElementById('kt-cookie-accept').addEventListener('click', function () { save('all'); });
  document.getElementById('kt-cookie-essential').addEventListener('click', function () { save('essential'); });
})();
