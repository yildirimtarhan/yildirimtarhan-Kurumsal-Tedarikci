$path = 'public\kayit.html'
$lines = Get-Content $path -Encoding UTF8
$keep = $lines[0..983] + $lines[1460..($lines.Length-1)]
[System.IO.File]::WriteAllLines((Resolve-Path $path).Path, $keep, [System.Text.Encoding]::UTF8)
Write-Host "Done. Total lines: $($keep.Length)"
