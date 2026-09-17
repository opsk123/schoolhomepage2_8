param(
  [Parameter(Mandatory = $true)][string]$AccessToken,
  [string]$ProjectRef = "",
  [string]$ProjectName = "school-website",
  [string]$Region = "ap-northeast-2",
  [switch]$SkipSchema
)

$ErrorActionPreference = "Stop"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

$Base = "https://api.supabase.com/v1"
$Headers = @{ Authorization = "Bearer $AccessToken" }

function Fail($msg) {
  Write-Host "[ERROR] $msg" -ForegroundColor Red
  exit 1
}

function Step($msg) {
  Write-Host ""
  Write-Host "[STEP] $msg" -ForegroundColor Cyan
}

function Get-HttpBody($err) {
  try {
    $stream = $err.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    return $reader.ReadToEnd()
  } catch {
    return $err.Exception.Message
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $root
$schemaPath = Join-Path $root "schema.sql"

Step "Checking access token..."
try {
  $projects = @(Invoke-RestMethod -Uri "$Base/projects" -Headers $Headers -Method Get)
} catch {
  $code = 0
  try { $code = [int]$_.Exception.Response.StatusCode } catch {}
  if ($code -eq 401) { Fail "Invalid or expired access token." }
  Fail ("Could not reach Supabase API: " + (Get-HttpBody $_))
}
Write-Host ("   OK. Projects found in account: " + $projects.Count)

$ref = $ProjectRef
$dbPass = $null

if ($ref) {
  $match = $projects | Where-Object { $_.id -eq $ref }
  if (-not $match) { Fail "Project '$ref' was not found in this account." }
  Write-Host ("   Using project: {0} ({1})" -f $match.name, $ref)
} elseif ($projects.Count -eq 1) {
  $ref = $projects[0].id
  Write-Host ("   Using the only project: {0} ({1})" -f $projects[0].name, $ref)
} elseif ($projects.Count -gt 1) {
  Write-Host "   Multiple projects found. Re-run with: -ProjectRef <project-id>" -ForegroundColor Yellow
  $projects | ForEach-Object { Write-Host ("     - {0}   {1}" -f $_.id, $_.name) }
  exit 2
} else {
  Step "No projects found. Creating a new project..."
  $orgs = @(Invoke-RestMethod -Uri "$Base/organizations" -Headers $Headers -Method Get)
  if ($orgs.Count -eq 0) { Fail "No organization in account. Create one at https://supabase.com/dashboard first." }
  $orgId = $orgs[0].id
  $chars = (48..57) + (65..90) + (97..122)
  $dbPass = -join (1..24 | ForEach-Object { [char]$chars[(Get-Random -Maximum $chars.Count)] })
  $body = @{ name = $ProjectName; org_id = $orgId; region = $Region; db_pass = $dbPass } | ConvertTo-Json
  try {
    $p = Invoke-RestMethod -Uri "$Base/projects" -Headers $Headers -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json"
  } catch {
    Fail ("Project creation failed: " + (Get-HttpBody $_))
  }
  $ref = $p.id
  Write-Host ("   Created project: {0}" -f $ref)
  Write-Host ("   DB password (store it somewhere safe): {0}" -f $dbPass) -ForegroundColor Yellow
}

Step "Waiting for the project to be ACTIVE..."
$deadline = (Get-Date).AddMinutes(10)
while ($true) {
  $info = Invoke-RestMethod -Uri "$Base/projects/$ref" -Headers $Headers -Method Get
  Write-Host ("   status: " + $info.status)
  if ($info.status -eq "ACTIVE_HEALTHY") { break }
  if ((Get-Date) -gt $deadline) { Fail "Timed out. Re-run later with: -ProjectRef $ref" }
  Start-Sleep -Seconds 15
}

if (-not $SkipSchema) {
  Step "Applying database schema (supabase/schema.sql)..."
  $sql = [System.IO.File]::ReadAllText($schemaPath, [System.Text.Encoding]::UTF8)
  $queryBody = @{ query = $sql } | ConvertTo-Json
  try {
    Invoke-RestMethod -Uri "$Base/projects/$ref/database/query" -Headers $Headers -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($queryBody)) -ContentType "application/json" | Out-Null
    Write-Host "   Schema applied."
  } catch {
    Fail ("Schema failed: " + (Get-HttpBody $_))
  }
}

Step "Disabling email confirmation (signup works instantly)..."
try {
  $req = [System.Net.HttpWebRequest]::Create("$Base/projects/$ref/config/auth")
  $req.Method = "PATCH"
  $req.ContentType = "application/json"
  $req.Headers.Add("Authorization", "Bearer $AccessToken")
  $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"mailer_autoconfirm":true}')
  $req.ContentLength = $bytes.Length
  $stream = $req.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()
  $resp = $req.GetResponse()
  $resp.Close()
  Write-Host "   OK"
} catch {
  Write-Host "   Skipped. Manual: Dashboard > Authentication > Providers > Email > turn off 'Confirm email'" -ForegroundColor Yellow
}

Step "Fetching anon/publishable API key..."
$keysResp = Invoke-RestMethod -Uri "$Base/projects/$ref/api-keys?reveal=true" -Headers $Headers -Method Get
$keys = @($keysResp) | Where-Object { $_ -is [System.Management.Automation.PSCustomObject] }
if ($keysResp -is [System.Management.Automation.PSCustomObject] -and $keysResp.PSObject.Properties["keys"]) {
  $keys = @($keysResp.keys)
}
$anon = $null
foreach ($k in $keys) {
  if (-not $k) { continue }
  if (($k.name -eq "anon" -or $k.id -eq "anon") -and $k.status -ne "disabled") { $anon = $k.api_key; break }
}
if (-not $anon) {
  foreach ($k in $keys) {
    if (-not $k) { continue }
    if ($k.type -eq "publishable" -and $k.status -ne "disabled") { $anon = $k.api_key; break }
  }
}
if (-not $anon) { Fail "No anon/publishable key found." }
Write-Host ("   Key: " + $anon.Substring(0, [Math]::Min(18, $anon.Length)) + "...")

$siteUrl = "https://$ref.supabase.co"
$configPath = Join-Path $projectRoot "js\supabase-config.js"
$config = "// Supabase config (generated automatically by supabase/auto-setup.ps1)`nwindow.SUPABASE_CONFIG = {`n  url: `"$siteUrl`",`n  anonKey: `"$anon`"`n};`n"
[System.IO.File]::WriteAllText($configPath, $config, (New-Object System.Text.UTF8Encoding($false)))
Step "Wrote js/supabase-config.js ($siteUrl)"

Step "Verifying database connection..."
try {
  $vh = @{ apikey = $anon; Authorization = "Bearer $anon" }
  $clubs = Invoke-RestMethod -Uri "$siteUrl/rest/v1/clubs?select=name&order=id" -Headers $vh -Method Get
  $names = (($clubs | ForEach-Object { $_.name }) -join ", ")
  Write-Host ("   Clubs: " + $names) -ForegroundColor Green
} catch {
  Write-Host "   Warning: could not read the clubs table. Check the schema step above." -ForegroundColor Yellow
}

Step "Logging in to the Supabase CLI for future use..."
try {
  & supabase login --token $AccessToken 2>$null
  Write-Host "   OK"
} catch {
  Write-Host "   Skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "DONE! Reload the homepage and the member/club features are live." -ForegroundColor Green
