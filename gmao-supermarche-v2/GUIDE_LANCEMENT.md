# Guide de lancement — GMAO v2 (Full TypeScript)

## Stack

```
gmao-supermarche-v2/
├── apps/api/          # NestJS + Prisma (port 4000)
├── apps/web/          # Next.js 14 PWA (port 3000)
├── packages/config/   # tsconfig partagé
├── docker-compose.yml # PostgreSQL + Redis
└── GUIDE_LANCEMENT.md
```

## Lancer le projet

```powershell
# 1. PostgreSQL + Redis
cd gmao-supermarche-v2
docker compose up -d postgres redis

# 2. API NestJS
cd apps/api
npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
npm run dev

# 3. Frontend Next.js
cd apps/web
npm install
npm run dev
```

## URLs

| Service | URL |
|---|---|
| API | http://localhost:4000 |
| Frontend | http://localhost:3000 |

## Comptes de test

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@gmao.local | admin123 | SUPER_ADMIN |
| tech.lille@gmao.local | admin123 | MAINTENANCIER |
| user.lille@gmao.local | admin123 | USER (Lille, Boucherie) |

## Pages / Navigation

| URL | Rôle | Fonction |
|---|---|---|
| /login | Tous | Connexion |
| /dashboard | Tous | Tickets triés par priorité |
| /tickets/new | USER | Créer un ticket + choisir le maintenancier |
| /tickets/[id] | Tous | Détail + actions (selon rôle/statut) |
| /preventive | MAINTENANCIER | Tâches préventives du jour |
| /admin | SUPER_ADMIN | CRUD entités + plans préventifs |
| /kpi | SUPER_ADMIN | Tableau de bord KPI temps réel |

## Workflow

```
USER crée un ticket → choisit maintenancier + priorité
  → statut ASSIGNE, notification temps réel (Socket.io)
  → MAINTENANCIER voit tickets triés par priorité
  → "Prendre en charge" → EN_COURS
  → "Marquer terminé" → TERMINE
  → SUPER_ADMIN "Ferme" définitivement → FERME
  → ou "Renvoyer" avec motif → A_REPRENDRE
```

## APIs

| Méthode | Route | Accès |
|---|---|---|
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Authentifié |
| GET/POST/PATCH/DELETE | /api/supermarkets | SUPER_ADMIN |
| GET/POST/PATCH/DELETE | /api/departments | SUPER_ADMIN |
| GET | /api/equipments | Tous |
| POST/PATCH/DELETE | /api/equipments | SUPER_ADMIN |
| GET | /api/maintenanciers | Authentifié |
| GET/POST | /api/tickets | Tous |
| PATCH | /api/tickets/:id/start | MAINTENANCIER |
| PATCH | /api/tickets/:id/done | MAINTENANCIER |
| PATCH | /api/tickets/:id/close | SUPER_ADMIN |
| PATCH | /api/tickets/:id/send-back | SUPER_ADMIN |
| GET/POST/PATCH/DELETE | /api/users | SUPER_ADMIN |
| GET/POST/PATCH/DELETE | /api/preventive-plans | SUPER_ADMIN |
| GET | /api/preventive-tasks/my | MAINTENANCIER |
| PATCH | /api/preventive-tasks/:id/done | MAINTENANCIER |
| POST | /api/cron/generate-tasks | SUPER_ADMIN (déclenchement manuel) |
| GET | /api/kpi | SUPER_ADMIN |
