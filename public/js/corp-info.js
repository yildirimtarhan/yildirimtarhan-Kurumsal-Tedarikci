/**
 * Kurumsal yasal bilgiler — tek kaynak.
 * ETBİS doğrulama: etbisDogrulamaUrl
 */
(function (global) {
  const DEFAULT = {
    unvan: 'KURUMSAL TEDARİKÇİ - YILDIRIM AYLUÇTARHAN',
    adres: 'Hacı Yusuf Mah. Eser Sokak No:4/10 Bandırma/Balıkesir',
    telefon: '0505 911 27 49',
    telefonDisplay: '+90 505 911 27 49',
    email: 'iletisim@tedarikci.org.tr',
    kep: 'yildirim.ayluctarhan@hs03.kep.tr',
    vergiDairesi: 'BANDIRMA',
    vkn: '1230162474',
    etbisKayitli: true,
    etbisNo: '',
    etbisSiteId: '4974d453-abbd-4891-bfaa-fb75ec124785',
    etbisDogrulamaUrl: 'https://etbis.ticaret.gov.tr/tr/SiteSorgulamaSonuc?siteId=4974d453-abbd-4891-bfaa-fb75ec124785',
    website: 'www.tedarikci.org.tr',
    websiteUrl: 'https://www.tedarikci.org.tr',
    etbisSorguUrl: 'https://etbis.ticaret.gov.tr/',
  };

  let corp = { ...DEFAULT };

  function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function etbisUrl() {
    return corp.etbisDogrulamaUrl || corp.etbisSorguUrl;
  }

  async function loadFromApi() {
    try {
      const base = typeof global.KT_API_URL === 'string' ? global.KT_API_URL : '/api';
      const res = await fetch(base + '/public/corp-info');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && data.corp) {
        Object.assign(corp, data.corp);
      }
    } catch (_) { /* statik varsayılanlar */ }
  }

  /** Tıklanabilir ETBİS linki — resmi kayıt sayfası */
  function etbisLinkHtml(label) {
    const text = label || 'ETBİS';
    return '<a href="' + etbisUrl() + '" target="_blank" rel="noopener noreferrer" class="etbis-official-link">' +
      esc(text) + '</a>';
  }

  function etbisLineHtml() {
    return etbisLinkHtml('ETBİS kayıtlı site doğrulama') +
      ' <span style="font-weight:400;opacity:.85">(Ticaret Bakanlığı)</span>';
  }

  function sellerInfoHtml() {
    return (
      '<p><strong>Ünvan:</strong> ' + esc(corp.unvan) + '</p>' +
      '<p><strong>Adres:</strong> ' + esc(corp.adres) + '</p>' +
      '<p><strong>Telefon:</strong> ' + esc(corp.telefon) + '</p>' +
      '<p><strong>E-posta:</strong> <a href="mailto:' + esc(corp.email) + '">' + esc(corp.email) + '</a></p>' +
      '<p><strong>KEP:</strong> ' + esc(corp.kep) + '</p>' +
      '<p><strong>Vergi Dairesi / No:</strong> ' + esc(corp.vergiDairesi) + ' / ' + esc(corp.vkn) + '</p>' +
      '<p><strong>ETBİS:</strong> ' + etbisLineHtml() + '</p>' +
      '<p><strong>Web:</strong> <a href="' + esc(corp.websiteUrl) + '" target="_blank" rel="noopener">' + esc(corp.website) + '</a></p>'
    );
  }

  function sellerTableRows() {
    return (
      '<tr><td>Ünvan</td><td>' + esc(corp.unvan) + '</td></tr>' +
      '<tr><td>Adres</td><td>' + esc(corp.adres) + '</td></tr>' +
      '<tr><td>Telefon</td><td>' + esc(corp.telefon) + '</td></tr>' +
      '<tr><td>E-posta</td><td>' + esc(corp.email) + '</td></tr>' +
      '<tr><td>KEP</td><td>' + esc(corp.kep) + '</td></tr>' +
      '<tr><td>Vergi Dairesi / No</td><td>' + esc(corp.vergiDairesi) + ' / ' + esc(corp.vkn) + '</td></tr>' +
      '<tr><td>ETBİS</td><td>' + etbisLineHtml() + '</td></tr>' +
      '<tr><td>Web sitesi</td><td><a href="' + esc(corp.websiteUrl) + '" target="_blank" rel="noopener">' + esc(corp.website) + '</a></td></tr>'
    );
  }

  function footerLegalHtml() {
    return (
      '<p class="corp-legal-line">' +
      esc(corp.unvan) + ' · ' + etbisLinkHtml('ETBİS Kayıtlı') + ' · ' +
      'VKN: ' + esc(corp.vkn) + ' · Vergi Dairesi: ' + esc(corp.vergiDairesi) + '<br>' +
      esc(corp.adres) + ' · Tel: ' + esc(corp.telefon) + ' · KEP: ' + esc(corp.kep) +
      '</p>'
    );
  }

  function applyDataCorpAttributes() {
    document.querySelectorAll('[data-corp]').forEach(function (el) {
      const key = el.getAttribute('data-corp');
      if (key === 'etbisNo' || key === 'etbisLink') {
        el.innerHTML = etbisLinkHtml('ETBİS kayıt bilgilerini görüntüle');
        return;
      }
      const val = corp[key];
      if (val != null && val !== '') el.textContent = val;
    });
    document.querySelectorAll('[data-corp-href]').forEach(function (el) {
      const key = el.getAttribute('data-corp-href');
      if (corp[key]) el.href = corp[key];
    });
    document.querySelectorAll('[data-corp-mail]').forEach(function (el) {
      const key = el.getAttribute('data-corp-mail');
      if (corp[key]) el.href = 'mailto:' + corp[key];
    });
    document.querySelectorAll('[data-etbis-link]').forEach(function (el) {
      el.href = etbisUrl();
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      if (!el.textContent.trim()) el.textContent = 'ETBİS kayıt doğrulama';
    });
  }

  function enhanceEtbisFooter() {
    const url = etbisUrl();

    document.querySelectorAll('.etbis-footer-badge').forEach(function (badge) {
      if (badge.dataset.etbisLinked) return;
      badge.dataset.etbisLinked = '1';
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'etbis-footer-badge etbis-footer-badge-link';
      a.title = 'ETBİS kayıt doğrulama — ' + corp.website;
      a.innerHTML = badge.innerHTML;
      badge.replaceWith(a);
    });

    document.querySelectorAll('.etbis-footer-text').forEach(function (el) {
      el.dataset.corpEnhanced = '1';
      el.innerHTML =
        'Bu site, T.C. Ticaret Bakanlığı Elektronik Ticaret Bilgi Sistemi (' +
        etbisLinkHtml('ETBİS') + ') kapsamında kayıtlı bir elektronik ticaret ortamıdır.';
    });
  }

  function injectFooterLegal() {
    document.querySelectorAll('[data-corp-legal-block]').forEach(function (el) {
      el.innerHTML = footerLegalHtml();
    });
    enhanceEtbisFooter();
  }

  function enhanceLegalLinks() {
    document.querySelectorAll('.legal-links').forEach(function (wrap) {
      if (wrap.querySelector('a[href="cerez-politikasi.html"]')) return;
      const a = document.createElement('a');
      a.href = 'cerez-politikasi.html';
      a.textContent = 'Çerez Politikası';
      wrap.appendChild(a);
    });
  }

  async function init() {
    await loadFromApi();
    applyDataCorpAttributes();
    injectFooterLegal();
    enhanceLegalLinks();
    const seller = document.getElementById('seller-info-block');
    if (seller) seller.innerHTML = sellerInfoHtml();
    const sellerTable = document.getElementById('seller-info-table-body');
    if (sellerTable) sellerTable.innerHTML = sellerTableRows();
  }

  global.KT_CORP = {
    get: function () { return { ...corp }; },
    load: loadFromApi,
    init: init,
    esc: esc,
    etbisUrl: etbisUrl,
    etbisLinkHtml: etbisLinkHtml,
    sellerInfoHtml: sellerInfoHtml,
    sellerTableRows: sellerTableRows,
    footerLegalHtml: footerLegalHtml,
    apply: applyDataCorpAttributes,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
