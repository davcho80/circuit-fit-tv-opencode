# Circuit Fit TV

Système d'entraînement en circuit multi-écrans synchronisés, inspiré de F45 TV / CloudFit.

Une tablette pilote plusieurs écrans Android TV répartis dans un espace d'entraînement : chaque station physique affiche l'exercice à exécuter en vidéo, une TV centrale affiche le tableau de bord global (timer, rotation, progression).

## Statut

**Prototype V1 fonctionnel** — base coach/TV/admin/deploiement operationnelle

| Sprint | Fonctionnalité | Statut |
|--------|---------------|--------|
| Sprint 0 | Fondations backend (Fastify, Prisma, WebSocket hub) | ✅ Complété |
| Sprint 1 | Bibliothèque d'exercices (CRUD, upload vidéo, MinIO) | ✅ Complété |
| Sprint 2 | Circuit builder (stations, layout salle, pauses eau) | ✅ Complété |
| Sprint 3 | App Android TV (Jetpack Compose, appairage PIN/QR) | ✅ Complété |
| Sprint 4 | Orchestration live (session multi-écrans, WebSocket coach) | ✅ Complété |
| Sprint 5 | TV centrale (carte stations, flèches rotation animées) | ✅ Complété |
| Sprint 6 | Hydratation (pauses manuelles + programmées, overlay bouteille) | ✅ Complété |
| Sprint 7 | Calendrier (cédules récurrentes, démarrage automatique sessions) | ✅ Complété |
| Sprint 8 | Gestion des écrans (liste, modification rôle/station, suppression) | ✅ Complété |
| Stabilisation | Qualité locale : typecheck, lint, build, ESLint strict | ✅ Complété |
| Admin | Console admin unifiée : studio, écrans, users, diagnostics, update | ✅ Complété |
| Sécurité | JWT WebSocket coach, secret TV pairé, secrets prod obligatoires | ✅ En cours |
| Déploiement | Docker production LAN, mDNS, migrations, backups PostgreSQL | ✅ En cours |
| Circuit V2 | Warmup/cooldown, whiteboard, notes coach, modèle enrichi | À faire |

## Fonctionnalités

### Tablette (coach)
- Créer et configurer des circuits (stations, exercices, timers, mode rotation)
- Démarrer / pauser / arrêter une session live
- Déclencher une pause hydratation manuelle (30s / 1 min / 2 min)
- Visualiser les écrans connectés et les gérer
- Planifier des sessions récurrentes (calendrier hebdomadaire)
- Installer la console comme PWA et conserver une session coach limitée dans le temps

### Console admin
- Gérer le branding studio, le logo, la couleur principale et le fuseau horaire
- Appairer les TV par PIN/QR et configurer les rôles `STATION`, `CENTRAL`, `SCHEDULE`
- Gérer les comptes admin/coach avec protection du dernier admin
- Lire les diagnostics système : DB, stockage, scheduler, WebSocket, écrans online/offline
- Consulter les derniers événements d'audit admin
- Lancer une mise à jour système si `UPDATE_SCRIPT_PATH` est configuré

### TV Station (Android / PWA)
- Affichage de l'exercice courant avec timer
- Synchronisation temps réel via WebSocket
- Overlay pause hydratation avec countdown et icône bouteille
- Appairage automatique via code PIN ou QR code
- Reconnexion automatique au redémarrage
- Reconnexion sécurisée par `displayId` + secret TV généré au pairing

### TV Centrale (Android / PWA)
- Carte de toutes les stations avec indicateur actif/transition
- Flèches de rotation animées pendant les transitions
- Timer global et progression (round courant / total)
- Overlay hydratation synchronisé

### TV Calendrier (PWA / Android)
- Affichage plein écran des cours planifiés
- Lecture publique via route TV dédiée
- Rôle écran `SCHEDULE` supporté côté Prisma, API, PWA et Android

### Backend
- Scheduler automatique : démarre une session à l'heure planifiée (30s polling, protection double-fire)
- WebSocket hub avec rôles (coach / tv / monitor) et authentification JWT pour coach/monitor
- REST API complète : exercices, circuits, sessions, displays, schedules, diagnostics, audit
- Gestion des fuseaux horaires via `Intl.DateTimeFormat`
- Secrets obligatoires en production (`JWT_SECRET`, secrets S3)
- Audit persistant des actions critiques : login, pairing TV, sessions, users, settings, displays, update

## Architecture

