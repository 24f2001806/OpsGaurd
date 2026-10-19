# OpsGuard full-stack check
# Run from the repo root with the stack already running:
#   powershell -ExecutionPolicy Bypass -File .\check_opsguard.ps1
# Optional: add -SkipDown to skip the slower "bad URL goes DOWN" test.

param([switch]$SkipDown)

$script:pass = 0
$script:fail = 0
$script:warn = 0

function Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:pass++ }
function Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;   $script:fail++ }
function Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow; $script:warn++ }
function Section($t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }

$api = "http://localhost:8000"
$createdIds = @()

# ---------------------------------------------------------------- 1
Section "1. Containers"
$expected = @(
    "opsguard-postgres", "opsguard-redis", "opsguard-backend", "opsguard-worker",
    "opsguard-frontend", "opsguard-prometheus", "opsguard-node-exporter",
    "opsguard-redis-exporter", "opsguard-grafana"
)
$running = docker ps --format "{{.Names}}|{{.Status}}" 2>$null
if (-not $running) {
    Fail "Docker returned nothing. Is Docker Desktop running and is 'docker compose up' running?"
} else {
    foreach ($name in $expected) {
        $line = $running | Where-Object { $_ -like "$name|*" }
        if (-not $line) { Fail "$name is not running" }
        elseif ($line -match "Restarting") { Fail "$name keeps restarting (docker compose logs $($name -replace 'opsguard-',''))" }
        else { Pass "$name is up" }
    }
}

# ---------------------------------------------------------------- 2
Section "2. Backend API"
try {
    $h = Invoke-RestMethod "$api/health" -TimeoutSec 10
    if ($h.status -eq "ok") { Pass "/health returns ok" } else { Fail "/health returned: $($h | ConvertTo-Json -Compress)" }
} catch { Fail "/health not reachable: $($_.Exception.Message)" }

$token = $null
$email = "opsguard.check." + (Get-Random -Maximum 999999) + "@gmail.com"
$password = "CheckPass123"
try {
    $u = Invoke-RestMethod "$api/auth/signup" -Method Post -ContentType "application/json" `
        -Body (@{ name = "Check User"; email = $email; password = $password } | ConvertTo-Json)
    if ($u.email -eq $email -and -not $u.password_hash) { Pass "Signup works (no password in response)" } else { Fail "Signup response looks wrong" }
} catch { Fail "Signup failed: $($_.Exception.Message)" }

try {
    $dup = $null
    try {
        Invoke-RestMethod "$api/auth/signup" -Method Post -ContentType "application/json" `
            -Body (@{ name = "Check User"; email = $email; password = $password } | ConvertTo-Json) | Out-Null
    } catch { $dup = $_.Exception.Response.StatusCode.value__ }
    if ($dup -eq 409) { Pass "Duplicate signup gives 409" } else { Fail "Duplicate signup should give 409, got $dup" }
} catch { Fail "Duplicate signup check errored: $($_.Exception.Message)" }

try {
    $t = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType "application/json" `
        -Body (@{ email = $email; password = $password } | ConvertTo-Json)
    $token = $t.access_token
    if ($token) { Pass "Login returns a JWT" } else { Fail "Login returned no token" }
} catch { Fail "Login failed: $($_.Exception.Message)" }

$headers = @{ Authorization = "Bearer $token" }

try {
    $code = $null
    try { Invoke-RestMethod "$api/endpoints" | Out-Null } catch { $code = $_.Exception.Response.StatusCode.value__ }
    if ($code -eq 401) { Pass "Protected route without token gives 401" } else { Fail "Expected 401 without token, got $code" }
} catch { Fail "401 check errored" }

try {
    $me = Invoke-RestMethod "$api/auth/me" -Headers $headers
    if ($me.email -eq $email) { Pass "/auth/me works with token" } else { Fail "/auth/me returned wrong user" }
} catch { Fail "/auth/me failed: $($_.Exception.Message)" }

try {
    $code = $null
    try {
        Invoke-RestMethod "$api/endpoints" -Method Post -Headers $headers -ContentType "application/json" `
            -Body (@{ name = "bad"; url = "not-a-url"; check_interval = 60; fast_check_interval = 10 } | ConvertTo-Json) | Out-Null
    } catch { $code = $_.Exception.Response.StatusCode.value__ }
    if ($code -eq 422 -or $code -eq 400) { Pass "Bad URL is rejected ($code)" } else { Fail "Bad URL should be rejected, got $code" }
} catch { Fail "URL validation check errored" }

