# Circuit Fit TV

Système d'entraînement en circuit multi-écrans synchronisés, inspiré de F45 TV / CloudFit.

Une tablette pilote plusieurs écrans Android TV répartis dans un espace d'entraînement : chaque station physique affiche l'exercice à exécuter en vidéo, une TV centrale affiche le tableau de bord global (timer, rotation, progression).

## Statut

**En développement — prototype V1**

- [x] Analyse et spécification
- [x] PoC timer sync (validation technique)
- [ ] Sprint 0 — Fondations
- [ ] Sprint 1 — Bibliothèque d'exercices
- [ ] Sprint 2 — Circuit builder
- [ ] Sprint 3 — Android TV station
- [ ] Sprint 4 — Orchestration live
- [ ] Sprint 5 — TV centrale
- [ ] Sprint 6 — Polish

## Structure du repo

```
circuit-fit-tv/
├── backend/          Serveur Node.js + Fastify + WebSocket (Sprint 0+)
├── pwa/              App tablette — SvelteKit PWA (Sprint 1+)
├── android/          Apps Android TV — Kotlin + Compose (Sprint 3+)
├── prototypes/       Spikes et preuves de concept
│   └── timer-sync/   PoC validant la synchronisation multi-écrans
└── docs/
    ├── spec.docx     Spécification technique détaillée
    └── adr/          Architecture Decision Records
```

## Stack technique

| Composante | Stack |
|------------|-------|
| Backend | Node.js 20 + Fastify 5 + WebSocket, PostgreSQL via Prisma |
| Tablette | PWA SvelteKit + Tailwind |
| TV | Android (Kotlin) + Jetpack Compose for TV + Media3/ExoPlayer |
| Stockage vidéo | FS local (MVP) → MinIO S3-compatible plus tard |
| Hébergement | LXC Debian 12 sur Proxmox |

## Démarrage rapide

### Prérequis

- Node.js 20+ (`nvm use` si tu as nvm)
- Docker + Docker Compose
- Git

### Premier setup

```bash
# Installation des dépendances JS
npm install

# Copier le fichier d'env et l'ajuster si besoin
cp .env.example .env

# Démarrer les services de dev (Postgres, MinIO, Redis, Adminer)
npm run services:up
```

Les services exposent :

| Service | URL | Usage |
|---------|-----|-------|
| PostgreSQL | `localhost:5432` | Base de données |
| MinIO API | `localhost:9000` | Stockage vidéo (S3) |
| MinIO Console | http://localhost:9001 | UI web de MinIO |
| Adminer | http://localhost:8080 | UI web de la DB |
| Redis | `localhost:6379` | File de jobs |

### Backend

```bash
cd backend
npm run dev
# → http://localhost:3000/health
```

### Prototype timer sync (validé)

```bash
cd prototypes/timer-sync
npm install
npm start
# → http://localhost:3000
```

### PWA (à venir au Sprint 1)

```bash
cd pwa
# instructions à venir
```

## Documentation

- [Spécification technique complète](docs/spec.docx)
- [Architecture Decision Records](docs/adr/)

## Licence

Privé — usage personnel pour l'instant.