```
circuit-fit-tv/
├── backend/           Serveur Node.js + Fastify + WebSocket
│   ├── prisma/        Schéma PostgreSQL + migrations
│   └── src/
│       ├── routes/    REST : exercises, circuits, displays, sessions, schedules, pair, diagnostics
│       ├── sessions/  Orchestrateur live + scheduler automatique
│       └── ws/        Hub WebSocket + handlers + appairage
├── pwa/               App tablette — SvelteKit PWA (Svelte 5 runes + Tailwind v4)
│   └── src/
│       ├── lib/       CircuitBuilder, LayoutEditor, api.ts, ws.svelte.ts
│       └── routes/    admin/, circuits/, session/, schedule/, tv/, tv/central/, tv/schedule/
├── android-tv/        App Android TV — Kotlin + Jetpack Compose
│   └── src/
│       ├── ui/        TvScreen, TvViewModel, SetupScreen, QrCode
│       └── ws/        WsClient, Messages
├── prototypes/        Spikes validés
│   └── timer-sync/    PoC synchronisation multi-écrans (validé)
└── docs/
    ├── spec.docx      Spécification technique détaillée
    └── adr/           Architecture Decision Records
```

## Stack technique

| Composante | Stack |
|------------|-------|
| Backend | Node.js 20 + Fastify 5 + WebSocket + Prisma 7 + PostgreSQL |
| Tablette | PWA SvelteKit 2 + Svelte 5 (runes) + Tailwind v4 |
| TV Android | Kotlin + Jetpack Compose for TV |
| Stockage vidéo | MinIO (S3-compatible) |
| Hébergement | LXC Debian 12 sur Proxmox |

## Démarrage rapide

### Prérequis

- Node.js 20+ (`nvm use` si tu as nvm)
- Docker + Docker Compose

### Premier setup

```bash
# Dépendances JS (workspace)
npm install

# Variables d'environnement
cp .env.example .env   # ajuster si besoin

# Services de dev (PostgreSQL, MinIO, Redis, Adminer)
npm run services:up

# Migration DB + génération Prisma client
npm run db:migrate --workspace=@cfitv/backend
```

### Lancer en dev

```bash
# Depuis la racine — lance backend + pwa en parallèle
npm run dev

# Ou séparément :
cd backend && npm run dev   # → http://localhost:3000
cd pwa     && npm run dev   # → http://localhost:5173
```

### Services exposés

| Service | URL | Usage |
|---------|-----|-------|
| Backend API | http://localhost:3000 | REST + WebSocket |
| PWA | http://localhost:5173 | Interface tablette |
| PostgreSQL | localhost:5432 | Base de données |
| MinIO Console | http://localhost:9001 | Stockage vidéo |
| Adminer | http://localhost:8080 | UI base de données |

### Validation locale

Avant de livrer une modification, lancer depuis la racine :

```bash
npm run typecheck
npm run lint
npm run build
```

Ces commandes couvrent les workspaces backend, PWA et packages partagés sans relâcher la configuration TypeScript stricte.

Si une erreur Prisma indique qu'une colonne manque dans la base locale, relancer :

```bash
npm run db:migrate --workspace=@cfitv/backend
```

### Installation PWA et session coach

La console coach est installable comme PWA sur les navigateurs qui supportent le manifest web et le service worker :

- Chrome / Edge sur Android, ChromeOS, Windows, macOS et Linux : prompt d'installation intégré quand le navigateur expose `beforeinstallprompt`.
- Safari iOS/iPadOS : installation via le menu de partage, puis "Ajouter à l'écran d'accueil".

La session coach est conservée dans le navigateur via le JWT stocké en `localStorage`. La politique par défaut du backend signe les tokens pour 8 heures et peut être ajustée avec `JWT_EXPIRES_IN` ; l'interface affiche l'échéance dans le menu utilisateur et supprime automatiquement le token expiré. Les routes TV (`/tv`, `/pair`) restent publiques et n'envoient pas de session coach aux WebSocket TV.

### App Android TV

Ouvrir `android-tv/` dans Android Studio et lancer sur un émulateur TV ou appareil physique. Configurer l'URL du serveur WebSocket (`ws://<ip-locale>:3000/ws`) dans l'écran de setup.

## Documentation

- [Spécification technique complète](docs/spec.docx)
- [Architecture Decision Records](docs/adr/)
- [Déploiement production locale](docs/deployment.md)

## Production locale

Le déploiement gym utilise `docker-compose.prod.yml` avec backend en `network_mode: host` pour publier `_cfitv._tcp` en mDNS sur le LAN. PostgreSQL, Redis et la console MinIO restent limités à `127.0.0.1`; les médias MinIO et le backend sont exposés au LAN.

Commandes principales :

```bash
cp .env.production.example .env.production
npm run prod:up
npm run prod:logs
npm run prod:backup
```

Les migrations sont appliquées par le service `migrate` avant le démarrage backend. Les backups PostgreSQL automatisés sont disponibles avec le profil Docker `backup`.

## Licence

Privé — usage personnel.
