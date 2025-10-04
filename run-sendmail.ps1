# PowerShell script to run sendMail.ts with environment variables loaded
# Read .env file and set environment variables

$envFile = ".env"
$envLocalFile = ".env.local"

# Function to load environment variables from a file
function Load-EnvFile {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        Write-Host "Loading environment variables from $FilePath"
        Get-Content $FilePath | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                # Remove quotes if present
                $value = $value -replace '^["'']|["'']$', ''
                Set-Item -Path "env:$name" -Value $value
                Write-Host "  Set $name"
            }
        }
    } else {
        Write-Host "Environment file $FilePath not found"
    }
}

# Load environment variables
Load-EnvFile $envFile
Load-EnvFile $envLocalFile

# Verify critical environment variables are set
Write-Host "`nVerifying environment variables:"
Write-Host "MONGODB_URI: $(if ($env:MONGODB_URI) { 'Set' } else { 'NOT SET' })"
Write-Host "CLIENT_ID: $(if ($env:CLIENT_ID) { 'Set' } else { 'NOT SET' })"
Write-Host "CLIENT_SECRET: $(if ($env:CLIENT_SECRET) { 'Set' } else { 'NOT SET' })"
Write-Host "REFRESH_TOKEN: $(if ($env:REFRESH_TOKEN) { 'Set' } else { 'NOT SET' })"

# Run the TypeScript script
Write-Host "`nRunning sendMail script..."
npx tsx scripts/sendMail.ts