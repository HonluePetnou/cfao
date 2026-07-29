# Plan d'implémentation — GMAO Multi-Supermarché

> Document destiné à un agent de code IA (OpenCode ou équivalent). Suivre les phases dans l'ordre. Chaque ticket contient un objectif, les fichiers concernés et un critère d'acceptation vérifiable.

## 0. Vue d'ensemble du projet

Application de Gestion de Maintenance Assistée par Ordinateur (GMAO) pour une chaîne de supermarchés. Chaque supermarché gère ses départements (rayons), chacun ayant des équipements spécifiques. Un maintenancier par supermarché gère la maintenance préventive (planning) et curative (pannes signalées).

**Architecture hybride :**
- **Backend/ERP** : Odoo 17 Community (Python + PostgreSQL) — gratuit, open source
- **Frontend terrain** : Next.js 14 (App Router, TypeScript) en PWA installable, avec mode hors-ligne
- **Back-office** : interface web native d'Odoo (pas de développement nécessaire)
- **Hébergement** : VPS unique (Docker Compose), ex. Hostinger KVM 2

**Pourquoi cette stack :** Odoo Enterprise facture l'app mobile officielle avec sync hors-ligne par utilisateur/mois (installations Enterprise). En développant notre propre PWA sur Odoo **Community** (gratuit), on obtient le même résultat fonctionnel sans coût récurrent — le seul coût est le développement initial, qu'on accélère avec l'IA.

---

## 1. Modèle métier

### 1.1 Hiérarchie

```
Supermarché (= société Odoo / res.company)
  └── Département (= gmao.department, ex: Boucherie, Frais, Caisses)
        └── Équipement (= maintenance.equipment étendu)
```

### 1.2 Rôles et permissions

| Rôle | Portée | Type de compte | Droits |
|---|---|---|---|
| **Super Admin** | Global, tous les supermarchés | Individuel | Crée les sociétés (supermarchés), crée tous les comptes, accès total |
| **Maintenancier** | Un seul supermarché (fixe) | Individuel | CRUD équipements de son supermarché, gère planning préventif, traite les bons curatifs |
| **Demandeur** | Un département, dans un supermarché | Partagé (par département, sur appareil fixe) | Signale une panne (photo + description), lecture seule sur équipements de son département |

**Point clé :** aucune création de compte en libre-service. Seul le Super Admin (ou un Admin local délégué, à activer plus tard si besoin) crée les comptes. L'utilisateur reçoit ses identifiants et se connecte simplement — jamais d'inscription.

**Implémentation Odoo :** utiliser le multi-société natif (`res.company` = un supermarché). Les `record rules` (`ir.rule`) filtrent automatiquement les données par `company_id`, donc un maintenancier ne voit que les équipements/bons de son supermarché sans code additionnel.

---

## 2. Modèle de données

| Modèle | Type | Champs clés | Notes |
|---|---|---|---|
| `res.company` | natif Odoo | name, code (identifiant unique du supermarché) | 1 société = 1 supermarché |
| `gmao.department` | custom | name, company_id | Rayon/département, rattaché à une société |
| `maintenance.equipment` | natif + hérité | code, name, department_id (custom), criticite (custom: haute/moyenne/basse), company_id, photo, date_mise_service, fournisseur | Ajout des champs custom via héritage `_inherit` |
| `maintenance.plan` (ou `maintenance.request` récurrent) | natif | equipment_id, périodicité, checklist, prochaine_échéance | Génération auto via cron |
| `maintenance.request` | natif + hérité | equipment_id, type (préventif/curatif), state, technicien_id, diagnostic, pièces_utilisées, temps_passé, photos, company_id | Le "bon de travail" |
| `product.product` (pièce détachée) | natif module Inventory | référence, stock_actuel, seuil_alerte | Lié aux équipements compatibles via `product_id` sur les lignes de bon de travail |
| `stock.move` | natif | pièce, quantité, bon_travail_lié | Décrémentation automatique à la clôture d'un bon |
| `res.users` + `res.groups` | natif + custom groups | company_ids, groups_id (Super Admin / Maintenancier / Demandeur) | Groupes custom créés dans `security/gmao_security.xml` |

---

## 3. Structure du dépôt

