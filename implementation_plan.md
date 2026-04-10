# Deep Global Corporate Design Overhaul & Navigation Audit

The primary objective is to finalize the professionalization of the website by completing the social login removal (completed) and resolving the critical navigation/sub-menu issues reported.

## Proposed Changes

### 1. Navigation & Sub-menu Audit (CRITICAL)
- **Action**: Standardize the navbar structure and styles across all pages.
- **Problem**: Redundant inline styles in pages like `index.html` and `teklif.html` override the global `style.css`, causing inconsistent dropdown behavior and visual bugs.
- **Fix**:
  - Remove all inline navbar/dropdown CSS from HTML files.
  - Consolidate all navigation styling into `public/css/style.css`.
  - Refine `public/js/main.js` to ensure the `toggleDropdown` function works seamlessly on both mobile (click) and desktop (hover/click).
  - Ensure `z-index` consistency so dropdowns always appear above page content.
  - Ödeme sayfasındaki yerel (inline) stiller, global `style.css` ile değiştirilecektir. Bu, sayfanın genel site tasarımıyla tam uyumlu olmasını sağlayacaktır.
  - Sepet kısmındaki miktar butonları (+/-) şuan beyaz kare olarak görünüyor; bunlar kurumsal renklerimize uygun profesyonel butonlara dönüştürülecektir.
  - Adres kartlarındaki boş veriler (virgül olarak görünen kısımlar) temizlenerek daha temiz bir görünüm sağlanacaktır.
  - **Yasal Uyumluluk:** Ödeme butonundan önce "Ön Bilgilendirme Formu", "Mesafeli Satış Sözleşmesi" ve "KVKK" onay kutucukları eklenecektir. Bu metinler Alıcı ve Satıcı bilgilerini dinamik olarak içerecektir.

### 2. Authentication UI Cleanup (COMPLETED)
- [x] Redesign `giris.html` to a centered, professional B2B card structure.
- [x] Remove all social login (Google, FB, IG) buttons and associated logic.
- [x] Align `kayit.html` with the new design and remove OAuth dependencies.

### 3. Global CSS Architecture (Refactoring)
- **Action**: Continue removing redundant inline `<style>` blocks from remaining files like `teklif.html`, `hizmetler.html`, etc.
- **Goal**: Ensure 100% inheritance from `public/css/style.css` for a unified corporate identity.

## Verification Plan
1. Start the local server to test the entire site architecture.
2. Verify that clicking through pages like "Hizmetler" and "Paketler" retains the identical corporate navy/blue design language without visual breaking.
3. Review the structural changes to the homepage.
