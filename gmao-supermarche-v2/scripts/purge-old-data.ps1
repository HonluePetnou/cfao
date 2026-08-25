# Supprime les Ticket / RapportJournalier / RondeJournaliere / PreventiveTask
# dont la date metier est anterieure a une date donnee - decision client :
# purger les donnees d'avant le 1er aout 2026, notamment pour se debarrasser
# des tickets touches par l'ancien bug d'encodage (voir
# apps/api/prisma/repair-encoding.ts pour le contexte de ce bug).
#
# Ne touche PAS les donnees de reference (Equipment, Localisation, User,
# Supermarket) - si elles sont elles aussi corrompues, c'est
# scripts/repair-encoding.ps1 qu'il faut utiliser, pas celui-ci.
#
# Verifie dans schema.prisma : aucune table ne depend de ces 4 tables par
# cle etrangere - la suppression est isolee, sans effet en cascade ailleurs.
#
# ASCII-only sur le fond du script (memes raisons que les autres scripts de
# ce dossier), mais attention : le contenu de la sauvegarde lui-meme est du
# vrai texte accentue - c'est pour ca qu'elle est ecrite DANS le conteneur
# Postgres via son propre shell (redirection POSIX, aucun risque d'encodage
# PowerShell) puis copiee sur l'hote en octets bruts via `docker compose
# cp`, jamais via une redirection PowerShell (`>`) qui a deja cause le bug
# qu'on repare par ailleurs.
#
#   powershell -ExecutionPolicy Bypass -File scripts\purge-old-data.ps1
#       # dry-run (par defaut) : affiche les comptages, ne supprime rien
#   powershell -ExecutionPolicy Bypass -File scripts\purge-old-data.ps1 -Apply
#       # sauvegarde automatique puis suppression reelle (annulee si la
#       # sauvegarde echoue)

param(
    [string]$BeforeDate = "2026-08-01",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

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
$PgDb = $envVars["POSTGRES_DB"]
if (-not $PgUser -or -not $PgDb) {
    Write-Error "POSTGRES_USER/POSTGRES_DB not found in .env."
    exit 1
}

$countSql = "SELECT 'Ticket' AS tbl, count(*) FROM `"Ticket`" WHERE `"createdAt`" < '$BeforeDate' " +
            "UNION ALL SELECT 'RapportJournalier', count(*) FROM `"RapportJournalier`" WHERE `"date`" < '$BeforeDate' " +
            "UNION ALL SELECT 'RondeJournaliere', count(*) FROM `"RondeJournaliere`" WHERE `"date`" < '$BeforeDate' " +
            "UNION ALL SELECT 'PreventiveTask', count(*) FROM `"PreventiveTask`" WHERE `"createdAt`" < '$BeforeDate';"

Write-Host "Comptage des lignes concernees (avant $BeforeDate) :"
Write-Host "----------------------------------------------------------------------"
& docker compose exec -T postgres psql -U $PgUser -d $PgDb -c $countSql
if ($LASTEXITCODE -ne 0) { Write-Error "Le comptage a echoue."; exit 1 }
Write-Host "----------------------------------------------------------------------"

if (-not $Apply) {
    Write-Host ""
    Write-Host "DRY-RUN - rien n'a ete supprime."
    Write-Host "Verifie les comptages ci-dessus, puis relance avec -Apply pour supprimer reellement :"
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\purge-old-data.ps1 -Apply"
    exit 0
}

Write-Host ""
Write-Host "Sauvegarde complete avant suppression (dans le conteneur, puis copiee sur l'hote)..."
& docker compose exec -T postgres sh -c "pg_dump -U $PgUser $PgDb > /tmp/backup-avant-purge.sql"
if ($LASTEXITCODE -ne 0) { Write-Error "La sauvegarde a echoue - suppression annulee par securite."; exit 1 }

$backupFile = "backup-avant-purge-$(Get-Date -Format yyyyMMdd-HHmm).sql"
& docker compose cp postgres:/tmp/backup-avant-purge.sql $backupFile
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
    Write-Error "La copie de la sauvegarde a echoue - suppression annulee par securite."
    exit 1
}
& docker compose exec -T postgres rm -f /tmp/backup-avant-purge.sql
Write-Host "Sauvegarde OK : $backupFile ($([math]::Round((Get-Item $backupFile).Length / 1MB, 2)) Mo)."

Write-Host ""
Write-Host "Suppression reelle en cours..."
$deleteSql = "DELETE FROM `"Ticket`" WHERE `"createdAt`" < '$BeforeDate'; " +
             "DELETE FROM `"RapportJournalier`" WHERE `"date`" < '$BeforeDate'; " +
             "DELETE FROM `"RondeJournaliere`" WHERE `"date`" < '$BeforeDate'; " +
             "DELETE FROM `"PreventiveTask`" WHERE `"createdAt`" < '$BeforeDate';"
& docker compose exec -T postgres psql -U $PgUser -d $PgDb -v ON_ERROR_STOP=1 --single-transaction -c $deleteSql
if ($LASTEXITCODE -ne 0) {
    Write-Error "La suppression a echoue en cours de route - verifie l'etat de la base. Sauvegarde disponible : $backupFile"
    exit 1
}
Write-Host ""
Write-Host "Termine. Sauvegarde conservee au cas ou : $backupFile"
