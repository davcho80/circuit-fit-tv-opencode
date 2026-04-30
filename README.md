# Circuit Fit TV

Système d'entraînement en circuit multi-écrans synchronisés, inspiré de F45 TV / CloudFit.

Une tablette pilote plusieurs écrans Android TV répartis dans un espace d'entraînement : chaque station physique affiche l'exercice à exécuter en vidéo, une TV centrale affiche le tableau de bord global (timer, rotation, progression).

## Statut

**Prototype V1 fonctionnel** — Sprints 0 à 8 complétés

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

## Fonctionnalités

### Tablette (coach)
- Créer et configurer des circuits (stations, exercices, timers, mode rotation)
- Démarrer / pauser / arrêter une session live
- Déclencher une pause hydratation manuelle (30s / 1 min / 2 min)
- Visualiser les écrans connectés et les gérer
- Planifier des sessions récurrentes (calendrier hebdomadaire)

### TV Station (Android)
- Affichage de l'exercice courant avec timer
- Synchronisation temps réel via WebSocket
- Overlay pause hydratation avec countdown et icône bouteille
- Appairage automatique via code PIN ou QR code
- Reconnexion automatique au redémarrage

### TV Centrale (Android / PWA)
- Carte de toutes les stations avec indicateur actif/transition
- Flèches de rotation animées pendant les transitions
- Timer global et progression (round courant / total)
- Overlay hydratation synchronisé

### Backend
- Scheduler automatique : démarre une session à l'heure planifiée (30s polling, protection double-fire)
- WebSocket hub avec rôles (coach / tv / monitor)
- REST API complète : exercices, circuits, sessions, displays, schedules
- Gestion des fuseaux horaires via `Intl.DateTimeFormat`

## Architecture

```
circuit-fit-tv/
├── backend/           Serveur Node.js + Fastify + WebSocket
│   ├── prisma/        Schéma PostgreSQL + migrations
│   └── src/
│       ├── routes/    REST : exercises, circuits, displays, sessions, schedules, pair
│       ├── sessions/  Orchestrateur live + scheduler automatique
│       └── ws/        Hub WebSocket + handlers + appairage
├── pwa/               App tablette — SvelteKit PWA (Svelte 5 runes + Tailwind v4)
│   └── src/
│       ├── lib/       CircuitBuilder, LayoutEditor, api.ts, ws.svelte.ts
│       └── routes/    circuits/, session/, schedule/, screens/, tv/, tv/central/
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
cd backend && npx prisma migrate deploy
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

### App Android TV

Ouvrir `android-tv/` dans Android Studio et lancer sur un émulateur TV ou appareil physique. Configurer l'URL du serveur WebSocket (`ws://<ip-locale>:3000/ws`) dans l'écran de setup.

## Documentation

- [Spécification technique complète](docs/spec.docx)
- [Architecture Decision Records](docs/adr/)

## Licence

Privé — usage personnel.
