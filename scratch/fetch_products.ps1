[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$resp = Invoke-WebRequest -Uri 'https://api.tedarikci.org.tr/api/products/public' -UseBasicParsing
$json = $resp.Content | ConvertFrom-Json
foreach($prod in $json.products) {
    Write-Output "=== $($prod.name) ==="
    Write-Output "  Fiyat: $($prod.price) TL/$($prod.unit)"
    Write-Output "  Kategori: $($prod.category)"
    Write-Output "  Açıklama: $($prod.description)"
    Write-Output ""
}
