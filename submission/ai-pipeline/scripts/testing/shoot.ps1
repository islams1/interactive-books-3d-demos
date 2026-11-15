param($out, $url, $budget = 90000, $w = 1280, $h = 720)
# Headless Chrome screenshot (software GL = repeatable pictures; NOT for speed tests - use perf.mjs for that).
# Usage: powershell -File tools\shoot.ps1 C:\path\shot.png "http://127.0.0.1:8767/fp-extinguisher/avatar-test.html?view=facef" 90000 1280 720
# Retry if the PNG is small (< ~100 KB): the page was captured before it finished loading.
Remove-Item "$out*" -ErrorAction SilentlyContinue
$prof = "$env:TEMP\hl_" + [guid]::NewGuid().ToString("N")
Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--window-size=$w,$h", "--virtual-time-budget=$budget", "--enable-logging=stderr", "--v=0", "--user-data-dir=$prof", "--screenshot=$out", $url -RedirectStandardError "$out.log" -Wait
Select-String -Path "$out.log" -Pattern "Uncaught|not loaded" | Select-Object -First 10 | ForEach-Object { $_.Line }
Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
"saved: " + (Test-Path $out) + "  " + ((Get-Item $out -ErrorAction SilentlyContinue).Length) + " bytes"
