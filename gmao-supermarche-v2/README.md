# GMAO — Gestion de Maintenance Assistée par Ordinateur

Application full-stack de gestion de maintenance multi-supermarchés. Stack 100% TypeScript.

## Architecture

```
gmao-supermarche-v2/
├── apps/
│   ├── api/          # Backend NestJS + Prisma + PostgreSQL (port 4000)
│   └── web/          # Frontend PWA Next.js 14 (port 3000)
├── packages/
│   └── config/       # Configuration TypeScript partagée
├── docker-compose.yml
└── turbo.json
```

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | NestJS + Prisma + PostgreSQL |
| Temps réel | Socket.io |
| Auth | JWT + RBAC (3 rôles) |
| Frontend | Next.js 14 App Router, PWA |
| UI | Tailwind CSS + Lucide React + Recharts |
| Ordonnancement | BullMQ (préventif cron) |
| Monorepo | Turborepo |

## Démarrage rapide

```powershell
# 1. Base de données + Redis
docker compose up -d postgres redis

# 2. API
cd gmao-supermarche-v2/apps/api
npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
npm run dev

# 3. Frontend
cd gmao-supermarche-v2/apps/web
npm install
npm run dev
```

Application accessible sur http://localhost:3000.

## Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@gmao.local | admin123 | Super Admin |
| tech.lille@gmao.local | admin123 | Maintenancier |
| user.lille@gmao.local | admin123 | Demandeur (Lille, Boucherie) |

## Rôles et permissions

| Rôle | Accès |
|------|-------|
| **Super Admin** | CRUD complet : supermarchés, départements, équipements, utilisateurs, plans préventifs. Ferme les tickets. Voit les KPI. |
| **Maintenancier** | Intervient sur tous les supermarchés. Reçoit les tickets assignés, les traite par priorité. Marque "Terminé". Reçoit les tâches préventives. |
| **Demandeur (USER)** | Rattaché à un supermarché + département. Crée des tickets, choisit le maintenancier, définit la priorité. |

## Workflow ticket

```
USER (demandeur)
  → crée un ticket + choisit maintenancier + priorité
  → statut ASSIGNE, notification Socket.io
  → MAINTENANCIER voit le ticket trié par priorité
  → "Prendre en charge" → EN_COURS
  → "Marquer terminé" → TERMINE
  → SUPER_ADMIN "Ferme" → FERME
  → ou "Renvoyer avec motif" → A_REPRENDRE
```

## Préventif

Le Super Admin crée des plans préventifs (équipement + périodicité + maintenancier assigné). Un cron génère les tâches à échéance. Le maintenancier les voit dans `/preventive` et les marque effectuées.

## APIs principales

| Méthode | Route | Accès |
|---------|-------|-------|
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authentifié |
| CRUD | `/api/supermarkets` | Super Admin |
| CRUD | `/api/departments` | Super Admin |
| GET | `/api/equipments` | Tous |
| POST/PATCH/DELETE | `/api/equipments` | Super Admin |
| GET | `/api/maintenanciers` | Authentifié |
| GET/POST | `/api/tickets` | Tous |
| PATCH | `/api/tickets/:id/start` | Maintenancier |
| PATCH | `/api/tickets/:id/done` | Maintenancier |
| PATCH | `/api/tickets/:id/close` | Super Admin |
| PATCH | `/api/tickets/:id/send-back` | Super Admin |
| CRUD | `/api/users` | Super Admin |
| CRUD | `/api/preventive-plans` | Super Admin |
| GET | `/api/preventive-tasks/my` | Maintenancier |
| PATCH | `/api/preventive-tasks/:id/done` | Maintenancier |
| POST | `/api/cron/generate-tasks` | Super Admin |
| GET | `/api/kpi` | Super Admin |

## Pages frontend

| URL | Rôle | Contenu |
|-----|------|---------|
| `/login` | Tous | Connexion |
| `/dashboard` | Tous | Tickets triés par priorité |
| `/tickets/new` | USER | Création ticket |
| `/tickets/[id]` | Tous | Détail + actions |
| `/preventive` | Maintenancier | Tâches préventives |
| `/admin` | Super Admin | Back-office |
| `/kpi` | Super Admin | Indicateurs |

## Mode hors-ligne

Le frontend embarque Dexie.js (IndexedDB) et un service worker (Workbox via next-pwa) pour le fonctionnement hors-ligne. Les tickets créés sans réseau sont stockés localement et synchronisés automatiquement à la reconnexion.
