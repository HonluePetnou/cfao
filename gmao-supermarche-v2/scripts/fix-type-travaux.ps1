# Corrige les tickets dont "typeTravaux" contient le libellé humain
# ("Maint. Corrective", "Maint. Préventive", "Maint. Améliorative",
# "Travaux neufs") au lieu de la clé attendue par le backend et les KPI du
# dashboard - bug du formulaire de création de ticket (voir
# apps/api/prisma/fix-type-travaux.ts pour le detail et le contexte).
#
# Sans cette correction, ces tickets sont invisibles dans "Dépense par type
# de travaux" et les compteurs "Maint. Corrective"/"Maint. Préventive" du
# dashboard - c'est ce qui causait le bug observé en prod.
#
# ASCII-only sur le fond du script (mêmes raisons que les autres scripts de
# ce dossier) - la correction elle-même se fait en JS/Prisma dans le
# conteneur, jamais via du SQL accentué passé à travers PowerShell.
#
#   powershell -ExecutionPolicy Bypass -File scripts\fix-type-travaux.ps1
#       # dry-run (par defaut) : affiche ce qui serait corrige, rien ecrit
#   powershell -ExecutionPolicy Bypass -File scripts\fix-type-travaux.ps1 -Apply
#       # applique reellement la correction

param(
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "Copying the latest fix-type-travaux.ts into the container (no rebuild needed)..."
& docker compose cp apps/api/prisma/fix-type-travaux.ts api:/app/apps/api/prisma/fix-type-travaux.ts
if ($LASTEXITCODE -ne 0) { Write-Error "Could not copy the script into the container."; exit 1 }

# ts-node compile le script a la volee et a besoin de la chaine complete de
# tsconfig.json (via packages/config/tsconfig.base.json) pour le faire -
# copie defensive au cas ou l'image en cours d'execution date d'avant le
# correctif du Dockerfile qui l'inclut deja en permanence.
Write-Host "Copying packages/ into the container (tsconfig dependency for ts-node)..."
& docker compose cp packages api:/app/packages
if ($LASTEXITCODE -ne 0) { Write-Error "Could not copy packages/ into the container."; exit 1 }

Write-Host ""
Write-Host "$(if ($Apply) { 'Applying the fix' } else { 'Reporting (dry-run)' })..."
Write-Host "----------------------------------------------------------------------"
$applyFlag = if ($Apply) { "--apply" } else { "" }
& docker compose exec -T api sh -c "npm exec --workspace=api -- ts-node prisma/fix-type-travaux.ts $applyFlag"
$fixExit = $LASTEXITCODE
Write-Host "----------------------------------------------------------------------"

if ($fixExit -ne 0) { Write-Error "The fix script exited with an error - see the output above."; exit 1 }

if (-not $Apply) {
    Write-Host ""
    Write-Host "This was a DRY-RUN - nothing was changed. Review the list above, then re-run with -Apply to fix it for real:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\fix-type-travaux.ps1 -Apply"
}
