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

> **Pare-feu confirmé sur le serveur cible** : seuls 80, 8080 et 4343 sont
> ouverts en entrée. Ça tombe bien, `nginx` publie déjà sur le 80 — aucun
> changement de port nécessaire dans `docker-compose.yml`. 8080 et 4343 ne
> sont utilisés par aucun service de cette stack ; ce sont des règles de
> pare-feu existantes, indépendantes de ce déploiement. Le jour où le 443
> sera nécessaire (HTTPS, section 9), il faudra soit faire ouvrir le 443 par
> l'administrateur du pare-feu, soit republier `nginx` sur le 4343 déjà
> ouvert (`"4343:443"` dans le compose) et ajuster le DNS/reverse proxy en
> amont en conséquence.

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

Espace disque : `docker compose build` fait un `npm ci` séparé pour l'image
`api` et pour l'image `web` (chacune ~0.7-0.9 Go de `node_modules`, mesuré en
local), plus les images de base (`node:20-alpine` ×2, `postgres:15-alpine`,
`redis`, `nginx`, ~0.4 Go à elles quatre). Compte ~3-4 Go pour les images
finales une fois le build terminé, et jusqu'à 5-6 Go en pointe *pendant* le
build tant que Docker garde en cache les couches intermédiaires des étages
`builder` (`docker builder prune` récupère cet espace après coup si besoin).
Prévois 10 Go de marge libre sur le serveur pour être tranquille. RAM
raisonnable pour Postgres/Redis/Node — 2 Go minimum, 4 Go conseillés.

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

