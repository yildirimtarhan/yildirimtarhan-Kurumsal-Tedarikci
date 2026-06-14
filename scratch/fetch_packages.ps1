[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$resp = Invoke-WebRequest -Uri 'https://api.tedarikci.org.tr/api/packages/public' -UseBasicParsing
$json = $resp.Content | ConvertFrom-Json
foreach($pkg in $json.packages) {
    Write-Output "=== $($pkg.name) ==="
    Write-Output "  Fiyat: $($pkg.price) TL/$($pkg.period)"
    Write-Output "  Kategori: $($pkg.category)"
    Write-Output "  Subtitle: $($pkg.subtitle)"
    Write-Output "  Features: $($pkg.features -join ' | ')"
    Write-Output ""
}
