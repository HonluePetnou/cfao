# Plan de déploiement — GMAO v2 sur serveur Linux (Docker)

Ce document décrit comment déployer l'application sur une machine Linux qui a
déjà Docker et Docker Compose installés. HTTPS n'est **pas** couvert (accès en
HTTP simple pour l'instant) — voir la section 9 pour l'activer plus tard
quand un nom de domaine sera disponible.

## 0. Ce qui a été corrigé côté code pour que ça tourne sur Linux

Avant d'écrire ce plan, le projet a été revu et quatre problèmes qui auraient
cassé le build/run sur Linux ont été corrigés :

1. **`apps/web/package.json`** déclarait `@next/swc-win32-x64-msvc` (binaire
   natif Windows) en dépendance directe. Retiré — Next.js sélectionne déjà
   tout seul le bon binaire (`@next/swc-linux-x64-musl` sur l'image
   `node:20-alpine`) via ses propres `optionalDependencies`.
2. **`apps/api/Dockerfile`** ne installait pas `openssl` dans l'image Alpine.
   Le moteur Prisma en a besoin pour tourner (`prisma generate` au build,
   `prisma db push` au démarrage) — sans lui l'erreur classique est
   `Error loading shared library libssl.so.3`. Ajouté dans les deux étages
   (builder + runner).
3. **`apps/api/Dockerfile`** copiait `data/` dans l'étage `builder` mais pas
   dans l'étage `runner` final — les scripts d'import (`import-tickets.ts`,
   etc.) auraient été inutilisables une fois le conteneur démarré. Corrigé.
4. **Pas de `.dockerignore`** : le build envoyait tout le dossier au démon
   Docker (`node_modules`, `.git`, `.env`, logs...), ce qui ralentit
   énormément le build et pouvait faire transiter des secrets. Ajouté, avec
   une règle qui exclut aussi `data/*.sql` (voir point suivant).
5. Les deux fichiers Excel (`CHECK-LIST -SUNSHINE 001.xlsx`,
   `Suivi financier Maintenance _ juin 2026.xlsx`) étaient dupliqués à la
   racine du projet ET dans `data/`. Unifiés sous `data/` (déplacement suivi
   par git), qui est l'emplacement que les scripts d'import et le Dockerfile
   attendent désormais.

**Point d'attention géré différemment — `data/gmao-seed.sql`** : ce fichier
est un dump complet de la vraie base de production (sites, utilisateurs,
tickets réels). Il est volontairement exclu du `.gitignore` du build Docker
(`.dockerignore`) **et** du dépôt git — une donnée métier réelle ne doit pas
finir dans l'historique git ni dans une image Docker qui pourrait être
poussée vers un registre. Il doit être transféré au serveur séparément (`scp`,
section 4) puis restauré directement dans Postgres (section 5).

> ⚠️ Ces correctifs sont faits par analyse statique du code — je n'ai pas pu
> exécuter `docker build` dans cet environnement (le démon Docker Desktop ne
> démarre pas ici). **La première étape du plan ci-dessous (section 3,
> `docker compose build`) sert aussi de test de ces correctifs** : si un
> build échoue, regarde le message d'erreur et dis-le-moi.

Rien n'a été committé — les changements sont dans l'arbre de travail, à toi
de relire (`git diff`) et de committer quand tu es prêt.

---

## 1. Vue d'ensemble de l'architecture déployée

```
Internet
   │  :80 (HTTP)
   ▼
┌─────────────┐
│   nginx     │  reverse proxy — seul service exposé publiquement
└──────┬──────┘
       │ réseau docker interne
   ┌───┴────┬─────────────┬──────────────┐
   ▼        ▼             ▼              ▼
  web      api         postgres        redis
 :3000    :4000         :5432          :6379
(Next.js) (NestJS)   (données)      (BullMQ, temps réel)
```

- `postgres` et `redis` ne sont **pas** exposés hors du réseau Docker (pas de
  `ports:` dans le compose) — accessibles uniquement par `api`.
- `api` et `web` sont publiés seulement sur `127.0.0.1` de l'hôte — pas
  accessibles depuis l'extérieur, uniquement via `nginx`.