```
gmao-supermarche/
├── docker-compose.yml
├── .env.example
├── odoo/
│   ├── addons/
│   │   └── gmao_extension/
│   │       ├── __init__.py
│   │       ├── __manifest__.py
│   │       ├── models/
│   │       │   ├── __init__.py
│   │       │   ├── gmao_department.py
│   │       │   ├── maintenance_equipment.py
│   │       │   ├── maintenance_request.py
│   │       │   └── res_company.py
│   │       ├── controllers/
│   │       │   ├── __init__.py
│   │       │   └── gmao_api.py          # endpoints REST/JSON consommés par le frontend
│   │       ├── security/
│   │       │   ├── gmao_security.xml     # groupes + record rules
│   │       │   └── ir.model.access.csv
│   │       ├── views/
│   │       │   ├── gmao_department_views.xml
│   │       │   └── maintenance_equipment_views.xml
│   │       └── data/
│   │           └── ir_cron_data.xml      # génération auto des bons préventifs
│   └── config/
│       └── odoo.conf
└── frontend/
    ├── next.config.js
    ├── public/
    │   ├── manifest.json
    │   └── icons/
    ├── app/
    │   ├── layout.tsx
    │   ├── login/page.tsx
    │   ├── dashboard/page.tsx           # liste des bons assignés (technicien)
    │   ├── equipement/[id]/page.tsx     # fiche équipement + scan QR
    │   ├── bon-travail/[id]/page.tsx    # détail + clôture d'un bon
    │   └── signaler-panne/page.tsx      # formulaire demandeur
    ├── lib/
    │   ├── api.ts                       # client API vers Odoo
    │   ├── db.ts                        # config Dexie.js (offline)
    │   └── sync.ts                      # logique de synchronisation
    └── components/
        ├── BonTravailCard.tsx
        ├── QRScanner.tsx
        └── OfflineIndicator.tsx
```

---

## 4. Phase 0 — Setup environnement (local, Windows + Docker Desktop)

**Objectif :** avoir Odoo + PostgreSQL qui tournent en local, et le squelette Next.js prêt.

### Étapes
1. Installer Docker Desktop (avec WSL2).
2. Créer `docker-compose.yml` (service `db` PostgreSQL 15 + service `odoo` image `odoo:17.0`, volume `./odoo/addons:/mnt/extra-addons`, port `8069:8069`).
3. `docker compose up -d` → créer la base de données via `http://localhost:8069`.
4. Activer les modules **Maintenance** et **Inventory** dans Odoo (Apps).
5. Créer le squelette du module `gmao_extension` (`__manifest__.py` dépendant de `maintenance` et `stock`), l'installer.
6. `npx create-next-app@latest frontend --typescript --tailwind --app` puis `npm install next-pwa dexie`.
7. Configurer `next-pwa` dans `next.config.js` + `manifest.json` (nom "GMAO Technicien", couleurs navy `#060537` / orange `#FA5B07`).

**Critère d'acceptation Phase 0 :**
- [ ] `docker compose up -d` démarre sans erreur
- [ ] Base Odoo créée et accessible sur `localhost:8069`
- [ ] Modules Maintenance + Inventory activés
- [ ] Module `gmao_extension` installé sans erreur
- [ ] `npm run dev` démarre le frontend Next.js sans erreur
- [ ] Le manifest PWA est chargé (vérifiable dans DevTools → Application → Manifest)

---

## 5. Phase 1 — Multi-société, rôles et actifs (site pilote)

### T1 — Modèles de base et sécurité
- Créer `gmao.department` (name, company_id).
- Étendre `maintenance.equipment` : ajouter `department_id` (Many2one gmao.department), `criticite` (Selection).
- Créer les groupes de sécurité : `group_gmao_super_admin`, `group_gmao_maintenancier`, `group_gmao_demandeur` dans `security/gmao_security.xml`.
- Créer les `ir.rule` : un Maintenancier/Demandeur ne voit que les données de sa/ses `company_id` assignée(s).
- **Critère d'acceptation :** créer 2 sociétés de test (2 supermarchés), 2 users maintenanciers chacun rattaché à une société différente → chacun ne voit que les équipements de sa société.

### T2 — Vues back-office
- Vue liste/formulaire pour `gmao.department`.
- Vue formulaire équipement enrichie (department_id, criticite visibles).
- **Critère d'acceptation :** un Super Admin peut créer une société, un département dedans, un équipement dans ce département, depuis l'interface back-office Odoo.

### T3 — API REST (contrôleurs Odoo)
- Contrôleur `gmao_api.py` avec authentification par API key (header `X-API-Key` lié à `res.users`).
- Endpoints minimum :
  | Méthode | Route | Description |
  |---|---|---|
  | POST | `/api/gmao/login` | Authentification, retourne un token de session |
  | GET | `/api/gmao/equipments` | Liste des équipements du département/société de l'utilisateur connecté |
  | GET | `/api/gmao/equipments/:id` | Détail d'un équipement |
  | GET | `/api/gmao/maintenance-requests` | Bons de travail assignés au technicien connecté |
  | POST | `/api/gmao/maintenance-requests` | Créer un bon (signalement de panne) |
  | PATCH | `/api/gmao/maintenance-requests/:id` | Mettre à jour/clôturer un bon |
- **Critère d'acceptation :** tester chaque endpoint avec `curl` ou Postman, vérifier que les données retournées respectent le scope société/département de l'utilisateur.

### T4 — PWA : authentification et liste des bons
- Page `login/page.tsx` : formulaire simple identifiant/mot de passe → appelle `/api/gmao/login`, stocke le token (cookie ou state, **jamais localStorage** côté artifacts mais ok en vraie app Next.js déployée).
- Page `dashboard/page.tsx` : liste des bons de travail assignés au technicien connecté.
- **Critère d'acceptation :** un maintenancier de test se connecte et voit uniquement ses bons de travail.

