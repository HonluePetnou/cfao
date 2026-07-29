# Plan d'implémentation v2 — GMAO Multi-Supermarché (Full Custom)

> Remplace la version Odoo. Stack 100% TypeScript, cohérente avec la stack ZenStocks existante. Le modèle de données du **ticket** sera finalisé dans un second temps (à fournir), ce document pose l'architecture et les phases en attendant.

## 0. Changements actés par rapport à la v1

- **Plus d'Odoo** — stack full custom : **NestJS + Prisma + PostgreSQL** (backend) + **Next.js 14 PWA** (frontend).
- **Les maintenanciers sont universels** — pas rattachés à un supermarché fixe. Ils interviennent sur tickets provenant de n'importe quel supermarché.
- **Les users (demandeurs) sont rattachés à un seul supermarché** (et un département).
- **Assignation manuelle** — le user qui crée un ticket choisit lui-même le maintenancier dans la liste complète (tous visibles, pas de filtrage/suggestion pour l'instant).
- **Double validation de clôture** — le maintenancier marque un ticket "Terminé", seul le Super Admin peut le "Fermer" définitivement.
- **KPI en temps réel** côté Super Admin.
- **Rapports automatiques** (journaliers/hebdo) envoyés à l'admin, et bilans envoyés aux maintenanciers pour le préventif.

---

## 1. Stack technique

| Couche | Techno |
|---|---|
| Monorepo | Turborepo (cohérent avec ZenStocks) |
| Backend | NestJS + Prisma + PostgreSQL |
| Auth | JWT + guards RBAC par rôle |
| Frontend terrain | Next.js 14 (App Router) PWA — offline via Dexie.js + Workbox |
| Temps réel (KPI live, notifications) | Socket.io + Redis Pub/Sub |
| Jobs planifiés (rapports, digests préventif) | BullMQ (cron + queues) |
| Hébergement | VPS unique (Docker Compose) |

Cette stack réutilise directement les patterns déjà éprouvés sur ZenStocks (RBAC, temps réel WebSocket + Redis, BullMQ) — pas de nouvelle techno à apprendre.

---

## 2. Rôles (mis à jour)

| Rôle | Portée | Compte | Actions |
|---|---|---|---|
| **Super Admin** | Global | Individuel | **CRUD complet et exclusif** sur : Users, Maintenanciers, Équipements, Supermarchés (sites), Départements. Aucune création en libre-service — tout passe par l'admin. Suit les KPI temps réel. **Seul à pouvoir fermer un ticket.** Charge les plannings préventifs. |
| **Maintenancier** | Universel (tous supermarchés) | Individuel | Reçoit les tickets qui lui sont assignés, les traite par ordre de priorité, marque "Terminé" (pas "Fermé"). Reçoit un bilan journalier/hebdo du préventif à faire. Envoie un rapport de fin de journée. |
| **User (Demandeur)** | Un seul supermarché + un seul département | Individuel — chaque user a son propre compte, un département peut avoir plusieurs users | Signale une panne (crée un ticket), **choisit le maintenancier** dans la liste complète. |

---

## 3. Modèle de données (squelette — le détail du Ticket viendra après ton modèle)

| Entité | Champs clés (connus à ce stade) | Notes |
|---|---|---|
| `Supermarket` | id, nom, code (identifiant unique) | |
| `Department` | id, nom, supermarketId | |
| `Equipment` | id, nom, departmentId, criticité | |
| `User` | id, nom, email, role (SUPER_ADMIN / MAINTENANCIER / USER), supermarketId (nullable — null pour Super Admin et Maintenancier), departmentId (nullable — obligatoire pour un User) | Compte individuel pour tous les rôles. Maintenancier = universel → pas de supermarketId. Un Department peut avoir plusieurs Users. |
| `Ticket` (curatif) | **à préciser avec ton modèle** — a minima : id, equipmentId, createdByUserId, assignedMaintenancierId, priorité, statut, description, photos, dates de transition, closedByAdminId, motifRejet (si renvoyé) | Statuts : `NOUVEAU → ASSIGNE → EN_COURS → TERMINE → FERME` (par l'admin), avec possibilité pour l'admin de renvoyer un ticket `TERMINE` vers `EN_COURS` (statut `A_REPRENDRE` ou retour direct à `EN_COURS`) si le travail n'est pas jugé satisfaisant — à confirmer si tu veux un statut distinct `A_REPRENDRE` (avec motif visible pour le maintenancier) ou un simple retour à `EN_COURS`. |
| `PreventivePlan` | id, equipmentId, périodicité, checklist, maintenancierId assigné | Génère des tâches planifiées |
| `PreventiveTask` | id, planId, maintenancierId, dateEcheance, statut | Instance concrète d'un plan, apparaît dans le bilan journalier/hebdo |
| `DailyReport` / `WeeklyReport` | id, maintenancierId ou global, date, contenu, ticketsTraités, tempsPassé | Généré automatiquement en fin de journée |
| `KPISnapshot` (ou calcul à la volée) | métriques temps réel pour le Super Admin | Liste des KPI à définir avec toi |

**Statut du ticket — point encore à confirmer avec toi :** y a-t-il d'autres étapes entre "Assigné" et "En cours" (ex : le maintenancier doit "accepter" le ticket avant de commencer) ? Et pour le renvoi d'un ticket non satisfaisant : préfères-tu un statut dédié `A_REPRENDRE` (avec un champ "motif du rejet" visible par le maintenancier), ou simplement repasser le ticket en `EN_COURS` avec un commentaire de l'admin ?

---

## 4. Phases d'implémentation

### Phase 0 — Setup monorepo
- Turborepo avec `apps/api` (NestJS), `apps/web` (Next.js PWA), `packages/` partagés (types, config).
- PostgreSQL + Prisma init, `docker-compose.yml` (postgres + redis + api).
- Auth JWT de base (login, guards de rôle).
- **Critère d'acceptation :** un utilisateur seedé (Super Admin) peut se logger et recevoir un token valide.

### Phase 1 — Entités de base + back-office admin
- CRUD Supermarket, Department, Equipment, User, Maintenancier — **exclusivement accessible au Super Admin** (aucun autre rôle ne peut créer/modifier/supprimer ces entités).
- Interface Super Admin (Next.js — pages back-office) : gestion des supermarchés, des départements, des équipements, des users, des maintenanciers.
- RBAC : guards NestJS vérifiant le rôle + le scope (`supermarketId` pour un User, aucun scope pour un Maintenancier), et bloquant tout accès aux routes CRUD de configuration pour les rôles non-admin.
- **Critère d'acceptation :** le Super Admin crée un supermarché, un département, un équipement, un user rattaché, et un maintenancier (sans supermarketId) — chacun ne peut accéder qu'à ce que son rôle permet.

### Phase 2 — Workflow des tickets (curatif)
- Endpoint de création de ticket par un User (avec sélection du maintenancier dans la liste complète — endpoint `GET /maintenanciers` retournant tous les maintenanciers actifs).
- Transitions de statut : `NOUVEAU → ASSIGNE` (automatique à la création puisqu'un maintenancier est choisi dès le départ) `→ EN_COURS → TERMINE` (par le maintenancier) `→ FERME` (uniquement par le Super Admin). Depuis `TERMINE`, l'admin peut aussi renvoyer le ticket en `EN_COURS`/`A_REPRENDRE` si le travail n'est pas jugé satisfaisant, avec un motif transmis au maintenancier.
- Vue "mes tickets" côté maintenancier, **triée par priorité**.
- Vue "tous les tickets" côté Super Admin, avec action de clôture.
- Notification temps réel (Socket.io) au maintenancier à l'assignation, à l'admin quand un ticket passe "Terminé" (en attente de clôture).
- **Critère d'acceptation :** un user crée un ticket et choisit un maintenancier → le maintenancier le voit apparaître en temps réel dans sa liste triée par priorité → il le marque terminé → l'admin le voit en attente et peut le fermer.

### Phase 3 — Maintenance préventive
- CRUD des plans préventifs (Super Admin), avec assignation à un maintenancier.
- Job planifié (BullMQ, cron) qui génère les `PreventiveTask` à échéance et notifie le maintenancier concerné.
- Vue "bilan du jour / de la semaine" côté maintenancier (préventif + curatif à faire).
- **Critère d'acceptation :** un plan préventif arrivant à échéance génère une tâche visible dans le bilan du maintenancier assigné, sans action manuelle de l'admin.

### Phase 4 — Rapports et KPI
- Job planifié : génération automatique d'un rapport de fin de journée par maintenancier (tickets traités, temps passé, tâches préventives réalisées), envoyé/visible à l'admin.
- Dashboard KPI temps réel pour le Super Admin (Socket.io ou polling léger) — **liste des KPI à définir avec toi**, exemples pressentis : nombre de tickets ouverts/fermés par période, temps moyen de traitement, charge par maintenancier, taux de respect du préventif.
- **Critère d'acceptation :** un rapport de fin de journée est généré automatiquement sans action manuelle ; le dashboard admin reflète les données à jour.

### Phase 5 — Offline PWA + déploiement
- Mode hors-ligne (Dexie.js + Workbox) côté interface User/Maintenancier pour la création/consultation de tickets sans réseau, synchronisation au retour.
- Déploiement VPS (Docker Compose complet : postgres, redis, api, web, nginx + SSL).
- **Critère d'acceptation :** un ticket créé hors-ligne apparaît côté serveur dès la reconnexion.

---

## 5. Ce qu'il reste à clarifier avant de détailler le modèle de données final

1. **Le modèle de ticket** que tu vas fournir (champs exacts, éventuels statuts intermédiaires).
2. Les **niveaux de priorité** exacts (ex : Basse/Moyenne/Haute/Critique ?) et qui les fixe (le user à la création, ou le maintenancier/admin après coup).
3. La **liste des KPI** souhaités côté Super Admin.

Dès que tu envoies le modèle de ticket, je mets à jour la section 3 avec le schéma Prisma complet.