- Seul `nginx` écoute sur `0.0.0.0:80` (et `:443`, inutilisé pour l'instant).

C'est déjà une configuration réseau saine par défaut ; rien à changer ici.

---

## 2. Prérequis sur le serveur

Le serveur a déjà Docker + Docker Compose (confirmé). Vérifie juste :

```bash
docker --version
docker compose version
```

Si `docker compose` (v2, sans tiret) n'existe pas mais `docker-compose` (v1)
oui, remplace `docker compose` par `docker-compose` dans toutes les commandes
ci-dessous — le reste est identique.

Espace disque : compte large (node_modules + 2 images Node ~ 1-1.5 Go au
total avant nettoyage), et RAM raisonnable pour Postgres/Redis/Node — 2 Go
RAM minimum, 4 Go conseillés.

---

## 3. Transférer le code sur le serveur

Deux options, choisis celle qui correspond à ton usage :

**Option A — via git (recommandé si le serveur peut accéder au dépôt) :**

```bash
ssh <user>@<serveur>
git clone <url-du-repo> cfao
cd cfao/gmao-supermarche-v2
```

**Option B — via rsync/scp (pas de dépôt distant accessible) :**

Depuis ta machine locale :

```bash
rsync -avz --exclude node_modules --exclude .git --exclude .next \
  --exclude .turbo --exclude "data/*.sql" \
  "gmao-supermarche-v2/" <user>@<serveur>:~/cfao/gmao-supermarche-v2/
```

Dans les deux cas, `data/gmao-seed.sql` n'est volontairement pas inclus —
transfère-le à part, chiffré/en direct (jamais par un canal public) :

```bash
scp "gmao-supermarche-v2/data/gmao-seed.sql" <user>@<serveur>:~/cfao/gmao-supermarche-v2/data/
```

---

## 4. Configurer les secrets de production

Sur le serveur, dans `gmao-supermarche-v2/` :

```bash
cp .env.example .env
```

Édite `.env` et remplace les `CHANGE_ME` par de vraies valeurs **fortes et
uniques** (ne réutilise pas celles de dev) :

```bash
# Génère un secret JWT
openssl rand -base64 48
# Génère un mot de passe Postgres
openssl rand -base64 24
```

Renseigne aussi `FRONTEND_URL` avec l'adresse publique réelle du serveur
(utilisée pour la validation CORS côté API) :

```
FRONTEND_URL=http://<ip-publique-ou-domaine-du-serveur>
```

`.env` est déjà dans `.gitignore` — vérifie qu'il n'est jamais committé.

---

## 5. Build et démarrage

Depuis `gmao-supermarche-v2/` :

```bash
docker compose build
docker compose up -d
```

Ceci construit les images `api` et `web`, puis démarre les 5 services dans
l'ordre imposé par les `depends_on`/`healthcheck` (`postgres`/`redis` sains
→ `api` sain → `web` → `nginx`). Le premier démarrage de `api` exécute
automatiquement `prisma db push`, qui crée le schéma dans la base (vide à ce
stade).

Suis les logs pendant le démarrage :

```bash
docker compose logs -f api
```

Vérifie que tout est sain :

```bash
docker compose ps
curl http://127.0.0.1:4000/api/health   # {"status":"ok"}
curl -I http://localhost/                # 200 via nginx
```

---

## 6. Charger les vraies données de production