**Option C — via LocalSend (ou tout transfert direct type "copie de
fichiers") :**

Contrairement à `git`/`rsync`, l'outil envoie tel quel ce que tu sélectionnes
— il ne connaît ni `.gitignore` ni `.dockerignore` et n'exclut donc rien
automatiquement. À faire avant d'envoyer :

1. Sur ta machine, fais une copie du dossier `gmao-supermarche-v2/` et
   supprime-en, dans cette copie, tout ce qui n'a pas besoin de voyager
   (inutile, lourd, ou sensible) :
   - `node_modules/` (partout — racine, `apps/api/`, `apps/web/`) :
     réinstallé par `npm ci` pendant `docker compose build`, des centaines
     de Mo pour rien.
   - `.git/`, `.next/`, `.turbo/`, `apps/api/dist/`
   - `.env` (les secrets de dev n'ont rien à faire sur le serveur — tu en
     recrées un propre à l'étape 4)
   - `data/gmao-seed.sql` — envoie-le à part, en gardant conscience que
     c'est une vraie donnée métier (LocalSend étant un transfert direct de
     poste à poste sur le réseau local, c'est un canal raisonnable pour ce
     fichier, contrairement à un envoi par un service cloud tiers).
2. Envoie ce dossier nettoyé (zippe-le d'abord si l'outil transfère mieux un
   seul fichier qu'une arborescence).
3. Sur le serveur, dézippe/place le résultat à l'endroit voulu, par exemple
   `~/cfao/gmao-supermarche-v2/`, puis `cd` dedans.

Le reste du plan (à partir de la section 4) est identique, quelle que soit
l'option choisie.

---

## 4. Configurer les secrets de production

Sur le serveur, dans `gmao-supermarche-v2/` :

```bash
./scripts/setup-env.sh http://<ip-publique-ou-domaine-du-serveur>
```

Ça génère `.env` avec un `JWT_SECRET` et un `POSTGRES_PASSWORD` aléatoires
forts (`openssl rand`), et renseigne `FRONTEND_URL` (utilisée pour la
validation CORS côté API) avec l'URL donnée en argument — `http://localhost:3000`
par défaut si tu ne donnes rien. **Idempotent** : si `.env` existe déjà, le
script ne fait rien (il ne régénère/écrase jamais des secrets en place) —
c'est voulu, `git clone` + ce script suffisent, rien d'autre à configurer à
la main.

`.env` reste **volontairement hors de git** (`.gitignore`) — c'est un dépôt
public, y committer ce fichier exposerait les secrets de production à
n'importe qui sur internet. Si tu préfères le configurer toi-même à la
main plutôt que par le script, la logique est visible dans
[scripts/setup-env.sh](scripts/setup-env.sh).

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

**Ne lance pas** `prisma/seed.ts` ni les scripts `import-*.ts` en
production — ce sont les scripts qui ont *servi à produire* ce dump à
l'origine (ils lisent les `.xlsx`) ; les relancer écraserait
(`seed.ts` fait un `deleteMany` sur toutes les tables) ou dupliquerait les
vraies données. Le seul chemin à utiliser ici est la restauration directe
du dump SQL — via `data/gmao-seed.sql`, transféré à part à l'étape 3
(jamais par git, voir section 0).

### Produire ce dump depuis la vraie base en prod (10.68.59.7)

Cette étape se fait **entièrement toi-même, sur le serveur de prod actuel**
— je n'ai jamais besoin de voir la vraie donnée pour t'aider à migrer :
tout le reste de ce plan est écrit pour fonctionner uniquement à partir du
fichier `.sql` que tu produis ici, jamais à partir d'un accès direct à la
base.

Directement sur le serveur qui héberge la base actuelle (ou via `-h` si tu
t'y connectes à distance) :

```bash
pg_dump -h <hôte-ou-localhost> -U <user> -d <db> \
  --data-only --inserts --column-inserts \
  --exclude-table-data='_prisma_migrations' \
  > gmao-seed.sql
```

- `--data-only` : uniquement les données (`INSERT INTO ...`), pas de
  `CREATE TABLE` — c'est `prisma db push` (étape 5) qui crée déjà le schéma
  dans la nouvelle base, à partir de `schema.prisma` ; un dump avec schéma
  entrerait en conflit.
- `--inserts --column-inserts` : format exact attendu par
  `restore-data.sh`/`.ps1` (des `INSERT INTO public."Table" (colonnes...)
  VALUES (...)` explicites, pas des blocs `COPY`) — c'est le format du
  `data/gmao-seed.sql` actuel (généré à l'origine avec `pg_dump 18.1`).
- Transfère ensuite ce fichier **directement** de l'ancien serveur vers le
  nouveau (`scp`/`rsync` serveur-à-serveur, ou en repassant par ta machine
  en intermédiaire si les deux ne se joignent pas directement) — jamais par
  un canal public, jamais en me le collant dans le chat. Renomme-le
  `data/gmao-seed.sql` sur le nouveau serveur (ou passe son chemin en
  argument à `restore-data.sh`, voir plus bas) et continue avec la suite de
  cette section.

Une fois `docker compose up -d --build` fait (section 5) et le fichier en
place :

**Serveur Linux/macOS (bash disponible) :**

```bash
./scripts/restore-data.sh
```

**Serveur Windows sans bash** (ex. Windows Server + Docker Desktop, pas de
Git Bash ni de distro WSL avec l'intégration Docker activée) — équivalent
strict en PowerShell, mêmes garanties (idempotent, transaction unique) :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restore-data.ps1
```

`scripts\restore-data.ps1` est volontairement écrit en ASCII pur (pas
d'accents) : Windows PowerShell 5.1 lit mal un `.ps1` contenant des
caractères non-ASCII quand le fichier n'a pas de BOM UTF-8 (ce que produit
Notepad par défaut) — ça casse le parsing du script. Si tu le modifies,
garde-le en ASCII.

Pour Windows, seule la commande change (celle ci-dessus) — tout le reste du
plan est identique.

Dans les deux cas (bash ou PowerShell), le script gère tout seul :
- **attend** que le schéma existe (poll jusqu'à 2 min — le conteneur `api`
  doit être passé par `prisma db push` au démarrage) ;
- **vérifie que la base est vide** avant de restaurer, et ne fait rien si
  elle contient déjà des données (le dump n'a que des `INSERT`, pas de
  `ON CONFLICT` — le relancer par-dessus des données existantes casserait
  sur la première clé dupliquée) ; relancer le script après un premier
  succès est donc sans danger, il se contente de constater que c'est déjà
  fait ;
- restaure avec `psql -v ON_ERROR_STOP=1 --single-transaction` (tout ou
  rien : une erreur en cours de route annule proprement plutôt que de
  laisser la base à moitié remplie), en retirant au passage les éventuelles
  méta-commandes `\restrict`/`\unrestrict` que le `psql` embarqué dans
  `postgres:15-alpine` peut ne pas reconnaître selon sa version ;
- affiche un comptage final par table pour vérifier visuellement.

Ce dump précis amène exactement ces volumes (repère affiché en fin de
script — si un chiffre est à 0 ou très différent, quelque chose s'est mal
passé) : `Supermarket`=10, `User`=12, `Localisation`=170, `Equipment`=305,
`PreventivePlan`=33, `Ticket`=256, `RondeConfiguration`=5.

Pour restaurer un autre fichier que `data/gmao-seed.sql` :
`./scripts/restore-data.sh chemin/vers/autre.sql`.

Ouvre enfin `http://<ip-du-serveur>/login` dans un navigateur et connecte-toi
avec un compte réel existant dans le dump (un des 12 `User`).

---

## 6bis. Réparer un encodage corrompu (si nécessaire)

Une ancienne version de `restore-data.ps1` avait un bug qui remplaçait
silencieusement chaque caractère accentué par un `?` littéral pendant la
restauration sous PowerShell 5.1 (corrigé depuis — voir l'historique git de
ce fichier). Si tu as restauré les données via une version antérieure de ce
script, ou si tu vois des `?` à la place d'accents dans l'app (ex. "Entrep?t
CFAO" au lieu de "Entrepôt CFAO"), utilise
[`scripts/repair-encoding.ps1`](scripts/repair-encoding.ps1) pour corriger
ça sans toucher aux autres données.

Le script est **sûr par construction** : il charge une copie *propre* du
dump original (`data/gmao-seed.sql`) dans un schéma Postgres isolé et
temporaire (jamais dans `public`, jamais dans la base réelle), compare
ligne par ligne avec les données live, et ne corrige que les valeurs où la
corruption est confirmée sans ambiguïté (le texte live est identique au
texte d'origine avec chaque caractère non-ASCII remplacé par `?`) — il ne
touche jamais une valeur légitimement modifiée depuis dans l'application
(ex. un titre de ticket édité, qui ne contient pas de `?`).

Depuis `gmao-supermarche-v2/` sur le serveur (stack déjà démarrée,
`data/gmao-seed.sql` présent — même fichier que la section 6) :

```powershell
# Dry-run d'abord : affiche tout ce qui serait corrigé, ne change rien
powershell -ExecutionPolicy Bypass -File scripts\repair-encoding.ps1

# Une fois la liste vérifiée, applique réellement les corrections
powershell -ExecutionPolicy Bypass -File scripts\repair-encoding.ps1 -Apply
```

Le script fonctionne aussi bien sur Linux/macOS avec bash (mêmes
commandes `docker compose exec` sous-jacentes) — un équivalent `.sh` n'a pas
été jugé nécessaire vu que c'est une opération ponctuelle, à lancer une
seule fois après un premier `restore-data.ps1` buggé.

Sans-danger à relancer : une ligne déjà corrigée n'est plus signalée au
passage suivant. Voir [`scripts/README.md`](scripts/README.md) pour le
détail de comment ce script s'articule avec
`apps/api/prisma/repair-encoding.ts`.

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

Procédure réellement utilisée et vérifiée en production (serveur Windows,
sans git côté serveur "ancien" — deux dossiers : un clone git à jour
("nouveau") et le déploiement en place ("ancien") qui garde les vraies
données). Si le serveur a git directement dans son propre dossier, saute
l'étape 4 (`git pull` sur place suffit) et l'étape 5.

### 8.1. Sauvegarde d'abord, sans exception

Même pour une mise à jour "normale" — c'est gratuit, ne saute jamais cette
étape :

En PowerShell (pas `cmd.exe` — `$(Get-Date ...)` n'y est pas compris),
trouve d'abord les vraies valeurs :

```powershell
Get-Content .env | Select-String POSTGRES
```

Puis lance (remplace `TONUSER`/`TABASE` par ces valeurs — **sans**
chevrons `< >`, ce sont des opérateurs réservés en PowerShell, pas des
marqueurs à garder) :

```powershell
docker compose exec -T postgres pg_dump -U TONUSER TABASE > backup-avant-deploy-$(Get-Date -Format yyyyMMdd-HHmm).sql
```

### 8.2. Récupérer le code à jour

Dans le dossier "nouveau" (le clone git) :

```powershell
cd <chemin-nouveau>\gmao-supermarche-v2
git pull
```

### 8.3. Vérifier que `docker-compose.yml` n'a pas divergé

S'il a été retouché à la main sur le serveur (ports, volumes...), l'écraser
ferait perdre ces réglages silencieusement :

`diff` sous PowerShell est un alias vers `Compare-Object`, qui compare les
**chemins tapés**, pas le **contenu** des fichiers — inutile ici. Utilise
`fc` (comparateur de fichiers natif Windows, marche pareil en `cmd` et en
PowerShell) :

```powershell
fc <chemin-nouveau>\gmao-supermarche-v2\docker-compose.yml <chemin-ancien>\gmao-supermarche-v2\docker-compose.yml
```

`FC: aucune différence rencontrée` → rien à faire. Une différence →
décider au cas par cas avant de continuer (au besoin, exclure ce fichier
de la copie ci-dessous).

### 8.4. Copier le code par-dessus l'ancien déploiement

Ce serveur n'a pas `rsync` — utilise `robocopy` (natif Windows,
équivalent), depuis "nouveau" vers "ancien", en excluant tout ce qui doit
être préservé ou n'a rien à faire dans le transfert :

```powershell
robocopy "<chemin-nouveau>\gmao-supermarche-v2" "<chemin-ancien>\gmao-supermarche-v2" /E /XD node_modules .git .next .turbo dist /XF .env gmao-seed.sql
```

`robocopy` affiche un tableau récapitulatif à la fin — normal, ce n'est
pas une erreur (contrairement à la plupart des commandes, un code de
sortie entre 0 et 7 veut dire "réussi", pas seulement 0).

- `.env` : les vrais secrets de prod, ne jamais écraser avec ceux de dev.
- `data/gmao-seed.sql` : pas nécessaire pour une mise à jour de code, la
  donnée reste en place.
- `node_modules`/`.next`/`.turbo`/`dist` : régénérés par le build Docker,
  inutiles à transférer.

### 8.5. Rebuild et redémarrage — uniquement `api`/`web`

**Jamais** un `docker compose up -d` (ou `build`) sans préciser les noms de
service — ça recréerait aussi `postgres`/`redis` et republirait
potentiellement leurs volumes selon ce que contient `docker-compose.yml` :

```powershell
cd <chemin-ancien>\gmao-supermarche-v2
docker compose build api web
docker compose up -d api web
docker compose logs -f api
```

`postgres`/`redis` (et leurs volumes de données) ne sont jamais touchés par
ces commandes. Vérifie dans les logs que `prisma db push` passe sans
erreur et que Nest démarre (`Nest application successfully started`).

⚠️ **Point d'attention sur `prisma db push`** : il tourne à **chaque**
démarrage du conteneur `api` (voir `CMD` du Dockerfile), avec
`--accept-data-loss` déjà intégré en permanence — un changement de schéma
destructif (suppression de colonne, changement de type incompatible)
**s'applique silencieusement, sans confirmation**, il ne bloquera jamais le
déploiement mais peut faire perdre de la donnée si le changement l'exige.
C'est justement pour ça que l'étape 8.1 (sauvegarde) n'est jamais
optionnelle. Un ajout pur (nouvelle colonne, nouvelle valeur d'enum) est
sans risque. Si les évolutions de schéma deviennent fréquentes ou plus
risquées, migrer vers de vraies migrations Prisma (`prisma migrate`) plutôt
que `db push`.

### 8.6. Vérification

```powershell
curl http://127.0.0.1:4000/api/health
```

Puis dans le navigateur : connexion avec un compte existant, vérifier
qu'une donnée déjà là (ticket, équipement...) s'affiche normalement, avant
de considérer la mise à jour terminée.

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
- [ ] `.env` généré via `./scripts/setup-env.sh <url>` (secrets forts + `FRONTEND_URL` correct)
- [ ] `docker compose build && docker compose up -d`
- [ ] `docker compose ps` → tous les services `healthy`/`running`
- [ ] `curl http://127.0.0.1:4000/api/health` → `{"status":"ok"}`
- [ ] `./scripts/restore-data.sh` lancé, connexion testée sur `http://<ip>/login`
- [ ] Si des `?` apparaissent à la place d'accents : `scripts/repair-encoding.ps1`
      lancé en dry-run puis `-Apply` (voir §6bis)
- [ ] Cron de sauvegarde `pg_dump` en place, copié hors du serveur
- [ ] Pare-feu du serveur confirmé : seuls 80, 8080 et 4343 sont ouverts en
      entrée (+ le port SSH déjà utilisé pour s'y connecter). `nginx` publie
      déjà sur le 80, qui est ouvert — **rien à changer** dans
      `docker-compose.yml`. 8080/4343 ne sont pas utilisés par cette appli ;
      ils resteront disponibles si un besoin futur apparaît (ex. exposer un
      service admin séparé), voir note en section 1.
