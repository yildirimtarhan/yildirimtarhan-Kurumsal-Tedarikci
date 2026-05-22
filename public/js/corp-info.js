/**
 * Kurumsal yasal bilgiler — tek kaynak.
 * ETBİS kayıt no: FIRMA_ETBIS_NO (Vercel/Render) veya etbisNo aşağıda.
 * MERSİS: Bu işletmede MERSİS kaydı yoktur (şahıs işletmesi — ETBİS ile kayıtlı).
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
    mersisNo: '',
    hasMersis: false,
    etbisKayitli: true,
    etbisNo: '',
    etbisSiteId: '4974d453-abbd-4891-bfaa-fb75ec124785',
    etbisDogrulamaUrl: 'https://etbis.ticaret.gov.tr/tr/SiteSorgulamaSonuc?siteId=4974d453-abbd-4891-bfaa-fb75ec124785',
    website: 'www.tedarikci.org.tr',
    websiteUrl: 'https://www.tedarikci.org.tr',
    etbisSorguUrl: 'https://etbis.ticaret.gov.tr/',
    eticaretPortalUrl: 'https://www.eticaret.gov.tr/',
  };

  let corp = { ...DEFAULT };

  function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
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

  function etbisLineHtml() {
    const dogrulama = corp.etbisDogrulamaUrl || corp.etbisSorguUrl;
    if (corp.etbisNo) {
      return 'ETBİS Kayıt No: <strong>' + esc(corp.etbisNo) + '</strong> · ' +
        '<a href="' + dogrulama + '" target="_blank" rel="noopener">Resmi doğrulama</a>';
    }
    if (corp.etbisSiteId) {
      return 'ETBİS Kayıtlı Site · ' +
        '<a href="' + dogrulama + '" target="_blank" rel="noopener">Ticaret Bakanlığı doğrulama sayfası</a>';
    }
    return 'ETBİS Kayıtlı Elektronik Ticaret Ortamı · ' +
      '<a href="' + corp.etbisSorguUrl + '" target="_blank" rel="noopener">etbis.ticaret.gov.tr</a>';
  }

  function sellerInfoHtml() {
    let html =
      '<p><strong>Ünvan:</strong> ' + esc(corp.unvan) + '</p>' +
      '<p><strong>Adres:</strong> ' + esc(corp.adres) + '</p>' +
      '<p><strong>Telefon:</strong> ' + esc(corp.telefon) + '</p>' +
      '<p><strong>E-posta:</strong> <a href="mailto:' + esc(corp.email) + '">' + esc(corp.email) + '</a></p>' +
      '<p><strong>KEP:</strong> ' + esc(corp.kep) + '</p>' +
      '<p><strong>Vergi Dairesi / No:</strong> ' + esc(corp.vergiDairesi) + ' / ' + esc(corp.vkn) + '</p>';
    if (corp.mersisNo) {
      html += '<p><strong>MERSİS No:</strong> ' + esc(corp.mersisNo) + '</p>';
    }
    html +=
      '<p><strong>ETBİS:</strong> ' + etbisLineHtml() + '</p>' +
      '<p><strong>Web:</strong> <a href="' + esc(corp.websiteUrl) + '" target="_blank" rel="noopener">' + esc(corp.website) + '</a></p>';
    return html;
  }

  function sellerTableRows() {
    let rows =
      '<tr><td>Ünvan</td><td>' + esc(corp.unvan) + '</td></tr>' +
      '<tr><td>Adres</td><td>' + esc(corp.adres) + '</td></tr>' +
      '<tr><td>Telefon</td><td>' + esc(corp.telefon) + '</td></tr>' +
      '<tr><td>E-posta</td><td>' + esc(corp.email) + '</td></tr>' +
      '<tr><td>KEP</td><td>' + esc(corp.kep) + '</td></tr>' +
      '<tr><td>Vergi Dairesi / No</td><td>' + esc(corp.vergiDairesi) + ' / ' + esc(corp.vkn) + '</td></tr>';
    if (corp.mersisNo) {
      rows += '<tr><td>MERSİS No</td><td>' + esc(corp.mersisNo) + '</td></tr>';
    }
    rows +=
      '<tr><td>ETBİS</td><td>' + etbisLineHtml() + '</td></tr>' +
      '<tr><td>Web sitesi</td><td><a href="' + esc(corp.websiteUrl) + '" target="_blank" rel="noopener">' + esc(corp.website) + '</a></td></tr>';
    return rows;
  }

  function footerLegalHtml() {
    const etbis = corp.etbisNo
      ? 'ETBİS: ' + esc(corp.etbisNo) + ' · '
      : 'ETBİS Kayıtlı · ';
    return (
      '<p class="corp-legal-line">' +
      esc(corp.unvan) + ' · ' + etbis +
      'VKN: ' + esc(corp.vkn) + ' · Vergi Dairesi: ' + esc(corp.vergiDairesi) + '<br>' +
      esc(corp.adres) + ' · Tel: ' + esc(corp.telefon) + ' · KEP: ' + esc(corp.kep) +
      '</p>'
    );
  }

  function applyDataCorpAttributes() {
    document.querySelectorAll('[data-corp]').forEach(function (el) {
      const key = el.getAttribute('data-corp');
      if (key === 'mersisNo') {
        if (corp.mersisNo) el.textContent = corp.mersisNo;
        else if (el.closest('[data-hide-without-mersis]')) el.closest('[data-hide-without-mersis]').style.display = 'none';
        else el.textContent = '';
        return;
      }
      if (key === 'etbisNo') {
        const dogrulama = corp.etbisDogrulamaUrl || corp.etbisSorguUrl;
        if (corp.etbisNo) {
          el.innerHTML = esc(corp.etbisNo);
        } else if (corp.etbisSiteId) {
          el.innerHTML = '<a href="' + dogrulama + '" target="_blank" rel="noopener">ETBİS kayıtlı site doğrulama</a>';
        } else {
          el.textContent = 'Kayıtlı — ' + corp.website;
        }
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
  }

  function injectFooterLegal() {
    document.querySelectorAll('[data-corp-legal-block]').forEach(function (el) {
      el.innerHTML = footerLegalHtml();
    });
    document.querySelectorAll('.etbis-footer-text').forEach(function (el) {
      if (!el.dataset.corpEnhanced) {
        el.dataset.corpEnhanced = '1';
        const extra = document.createElement('p');
        extra.className = 'etbis-footer-meta';
        extra.style.cssText = 'font-size:0.8rem;margin-top:8px;';
        extra.innerHTML = etbisLineHtml();
        el.after(extra);
      }
    });
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