### T5 — Signalement de panne (demandeur)
- Page `signaler-panne/page.tsx` : formulaire simplifié (équipement, description, photo) accessible sans navigation complexe.
- **Critère d'acceptation :** un compte "Demandeur" crée un signalement qui apparaît comme bon de travail curatif côté back-office Odoo, avec statut "Nouveau".

**Fin de Phase 1 = site pilote fonctionnel : équipements gérés, bons curatifs signalés et traités, isolation multi-société vérifiée.**

---

## 6. Phase 2 — Préventif, stock, scan QR

### T6 — Plans de maintenance préventive
- Utiliser/étendre `maintenance.plan` avec périodicité + checklist.
- Cron Odoo (`ir_cron_data.xml`) : génère automatiquement un `maintenance.request` de type préventif à échéance, notifie le technicien assigné.
- **Critère d'acceptation :** créer un plan avec échéance à J+1, avancer la date système, vérifier qu'un bon est généré automatiquement.

### T7 — Gestion des pièces détachées
- Lier les pièces (`product.product`) aux équipements compatibles.
- À la clôture d'un bon de travail avec pièces consommées, décrémenter le stock automatiquement (`stock.move`).
- Alerte (email ou notification back-office) quand stock < seuil défini.
- **Critère d'acceptation :** clôturer un bon avec une pièce consommée → stock décrémenté visible dans Inventory ; faire passer le stock sous le seuil → alerte déclenchée.

### T8 — Scan QR code équipement
- Génération d'un QR code par équipement (identifiant → URL `frontend/equipement/[id]`).
- Composant `QRScanner.tsx` (lib `html5-qrcode`) dans la PWA.
- **Critère d'acceptation :** scanner un QR code depuis un téléphone ouvre directement la fiche du bon équipement.

---

## 7. Phase 3 — Offline, KPI, déploiement

### T9 — Mode hors-ligne
- `lib/db.ts` : schéma Dexie.js pour stocker localement bons de travail en attente de synchronisation.
- Service worker (Workbox via `next-pwa`) : cache des pages et assets, stratégie "network-first" avec fallback offline.
- `lib/sync.ts` : file de synchronisation, envoi des créations/modifications dès reconnexion détectée.
- **Critère d'acceptation :** couper le réseau, créer/clôturer un bon de travail depuis la PWA, rétablir le réseau → le bon apparaît côté Odoo sans action manuelle.

### T10 — Dashboard KPI
- Page dédiée (Next.js + `recharts`) consommant l'API Odoo : MTBF, MTTR, taux d'utilisation, coûts de maintenance.
- Filtrable par société, département, période.
- **Critère d'acceptation :** les graphiques reflètent les données réelles des bons de travail clôturés en base.

### T11 — Déploiement VPS
- Adapter `docker-compose.yml` pour la prod (variables d'environnement via `.env`, volumes persistants, `restart: unless-stopped`).
- Ajouter Nginx comme reverse proxy + certificat SSL (Let's Encrypt / Certbot).
- Build et déploiement du frontend Next.js (sur le même VPS ou Vercel selon préférence).
- **Critère d'acceptation :** l'application est accessible en HTTPS depuis un domaine, Odoo et la PWA fonctionnent en production.

---

## 8. Conventions pour l'agent de code

- **Python (Odoo)** : respecter les conventions Odoo standards (noms de modèles en snake_case avec préfixe `gmao.` pour le custom, hériter plutôt que dupliquer quand un modèle natif existe déjà).
- **TypeScript (Next.js)** : App Router, composants fonctionnels, Tailwind pour le style (palette navy `#060537` / orange `#FA5B07`).
- **Jamais de `localStorage`/`sessionStorage`** dans le code frontend si review en artifact ; en vrai déploiement Next.js classique, `localStorage` est acceptable pour le token, mais Dexie.js reste obligatoire pour les données offline structurées.
- **Sécurité** : toujours vérifier le scope `company_id`/`department_id` côté serveur (Odoo), ne jamais faire confiance uniquement à ce que le frontend envoie.
- **Commits** : un ticket (T1, T2, ...) = une unité de travail testable indépendamment, à committer séparément.
- **Ne pas** implémenter l'app mobile store (pas de build iOS/Android natif) — la PWA suffit, c'est un choix architectural délibéré pour rester gratuit.

---

## 9. Récapitulatif des critères de succès globaux

1. Isolation stricte des données par supermarché (multi-société) vérifiée avec au moins 2 sociétés de test.
2. 100% des équipements du site pilote référencés avec département et criticité.
3. Un technicien peut travailler entièrement hors-ligne et synchroniser sans perte de données.
4. Génération automatique des bons préventifs sans intervention manuelle.
5. Alerte de stock fonctionnelle.
6. Dashboard KPI reflétant les données réelles.
7. Aucun compte créé en libre-service — uniquement par un Super Admin.
