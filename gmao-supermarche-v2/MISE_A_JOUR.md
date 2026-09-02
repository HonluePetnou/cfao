# Mettre à jour l'application en production

Aide-mémoire rapide — la version complète et les explications détaillées
sont dans [DEPLOIEMENT.md](DEPLOIEMENT.md), section 8. Ici : juste les
commandes, dans l'ordre, à exécuter sur le serveur.

Deux dossiers sur le serveur : **"nouveau"** (le clone git, à jour) et
**"ancien"** (le déploiement en place, avec les vraies données).

---

## 1. Sauvegarde — jamais sauter cette étape

Dans le dossier **ancien**, en PowerShell (pas `cmd.exe`) :

```powershell
cd <chemin-ancien>\gmao-supermarche-v2
Get-Content .env | Select-String POSTGRES
```

Note les valeurs de `POSTGRES_USER` et `POSTGRES_DB`, puis lance (remplace
`TONUSER`/`TABASE` par ces valeurs, **sans** chevrons `< >` — `<`/`>` sont
des opérateurs réservés en PowerShell, pas des marqueurs à conserver) :

```powershell
docker compose exec -T postgres pg_dump -U TONUSER TABASE > backup-avant-deploy-$(Get-Date -Format yyyyMMdd-HHmm).sql
```

## 2. Récupérer le code à jour

Dans le dossier **nouveau** :

```powershell
cd <chemin-nouveau>\gmao-supermarche-v2
git pull
```

## 3. Vérifier que `docker-compose.yml` n'a pas changé côté ancien

`diff` sous PowerShell est un alias vers `Compare-Object`, qui compare les
**chemins tapés**, pas le **contenu** des fichiers — inutile ici. Utilise
`fc` (comparateur de fichiers natif Windows) à la place :

```powershell
fc <chemin-nouveau>\gmao-supermarche-v2\docker-compose.yml <chemin-ancien>\gmao-supermarche-v2\docker-compose.yml
```

`FC: aucune différence rencontrée` → OK, continue. Une différence →
s'arrêter et vérifier avant de continuer (ne pas écraser un réglage fait à
la main sur le serveur).

## 4. Copier le code par-dessus l'ancien

Ce serveur n'a pas `rsync` installé — utilise `robocopy` (natif Windows,
équivalent) :

```powershell
robocopy "<chemin-nouveau>\gmao-supermarche-v2" "<chemin-ancien>\gmao-supermarche-v2" /E /XD node_modules .git .next .turbo dist /XF .env gmao-seed.sql
```

`robocopy` affiche un tableau récapitulatif à la fin — normal, ce n'est
pas une erreur (contrairement à la plupart des commandes, un code de
sortie entre 0 et 7 veut dire "réussi").

## 5. Rebuild et redémarrage — uniquement `api`/`web`

**Jamais** de `docker compose up`/`build` sans préciser les noms de
service — ça toucherait aussi `postgres`/`redis`.

```powershell
cd <chemin-ancien>\gmao-supermarche-v2
docker compose build api web
docker compose up -d api web
docker compose logs -f api
```

Vérifier que `Nest application successfully started` s'affiche sans
erreur. `Ctrl+C` pour sortir des logs (ne coupe pas le conteneur).

## 6. Vérification

```powershell
curl http://127.0.0.1:4000/api/health
```

Puis dans le navigateur : se connecter avec un vrai compte, vérifier
qu'une donnée déjà existante (ticket, équipement...) s'affiche
normalement avant de considérer la mise à jour terminée.
