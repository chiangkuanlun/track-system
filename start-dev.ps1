param(
  [int]$ApiPort = 3000,
  [int]$WebPort = 4200,
  [string]$HostName = "0.0.0.0",
  [switch]$Install,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $Root "server"
$ClientDir = Join-Path $Root "client"
$EnvFile = Join-Path $ServerDir ".env"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command($CommandName, $Hint) {
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "找不到 $CommandName。$Hint"
  }
}

function Invoke-NpmInstallIfNeeded($Directory) {
  $nodeModules = Join-Path $Directory "node_modules"
  $packageLock = Join-Path $Directory "package-lock.json"
  Push-Location $Directory
  try {
    if ($Install -or -not (Test-Path $nodeModules)) {
      if (Test-Path $packageLock) {
        npm.cmd ci
      } else {
        npm.cmd install
      }
    }
  } finally {
    Pop-Location
  }
}

function Ensure-ServerEnv {
  if (Test-Path $EnvFile) { return }

  $secret = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
  $content = @"
PORT=$ApiPort
MONGO_URI=mongodb://127.0.0.1:27017/track-system
JWT_SECRET=$secret
CORS_ORIGINS=http://localhost:$WebPort,http://127.0.0.1:$WebPort
"@
  Set-Content -Path $EnvFile -Value $content -Encoding UTF8
  Write-Host "已建立 server/.env，預設連線 mongodb://127.0.0.1:27017/track-system" -ForegroundColor Yellow
}

function Test-PortInUse($Port) {
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

Set-Location $Root
Require-Command "node" "請先安裝 Node.js 20 以上版本。"
Require-Command "npm.cmd" "請確認 Node.js / npm 已加入 PATH。"

Write-Step "準備環境設定"
Ensure-ServerEnv

if (Test-PortInUse $ApiPort) {
  Write-Host "提醒：API Port $ApiPort 目前已有程式監聽，若啟動失敗請先關閉該程式或改用 -ApiPort。" -ForegroundColor Yellow
}
if (Test-PortInUse $WebPort) {
  Write-Host "提醒：前端 Port $WebPort 目前已有程式監聽，若啟動失敗請先關閉該程式或改用 -WebPort。" -ForegroundColor Yellow
}

Write-Step "確認後端套件"
Invoke-NpmInstallIfNeeded $ServerDir

Write-Step "確認前端套件"
Invoke-NpmInstallIfNeeded $ClientDir

Write-Step "啟動後端 API"
$corsOrigins = "http://localhost:$WebPort,http://127.0.0.1:$WebPort"
$serverCommand = "`$env:PORT='$ApiPort'; `$env:CORS_ORIGINS='$corsOrigins'; Set-Location '$ServerDir'; npm run dev"
Start-Process powershell.exe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $serverCommand) -WindowStyle Normal

Write-Step "啟動前端 Angular"
$clientCommand = "Set-Location '$ClientDir'; npm run start -- --host $HostName --port $WebPort --proxy-config proxy.conf.json"
Start-Process powershell.exe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $clientCommand) -WindowStyle Normal

$url = "http://localhost:$WebPort"
Write-Host ""
Write-Host "一鍵啟動完成。" -ForegroundColor Green
Write-Host "前端測試網址：$url"
Write-Host "API 健康檢查：http://localhost:$ApiPort/api/health"
Write-Host "如果資料庫連線失敗，請確認 MongoDB 已啟動。"

if (-not $NoBrowser) {
  Start-Sleep -Seconds 3
  Start-Process $url
}
