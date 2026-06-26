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
$LogDir = Join-Path $Root ".dev-logs"
$ProxyFile = Join-Path $LogDir "proxy.conf.json"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command($CommandName, $Hint) {
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing command: $CommandName. $Hint"
  }
}

function Invoke-NpmInstallIfNeeded($Directory, $Marker) {
  $markerPath = Join-Path $Directory $Marker
  $packageLock = Join-Path $Directory "package-lock.json"
  Push-Location $Directory
  try {
    if ($Install -or -not (Test-Path $markerPath)) {
      if (Test-Path $packageLock) {
        npm.cmd ci --include=dev
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
  Write-Host "Created server/.env with local MongoDB defaults." -ForegroundColor Yellow
}

function Test-PortInUse($Port) {
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Test-ApiHealthy($Port) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Write-ProxyConfig {
  $content = @"
{
  "/api": {
    "target": "http://127.0.0.1:$ApiPort",
    "secure": false,
    "changeOrigin": true
  }
}
"@
  Set-Content -Path $ProxyFile -Value $content -Encoding UTF8
}

Set-Location $Root
Require-Command "node" "Install Node.js 20 or newer."
Require-Command "npm.cmd" "Make sure Node.js / npm is available in PATH."

Write-Step "Prepare settings"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Ensure-ServerEnv

if (Test-ApiHealthy $ApiPort) {
  Write-Host "API is already healthy on port $ApiPort. Reusing it." -ForegroundColor Green
} else {
  if (Test-PortInUse $ApiPort) {
    throw "Port $ApiPort is already in use, but /api/health is not healthy. Choose another -ApiPort or stop that process."
  }

  Write-Step "Install backend packages"
  Invoke-NpmInstallIfNeeded $ServerDir "node_modules\.bin\nodemon.cmd"

  Write-Step "Start backend API"
  $corsOrigins = "http://localhost:$WebPort,http://127.0.0.1:$WebPort"
  $serverCommand = "`$env:PORT='$ApiPort'; `$env:CORS_ORIGINS='$corsOrigins'; Set-Location '$ServerDir'; npm run dev"
  Start-Process powershell.exe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $serverCommand) -WindowStyle Normal
}

if (Test-PortInUse $WebPort) {
  throw "Port $WebPort is already in use. Stop the existing frontend or use -WebPort 4201."
}

Write-Step "Install frontend packages"
Invoke-NpmInstallIfNeeded $ClientDir "node_modules\.bin\ng.cmd"
Write-ProxyConfig

Write-Step "Start Angular frontend"
$clientCommand = "Set-Location '$ClientDir'; npm run start -- --host $HostName --port $WebPort --proxy-config '$ProxyFile'"
Start-Process powershell.exe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $clientCommand) -WindowStyle Normal

$url = "http://localhost:$WebPort"
Write-Host ""
Write-Host "Development startup is ready." -ForegroundColor Green
Write-Host "Frontend: $url"
Write-Host "API health: http://localhost:$ApiPort/api/health"
Write-Host "If database connection fails, make sure MongoDB is running."

if (-not $NoBrowser) {
  Start-Sleep -Seconds 3
  Start-Process $url
}