Le schéma est créé mais la base est vide. Restaure le dump réel
(`data/gmao-seed.sql`, déjà transféré à l'étape 3) directement dans le
conteneur Postgres :

```bash
set -a; source .env; set +a
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < data/gmao-seed.sql
```

**Ne lance pas** `prisma/seed.ts` ni les scripts `import-*.ts` en production
— ce sont les scripts qui ont *servi à produire* ce dump à l'origine ;
les relancer écraserait ou dupliquerait les vraies données.

Si `psql` refuse le dump avec une erreur du type
`unrecognized command \restrict` : le `psql` embarqué dans l'image
`postgres:15-alpine` utilisée est trop ancien pour les nouvelles
méta-commandes `\restrict`/`\unrestrict` de pg_dump récent. Deux solutions :

```bash
# Solution 1 : forcer un pull d'image Postgres 15 à jour puis relancer
docker compose pull postgres && docker compose up -d postgres

# Solution 2 : retirer les deux lignes avant de restaurer
grep -v '^\\restrict\|^\\unrestrict' data/gmao-seed.sql | \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Vérifie ensuite que les données sont bien là :

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'SELECT count(*) FROM "Supermarket";'
```

Ouvre enfin `http://<ip-du-serveur>/login` dans un navigateur et connecte-toi
avec un compte réel existant dans le dump.

---

## 7. Sauvegardes

Base de données uniquement (le plus critique). Un simple cron sur l'hôte :

```bash
# /etc/cron.d/gmao-backup — tous les jours à 3h
0 3 * * * root cd /home/<user>/cfao/gmao-supermarche-v2 && \
  docker compose exec -T postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> \
  | gzip > /home/<user>/backups/gmao-$(date +\%Y\%m\%d).sql.gz \
  && find /home/<user>/backups -name 'gmao-*.sql.gz' -mtime +30 -delete
```

Copie idéalement ces archives hors du serveur (autre machine, stockage
objet) — une sauvegarde qui vit sur le même disque que la base ne protège
pas d'une panne disque/serveur.

---

## 8. Mettre à jour l'application (déploiements suivants)

```bash
cd cfao/gmao-supermarche-v2
git pull                       # ou re-rsync si pas de git sur le serveur
docker compose build
docker compose up -d
```

`docker compose up -d` ne recrée que les conteneurs dont l'image ou la
config a changé — `postgres`/`redis` (et leurs volumes de données) ne sont
pas touchés.

⚠️ **Point d'attention sur `prisma db push`** : il tourne à **chaque**
démarrage du conteneur `api` (voir `CMD` du Dockerfile). Pour un changement
de schéma non destructif (ajout de colonne/table), ça passe silencieusement.
Pour un changement destructif (suppression de colonne, changement de type
incompatible), `db push` demande une confirmation interactive — qui n'aura
jamais lieu dans un conteneur, et le déploiement restera bloqué/échouera.
Dans ce cas : teste le changement de schéma en local d'abord, et sache qu'il
faudra passer en `--accept-data-loss` (en connaissance de cause, avec une
sauvegarde fraîche) ou migrer vers de vraies migrations Prisma
(`prisma migrate`) si les évolutions de schéma deviennent fréquentes.

---

## 9. Passer en HTTPS plus tard (quand un domaine sera pointé sur le serveur)

Non fait maintenant (pas de domaine disponible), mais pour référence future,
l'ajout se fait sans réécrire l'architecture :

1. Pointer le DNS du domaine vers l'IP du serveur.
2. Ajouter un service `certbot` (ou utiliser `nginx` avec le plugin webroot)
   au `docker-compose.yml`, avec un volume partagé pour les certificats.
3. Étendre `docker/nginx/nginx.conf` avec un `server { listen 443 ssl; ... }`
   pointant vers les certificats, et rediriger le port 80 vers 443.
4. Mettre à jour `FRONTEND_URL` dans `.env` en `https://<domaine>` et
   redémarrer `api` (CORS) et `web`.

---

## 10. Checklist résumée

- [ ] Code transféré sur le serveur (git ou rsync)
- [ ] `data/gmao-seed.sql` transféré séparément (scp, hors git)
- [ ] `.env` créé avec des secrets forts et uniques + `FRONTEND_URL` correct
- [ ] `docker compose build && docker compose up -d`
- [ ] `docker compose ps` → tous les services `healthy`/`running`
- [ ] `curl http://127.0.0.1:4000/api/health` → `{"status":"ok"}`
- [ ] Dump restauré dans Postgres, connexion testée sur `http://<ip>/login`
- [ ] Cron de sauvegarde `pg_dump` en place, copié hors du serveur
- [ ] Pare-feu : seuls les ports 22 (SSH) et 80 (HTTP) ouverts publiquement
