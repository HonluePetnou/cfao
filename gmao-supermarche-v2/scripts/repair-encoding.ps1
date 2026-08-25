# Repairs text corrupted by the old restore-data.ps1 encoding bug (accented
# characters silently turned into literal "?" during a Windows restore -
# see that script's git history). Loads the ORIGINAL data/gmao-seed.sql into
# an isolated Postgres schema, compares it row-by-row to the live "public"
# schema, and fixes ONLY the rows where corruption is unambiguous - it never
# touches a value that legitimately differs for another reason (e.g. a
# ticket title edited since in the app). See
# apps/api/prisma/repair-encoding.ts for the exact matching rule.
#
# ASCII-only on purpose - see restore-data.ps1's own header for why.
#
# Requires data/gmao-seed.sql present (same file used by restore-data.ps1)
# and the stack already running (docker compose up -d). Run from the
# project root (gmao-supermarche-v2\):
#
#   powershell -ExecutionPolicy Bypass -File scripts\repair-encoding.ps1
#       # dry-run: prints every row it WOULD fix, changes nothing
#   powershell -ExecutionPolicy Bypass -File scripts\repair-encoding.ps1 -Apply
#       # applies the fixes for real
#
# Safe to re-run: rows already correct are simply not reported again.

param(
    [string]$DumpFile = "data\gmao-seed.sql",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if (-not (Test-Path $DumpFile)) {
    Write-Error "Not found: $DumpFile (same file restore-data.ps1 uses - transfer it to the server first)."
    exit 1
}
if (-not (Test-Path ".env")) {
    Write-Error ".env missing - run scripts\setup-env.sh (or create it by hand) first."
    exit 1
}

$envVars = @{}
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*#") { return }
    if ($_ -match "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
        $envVars[$matches[1]] = $matches[2]
    }
}
$PgUser = $envVars["POSTGRES_USER"]
$PgPassword = $envVars["POSTGRES_PASSWORD"]
$PgDb = $envVars["POSTGRES_DB"]
if (-not $PgUser -or -not $PgPassword -or -not $PgDb) {
    Write-Error "POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB not found in .env."
    exit 1
}

$TmpSchema = "repair_tmp"
# Built directly from .env rather than rewriting the api container's own
# DATABASE_URL through a nested shell command - passing it as one clean
# `docker compose exec -e` override avoids fragile double escaping between
# PowerShell and the container's sh.
$TmpDatabaseUrl = "postgresql://${PgUser}:${PgPassword}@postgres:5432/${PgDb}?schema=$TmpSchema"

Write-Host "Creating isolated schema '$TmpSchema' (never touches the live 'public' data)..."
& docker compose exec -T postgres psql -U $PgUser -d $PgDb -c "DROP SCHEMA IF EXISTS $TmpSchema CASCADE; CREATE SCHEMA $TmpSchema;" 1>$null
if ($LASTEXITCODE -ne 0) { Write-Error "Could not create the temporary schema."; exit 1 }

Write-Host "Creating the table structure in it (prisma db push)..."
& docker compose exec -T -e DATABASE_URL=$TmpDatabaseUrl api npm exec --workspace=api -- prisma db push --accept-data-loss --schema=prisma/schema.prisma 1>$null
if ($LASTEXITCODE -ne 0) { Write-Error "prisma db push into the temporary schema failed."; exit 1 }

Write-Host "Loading the original dump into it (UTF-8 safe, same fix as restore-data.ps1)..."
# NOTE: a `SET search_path` prefix does NOT work here - pg_dump wrote every
# INSERT as `INSERT INTO public."Table" ...`, fully schema-qualified, so it
# always targets "public" no matter what search_path is active (confirmed
# by testing: it inserted straight into the live public schema and only
# failed harmlessly on a duplicate key). Rewriting the qualifier in the
# piped text is the only way to redirect it - every occurrence in the dump
# is an "INSERT INTO public." line, nothing else, so this is unambiguous.
$PrevOutputEncoding = $OutputEncoding
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $body = Get-Content -Encoding UTF8 $DumpFile | Where-Object {
        $_ -notmatch "^\\(restrict|unrestrict)\b" -and $_ -notmatch "^SET transaction_timeout"
    } | ForEach-Object {
        $_ -replace '^INSERT INTO public\.', "INSERT INTO $TmpSchema."
    }
    $body | & docker compose exec -T postgres psql -v ON_ERROR_STOP=1 --single-transaction -U $PgUser -d $PgDb
} finally {
    $OutputEncoding = $PrevOutputEncoding
}
if ($LASTEXITCODE -ne 0) { Write-Error "Loading the dump into the temporary schema failed."; exit 1 }

Write-Host "Copying the latest repair-encoding.ts into the container (no rebuild needed to pick up script fixes)..."
& docker compose cp apps/api/prisma/repair-encoding.ts api:/app/apps/api/prisma/repair-encoding.ts
if ($LASTEXITCODE -ne 0) { Write-Error "Could not copy the script into the container."; exit 1 }

Write-Host ""
Write-Host "Comparing and $(if ($Apply) { 'applying fixes' } else { 'reporting (dry-run)' })..."
Write-Host "----------------------------------------------------------------------"
$applyFlag = if ($Apply) { "--apply" } else { "" }
& docker compose exec -T api sh -c "REPAIR_TMP_SCHEMA=$TmpSchema npm exec --workspace=api -- ts-node prisma/repair-encoding.ts $applyFlag"
$repairExit = $LASTEXITCODE
Write-Host "----------------------------------------------------------------------"

Write-Host "Dropping the temporary schema..."
& docker compose exec -T postgres psql -U $PgUser -d $PgDb -c "DROP SCHEMA $TmpSchema CASCADE;" 1>$null

if ($repairExit -ne 0) { Write-Error "The repair script exited with an error - see the output above."; exit 1 }

if (-not $Apply) {
    Write-Host ""
    Write-Host "This was a DRY-RUN - nothing was changed. Review the list above, then re-run with -Apply to fix it for real:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\repair-encoding.ps1 -Apply"
}
