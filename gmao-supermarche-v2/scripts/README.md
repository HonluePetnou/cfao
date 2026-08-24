# Scripts de déploiement

Tout ce qui sert à préparer, restaurer ou réparer les données de production
est réuni ici. Voir [`../DEPLOIEMENT.md`](../DEPLOIEMENT.md) pour la
procédure complète — ce fichier n'est qu'un index rapide.

| Script | Rôle | Quand l'utiliser |
|---|---|---|
| [`setup-env.sh`](setup-env.sh) | Génère `.env` (secrets forts, `FRONTEND_URL`) | Une fois, au premier déploiement (§4 de `DEPLOIEMENT.md`) |
| [`restore-data.sh`](restore-data.sh) | Restaure `data/gmao-seed.sql` dans Postgres | Une fois, juste après le premier `docker compose up -d` (§6) — serveur Linux/macOS avec bash |
| [`restore-data.ps1`](restore-data.ps1) | Équivalent strict de `restore-data.sh` | Même étape, serveur Windows sans bash |
| [`repair-encoding.ps1`](repair-encoding.ps1) | Corrige les textes accentués corrompus en "?" par un ancien bug de `restore-data.ps1` | Ponctuel, seulement si la corruption d'encodage a eu lieu (voir §6bis de `DEPLOIEMENT.md`) |

## Un script sur deux dossiers : `repair-encoding.*`

`repair-encoding.ps1` (ici) est le point d'entrée à lancer — il fait tout le
travail Docker/Postgres (schéma temporaire, chargement du dump propre) puis
délègue la comparaison ligne-à-ligne à
[`../apps/api/prisma/repair-encoding.ts`](../apps/api/prisma/repair-encoding.ts).

Ce `.ts` reste dans `apps/api/prisma/` (comme tous les autres scripts
Prisma/DB du projet — `seed.ts`, `import-*.ts`, etc.) et **pas** ici, parce
qu'il doit tourner *dans* le conteneur `api` via
`npm exec --workspace=api -- ts-node prisma/repair-encoding.ts` : c'est ce
chemin relatif à `apps/api/` qui est en dur dans l'appel Docker du `.ps1`.
Le déplacer casserait cet appel sans rien gagner — tu n'as de toute façon
jamais besoin de le lancer toi-même, seulement via le `.ps1`.

## Convention ASCII pour les `.ps1`

Tous les scripts PowerShell de ce dossier sont volontairement écrits en
ASCII pur (pas d'accents). Windows PowerShell 5.1 lit mal un `.ps1` contenant
des caractères non-ASCII sans BOM UTF-8 (ce que produit Notepad par défaut)
— ça casse le parsing. Si tu modifies un de ces scripts, garde-le en ASCII.
