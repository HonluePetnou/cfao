# Restores the real production data dump into the running Postgres
# container. PowerShell equivalent of restore-data.sh, for servers where
# no POSIX shell (bash) is available (e.g. Windows Server + Docker Desktop).
#
# ASCII-only on purpose: Windows PowerShell 5.1 misreads non-ASCII
# characters in a .ps1 file that has no UTF-8 BOM (e.g. saved by Notepad),
# which breaks parsing outright. Keep it plain ASCII if you edit this file.
#
# Never committed to git (see data/*.sql in .gitignore) - transfer it to
# the server separately first (scp/LocalSend), then run from the project
# root (gmao-supermarche-v2\):
#
#   powershell -ExecutionPolicy Bypass -File scripts\restore-data.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\restore-data.ps1 -DumpFile path\to\other.sql
#
# Requires `docker compose up -d --build` already done. Idempotent: if the
# target table already has rows, it skips instead of erroring out on
# duplicate keys (the dump is plain INSERTs, no ON CONFLICT).

param(
    [string]$DumpFile = "data\gmao-seed.sql"
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if (-not (Test-Path $DumpFile)) {
    Write-Error "Not found: $DumpFile (transfer it to the server first, it stays out of git)."
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Error ".env missing - run scripts\setup-env.sh (or create it by hand) first."
    exit 1
}

# Parse POSTGRES_USER / POSTGRES_DB out of .env (KEY=VALUE lines, ignore comments).
$envVars = @{}
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*#") { return }
    if ($_ -match "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
        $envVars[$matches[1]] = $matches[2]
    }
}
$PgUser = $envVars["POSTGRES_USER"]
$PgDb = $envVars["POSTGRES_DB"]
if (-not $PgUser -or -not $PgDb) {
    Write-Error "POSTGRES_USER/POSTGRES_DB not found in .env."
    exit 1
}

Write-Host "Waiting for the schema to exist (api container healthy, prisma db push already ran)..."
$tries = 0
$maxTries = 24
while ($true) {
    # Only redirect stdout (1>), never stderr (2>), on a native command here:
    # under $ErrorActionPreference = "Stop", PowerShell 5.1 wraps a native
    # command's stderr text into a terminating NativeCommandError when it's
    # redirected - which would kill this loop on the very first (expected)
    # "relation does not exist" failure instead of retrying.
    #
    # Single-quoted -c argument on purpose: PowerShell 5.1 does not reliably
    # pass a `""`-escaped embedded double quote through to a native exe's
    # argument list (it can get silently dropped), which would turn
    # `"Supermarket"` into an unquoted, lowercase-folded `Supermarket` that
    # never matches the real (mixed-case) table. A single-quoted PS string
    # needs no such escaping, so the literal " characters survive intact.
    $null = & docker compose exec -T postgres psql -U $PgUser -d $PgDb -c 'SELECT 1 FROM "Supermarket" LIMIT 1;' 1>$null
    if ($LASTEXITCODE -eq 0) { break }
    $tries++
    if ($tries -ge $maxTries) {
        Write-Error "Schema still doesn't exist after 2 minutes. Check: docker compose ps / docker compose logs api"
        exit 1
    }
    Start-Sleep -Seconds 5
}

$existing = (& docker compose exec -T postgres psql -U $PgUser -d $PgDb -t -A -c 'SELECT count(*) FROM "Supermarket";').Trim()
if ($existing -ne "0") {
    Write-Host "Database already has data (Supermarket: $existing rows) - restore skipped."
    Write-Host "To reload from scratch you must empty the database by hand first (destructive, outside this script)."
    exit 0
}

Write-Host "Restoring $DumpFile ..."
# Strip lines the dump's source (pg_dump 18.1) emits that our postgres:15
# target doesn't understand - harmless to drop, none of them affect data:
# - \restrict/\unrestrict: client-side safety meta-command (newer psql).
# - SET transaction_timeout: session GUC only added in PostgreSQL 17.
Get-Content $DumpFile | Where-Object { $_ -notmatch "^\\(restrict|unrestrict)\b" -and $_ -notmatch "^SET transaction_timeout" } |
    & docker compose exec -T postgres psql -v ON_ERROR_STOP=1 --single-transaction -U $PgUser -d $PgDb

if ($LASTEXITCODE -ne 0) {
    Write-Error "Restore failed (exit code $LASTEXITCODE) - see the psql messages above."
    exit 1
}

Write-Host "Restore done. Verification:"
# Single-quoted throughout (see the wait-loop comment above for why) - SQL
# string literals ('Supermarket', 'User', ...) need '' to embed a literal
# single quote, same trick as "" does for double quotes in a "..." string.
$verifySql = 'SELECT ''Supermarket'' AS tbl, count(*) FROM "Supermarket" ' +
    'UNION ALL SELECT ''User'', count(*) FROM "User" ' +
    'UNION ALL SELECT ''Localisation'', count(*) FROM "Localisation" ' +
    'UNION ALL SELECT ''Equipment'', count(*) FROM "Equipment" ' +
    'UNION ALL SELECT ''PreventivePlan'', count(*) FROM "PreventivePlan" ' +
    'UNION ALL SELECT ''Ticket'', count(*) FROM "Ticket" ' +
    'UNION ALL SELECT ''RondeConfiguration'', count(*) FROM "RondeConfiguration";'
& docker compose exec -T postgres psql -U $PgUser -d $PgDb -c $verifySql
