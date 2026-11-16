# Installer behaviour checks on real Windows. Writes test/out/installer-tests.txt
$ErrorActionPreference = 'Continue'
$out = Join-Path $PSScriptRoot '..\out'; New-Item -ItemType Directory -Force $out | Out-Null
$inst = Join-Path $env:LOCALAPPDATA 'Programs\WaddleSnap'
$setup = (Resolve-Path 'dist\WaddleSnap-Setup-*.exe' | Select-Object -First 1).Path
$log = New-Object System.Collections.Generic.List[string]
function Add($ok, $name, $detail) { $log.Add(("{0}  {1}  {2}" -f ($(if ($ok) {'PASS'} else {'FAIL'})), $name, $detail)) }

$os = Get-CimInstance Win32_OperatingSystem
$log.Add("OS: $($os.Caption) $($os.Version)")

# 1) Windows Defender verdict on the shipped binaries
$mp = Join-Path $env:ProgramFiles 'Windows Defender\MpCmdRun.exe'
if (Test-Path $mp) {
  try { $s = Get-MpComputerStatus; $log.Add("Defender realtime=$($s.RealTimeProtectionEnabled) sigs=$($s.AntivirusSignatureVersion) ($($s.AntivirusSignatureLastUpdated))") } catch { $log.Add("Get-MpComputerStatus failed: $_") }
  & $mp -SignatureUpdate | Out-Null
  foreach ($f in @("$inst\resources\app.asar.unpacked\src\bin\waddlepaste.exe", "$inst\WaddleSnap.exe", $setup)) {
    $r = & $mp -Scan -ScanType 3 -File $f -DisableRemediation 2>&1 | Out-String
    $clean = ($LASTEXITCODE -eq 0)
    Add $clean "Defender scan: $(Split-Path $f -Leaf)" (($r -split "`n" | Where-Object { $_ -match 'threat|found|Scan' }) -join ' | ')
  }
} else { $log.Add('Defender CLI not present') }

# 2) Reinstall while the app is running (installer must close it and succeed)
$p = Start-Process (Join-Path $inst 'WaddleSnap.exe') -PassThru
Start-Sleep 8
$before = @(Get-Process WaddleSnap -ErrorAction SilentlyContinue).Count
$r = Start-Process $setup -ArgumentList '/S' -Wait -PassThru
Start-Sleep 3
Add ($r.ExitCode -eq 0) 'reinstall while app is running' "exit=$($r.ExitCode) appProcsBefore=$before appProcsAfter=$(@(Get-Process WaddleSnap -ErrorAction SilentlyContinue).Count)"
Add (Test-Path (Join-Path $inst 'WaddleSnap.exe')) 'app present after reinstall' ''

# 3) Single instance: launching twice keeps one app
Start-Process (Join-Path $inst 'WaddleSnap.exe'); Start-Sleep 6
Start-Process (Join-Path $inst 'WaddleSnap.exe'); Start-Sleep 6
$mainProcs = @(Get-CimInstance Win32_Process -Filter "Name='WaddleSnap.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' }).Count
Add ($mainProcs -eq 1) 'second launch reuses the running app' "main processes=$mainProcs"
& "$PSScriptRoot\bin\wintool.exe" shot (Join-Path $out 'shots\90-second-launch.bmp') | Out-Null

# 4) Uninstall
Get-Process WaddleSnap -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
$u = Start-Process (Join-Path $inst 'Uninstall WaddleSnap.exe') -ArgumentList '/S' -Wait -PassThru
Start-Sleep 12
$reg = @(Get-ChildItem HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall -ErrorAction SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName -like 'WaddleSnap*' }).Count
Add ((-not (Test-Path (Join-Path $inst 'WaddleSnap.exe'))) -and $reg -eq 0) 'uninstall removes app + Apps list entry' "exit=$($u.ExitCode) dirExists=$(Test-Path $inst) regEntries=$reg"
Add (-not (Test-Path "$env:USERPROFILE\Desktop\WaddleSnap.lnk")) 'uninstall removes desktop shortcut' ''

$log | Tee-Object -FilePath (Join-Path $out 'installer-tests.txt')
if ($log -match '^FAIL') { exit 1 }
