# run-bounce-check.ps1
# PowerShell script to run the bounce checker

Write-Host "Starting Email Bounce Checker..." -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found. Please create .env file with required environment variables." -ForegroundColor Red
    exit 1
}

# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $name = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

Write-Host "`nVerifying environment variables:"
Write-Host "MONGODB_URI: $(if ($env:MONGODB_URI) { 'Set' } else { 'NOT SET' })"

# Run the TypeScript script
Write-Host "`nRunning bounce check script..."
npx tsx scripts/checkBounces.ts

Write-Host "`nBounce check completed!" -ForegroundColor Green