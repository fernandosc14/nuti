param(
  [Parameter(Mandatory=$false)]
  [string]$JdkPath
)

if (-not $JdkPath) {
  $JdkPath = Read-Host "Enter the JDK 17 install path (e.g. C:\\Program Files\\Java\\jdk-17)"
}

if (-not (Test-Path $JdkPath)) {
  Write-Host "Path not found: $JdkPath" -ForegroundColor Red
  exit 1
}

$env:JAVA_HOME = $JdkPath
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH

Push-Location "$PSScriptRoot"

Write-Host "Using JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Green
Write-Host "Running Gradle assembleDebug (this may take a while)..." -ForegroundColor Yellow

# Run Gradle with stacktrace and no daemon to ensure fresh JDK usage
.\gradlew.bat assembleDebug --no-daemon --stacktrace

Pop-Location
