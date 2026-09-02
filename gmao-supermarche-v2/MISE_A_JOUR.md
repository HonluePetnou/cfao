# Mettre à jour l'application en production

Aide-mémoire rapide — la version complète et les explications détaillées
sont dans [DEPLOIEMENT.md](DEPLOIEMENT.md), section 8. Ici : juste les
commandes, dans l'ordre, à exécuter sur le serveur.

Deux dossiers sur le serveur : **"nouveau"** (le clone git, à jour) et
**"ancien"** (le déploiement en place, avec les vraies données).

---

## 1. Sauvegarde — jamais sauter cette étape

Dans le dossier **ancien** :

```powershell
cd <chemin-ancien>\gmao-supermarche-v2
docker compose exec -T postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup-avant-deploy-$(Get-Date -Format yyyyMMdd-HHmm).sql
```

## 2. Récupérer le code à jour

Dans le dossier **nouveau** :

```powershell
cd <chemin-nouveau>\gmao-supermarche-v2
git pull
```

## 3. Vérifier que `docker-compose.yml` n'a pas changé côté ancien

```powershell
diff <chemin-nouveau>\gmao-supermarche-v2\docker-compose.yml <chemin-ancien>\gmao-supermarche-v2\docker-compose.yml
```

Rien affiché → OK, continue. Une différence → s'arrêter et vérifier avant
de continuer (ne pas écraser un réglage fait à la main sur le serveur).

## 4. Copier le code par-dessus l'ancien

```powershell
rsync -av --exclude='.env' --exclude='.git' --exclude='node_modules' `
  --exclude='.next' --exclude='.turbo' --exclude='apps/api/dist' `
  --exclude='data/gmao-seed.sql' `
  <chemin-nouveau>/gmao-supermarche-v2/ <chemin-ancien>/gmao-supermarche-v2/
```

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