# ---------------------------------------------------------------- 3
Section "3. Worker + Redis + PostgreSQL (good URL)"
$goodId = $null
try {
    $ep = Invoke-RestMethod "$api/endpoints" -Method Post -Headers $headers -ContentType "application/json" `
        -Body (@{ name = "check-good"; url = "https://example.com"; check_interval = 20; fast_check_interval = 5 } | ConvertTo-Json)
    $goodId = $ep.id
    $createdIds += $goodId
    Pass "Endpoint created (id $goodId, state $($ep.current_state))"
} catch { Fail "Create endpoint failed: $($_.Exception.Message)" }

try {
    $ping = docker exec opsguard-redis redis-cli PING 2>$null
    if ($ping -match "PONG") { Pass "Redis answers PING" } else { Fail "Redis did not answer PING" }
} catch { Fail "Could not query Redis" }

if ($goodId) {
    $state = $null
    for ($i = 0; $i -lt 18; $i++) {
        Start-Sleep -Seconds 5
        try { $state = (Invoke-RestMethod "$api/endpoints/$goodId" -Headers $headers).current_state } catch { }
        if ($state -eq "HEALTHY") { break }
    }
    if ($state -eq "HEALTHY") { Pass "Worker checked the URL: state became HEALTHY" }
    else { Fail "State is '$state' after 90s. Worker not consuming the queue? (docker compose logs worker)" }

    try {
        $hist = Invoke-RestMethod "$api/endpoints/$goodId/history" -Headers $headers
        $count = @($hist).Count
        if ($count -gt 0) {
            Pass "History has $count row(s) in PostgreSQL (status $($hist[0].status_code), $($hist[0].response_time_ms) ms)"
        } else { Fail "History is empty" }
    } catch { Fail "History call failed: $($_.Exception.Message)" }
}

# ---------------------------------------------------------------- 4
Section "4. Failure path (bad URL -> DOWN -> incident)"
if ($SkipDown) {
    Warn "Skipped (-SkipDown)"
} else {
    $badId = $null
    try {
        $bad = Invoke-RestMethod "$api/endpoints" -Method Post -Headers $headers -ContentType "application/json" `
            -Body (@{ name = "check-bad"; url = "https://thissitedoesnotexist.invalid"; check_interval = 20; fast_check_interval = 5 } | ConvertTo-Json)
        $badId = $bad.id
        $createdIds += $badId
        Pass "Bad endpoint created (id $badId)"
    } catch { Fail "Create bad endpoint failed: $($_.Exception.Message)" }

    if ($badId) {
        $state = $null
        Write-Host "  waiting up to 2.5 minutes for two failures..." -ForegroundColor Gray
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 5
            try { $state = (Invoke-RestMethod "$api/endpoints/$badId" -Headers $headers).current_state } catch { }
            if ($state -eq "DOWN") { break }
        }
        if ($state -eq "DOWN") { Pass "State reached DOWN after repeated failures" }
        else { Warn "State is '$state' (expected DOWN). Check the worker's failure threshold and intervals." }

        try {
            $inc = Invoke-RestMethod "$api/endpoints/$badId/incidents" -Headers $headers
            if (@($inc).Count -ge 1) { Pass "Incident created ($(@($inc).Count)), status $($inc[0].status)" }
            else { Warn "No incident yet" }
        } catch { Fail "Incidents call failed: $($_.Exception.Message)" }
    }
}

# ---------------------------------------------------------------- 5
Section "5. Dashboard APIs"
try {
    $s = Invoke-RestMethod "$api/dashboard/summary" -Headers $headers
    Pass "/dashboard/summary: total $($s.total_monitored), healthy $($s.healthy), down $($s.down)"
} catch { Fail "/dashboard/summary failed: $($_.Exception.Message)" }
try {
    Invoke-RestMethod "$api/incidents" -Headers $headers | Out-Null
    Pass "/incidents works"
} catch { Fail "/incidents failed: $($_.Exception.Message)" }

