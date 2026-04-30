# Bootstrap Staging Database
# This script populates a fresh staging database with initial data

$STAGING_URL = "https://virtuous-exploration-staging.up.railway.app"
$ADMIN_KEY = $env:ADMIN_API_KEY

if (-not $ADMIN_KEY) {
    Write-Host "Error: ADMIN_API_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Set it with: `$env:ADMIN_API_KEY='your_key_here'" -ForegroundColor Yellow
    exit 1
}

$headers = @{
    "x-api-key" = $ADMIN_KEY
    "Content-Type" = "application/json"
}

Write-Host "Starting staging database bootstrap..." -ForegroundColor Cyan
Write-Host "Target: $STAGING_URL" -ForegroundColor Gray
Write-Host ""

# Step 1: Sync catalog (teams, leagues, seasons)
Write-Host "Step 1: Syncing catalog (teams, leagues, seasons)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$STAGING_URL/api/sync/catalog/all" `
        -Method POST `
        -Headers $headers `
        -TimeoutSec 120
    Write-Host "Catalog synced successfully" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 2) -ForegroundColor Gray
} catch {
    Write-Host "Warning: Catalog sync had issues (may already exist): $_" -ForegroundColor Yellow
    # Continue anyway - catalog may already be populated
}

Start-Sleep -Seconds 5

# Step 2: Sync key league fixtures
$leagues = @(
    @{id=8; name="Premier League (England)"},
    @{id=9; name="Championship (England)"},
    @{id=564; name="La Liga (Spain)"},
    @{id=82; name="Bundesliga (Germany)"},
    @{id=384; name="Serie A (Italy)"},
    @{id=301; name="Ligue 1 (France)"},
    @{id=24; name="FA Cup (England)"}
)

Write-Host ""
Write-Host "Step 2: Syncing fixtures for key leagues..." -ForegroundColor Yellow

# Calculate date range: 7 days past, 60 days future
$today = Get-Date
$fromDate = $today.AddDays(-7).ToString("yyyy-MM-dd")
$toDate = $today.AddDays(60).ToString("yyyy-MM-dd")

Write-Host "  Date range: $fromDate to $toDate" -ForegroundColor Gray

foreach ($league in $leagues) {
    Write-Host "  Syncing: $($league.name) (ID: $($league.id))..." -ForegroundColor Cyan
    try {
        $body = @{
            pastDays = 7
            futureDays = 60
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$STAGING_URL/api/sync/league/$($league.id)/window" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 120
        Write-Host "  $($league.name): synced" -ForegroundColor Green
        Start-Sleep -Seconds 3
    } catch {
        Write-Host "  Warning: Failed to sync $($league.name): $_" -ForegroundColor Yellow
    }
}

# Step 3: Sync current live matches
Write-Host ""
Write-Host "Step 3: Syncing live matches..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$STAGING_URL/api/sync/live-now" `
        -Method POST `
        -Headers $headers `
        -TimeoutSec 60
    Write-Host "Live matches synced" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 2) -ForegroundColor Gray
} catch {
    Write-Host "Warning: No live matches or failed to sync: $_" -ForegroundColor Yellow
}

# Step 4: Sync standings for key leagues
Write-Host ""
Write-Host "Step 4: Syncing standings..." -ForegroundColor Yellow

foreach ($league in $leagues) {
    Write-Host "  Syncing standings: $($league.name)..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$STAGING_URL/api/standings/sync/league/$($league.id)" `
            -Method POST `
            -Headers $headers `
            -TimeoutSec 60
        Write-Host "  $($league.name) standings synced" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "  Warning: Failed to sync standings for $($league.name): $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Bootstrap complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Enable cron jobs in Railway by setting ENABLE_CRON=true" -ForegroundColor White
Write-Host "2. Check staging frontend at your Cloudflare Pages URL" -ForegroundColor White
Write-Host "3. Monitor Railway logs for any issues" -ForegroundColor White
