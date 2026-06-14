$content = Get-Content -Path "public\teklif.html" -Raw -Encoding UTF8
$content = $content -replace "Mimarlar Odası & Makina Mühendisleri Odası", "Motor Kuryeler"
$content = $content -replace "Mimarlar ve mühendisler gibi proje bazlı, resmi yazışmaların ve onay süreçlerinin kritik olduğu", "Motor kuryeler gibi sürekli hareket halinde olan, hızlı operasyon ve anlık faturalandırmanın kritik olduğu"
$content = $content -replace "Mimarlar ve Mühendisler Odası üyelerine özel", "Motor Kuryelere özel"
$content = $content -replace "(?s)<!-- 6\. Sayfa: ERP Çözümleri -->.*?<!-- 7\. Sayfa: Arka Kapak -->", "<!-- 6. Sayfa: Arka Kapak -->"
$content = $content -replace "Sayfa 7</div>", "Sayfa 6</div>"

Set-Content -Path "public\teklif-kurye.html" -Value $content -Encoding UTF8
Write-Output "teklif-kurye.html oluşturuldu."