# ---------------------------------------------------------------- 6
Section "6. Worker health"
try {
    $w = Invoke-WebRequest "http://localhost:8081/health" -UseBasicParsing -TimeoutSec 5
    if ($w.StatusCode -eq 200) { Pass "Worker /health returns 200" } else { Warn "Worker /health returned $($w.StatusCode)" }
} catch { Warn "Worker /health not reachable on 8081 (ask M2 for the real health path)" }

# ---------------------------------------------------------------- 7
Section "7. Frontend"
try {
    $f = Invoke-WebRequest "http://localhost:3000" -UseBasicParsing -TimeoutSec 15
    if ($f.StatusCode -eq 200) { Pass "Frontend page loads on :3000" } else { Fail "Frontend returned $($f.StatusCode)" }
} catch { Fail "Frontend not reachable: $($_.Exception.Message)" }

# ---------------------------------------------------------------- 8
Section "8. Prometheus + Grafana (M4)"
try {
    $m = Invoke-WebRequest "$api/metrics" -UseBasicParsing -TimeoutSec 10
    if ($m.Content -match "http_requests_total") { Pass "Backend /metrics exposes http_requests_total" }
    else { Fail "/metrics works but has no http_requests_total" }
} catch { Fail "Backend /metrics missing. Add prometheus-fastapi-instrumentator and rebuild." }

try {
    Start-Sleep -Seconds 5
    $targets = (Invoke-RestMethod "http://localhost:9090/api/v1/targets" -TimeoutSec 10).data.activeTargets
    foreach ($tg in $targets) {
        if ($tg.health -eq "up") { Pass "Prometheus target '$($tg.labels.job)' is UP" }
        else { Fail "Prometheus target '$($tg.labels.job)' is $($tg.health) ($($tg.lastError))" }
    }
    if (-not $targets) { Fail "Prometheus has no targets" }
} catch { Fail "Prometheus API not reachable on :9090" }

try {
    $g = Invoke-RestMethod "http://localhost:3001/api/health" -TimeoutSec 10
    if ($g.database -eq "ok") { Pass "Grafana is healthy" } else { Warn "Grafana health: $($g | ConvertTo-Json -Compress)" }
} catch { Fail "Grafana not reachable on :3001" }

try {
    $cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin"))
    $dash = Invoke-RestMethod "http://localhost:3001/api/search?query=OpsGuard" -Headers @{ Authorization = "Basic $cred" }
    if (@($dash).Count -ge 1) { Pass "Grafana dashboard loaded: $($dash[0].title)" }
    else { Fail "Grafana has no OpsGuard dashboard (check the provisioning files and mounts)" }
} catch { Warn "Could not query Grafana dashboards (password changed from admin/admin?)" }

# ---------------------------------------------------------------- 9
Section "9. M4 config tests"
try {
    $out = python -m unittest tests.test_observability 2>&1
    if ($LASTEXITCODE -eq 0) { Pass "tests/test_observability.py passes" }
    else { Fail "tests/test_observability.py failed: $($out | Select-Object -Last 3 | Out-String)" }
} catch { Warn "Python not available for the unit tests" }

# ---------------------------------------------------------------- cleanup
Section "Cleanup"
foreach ($id in $createdIds) {
    try { Invoke-RestMethod "$api/endpoints/$id" -Method Delete -Headers $headers | Out-Null; Write-Host "  deleted test endpoint $id" -ForegroundColor Gray } catch { }
}
Write-Host "  (test user $email remains in the Docker database)" -ForegroundColor Gray

# ---------------------------------------------------------------- summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  PASS: $($script:pass)   FAIL: $($script:fail)   WARN: $($script:warn)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
if ($script:fail -eq 0) { Write-Host "Everything essential works." -ForegroundColor Green }
else { Write-Host "Fix the FAIL lines above, then run the script again." -ForegroundColor Red }