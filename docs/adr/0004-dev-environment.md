# 0004 — Environnement de développement : monorepo npm + Docker Compose

- **Date :** 2026-04-24
- **Statut :** Accepté
- **Décideurs :** David

## Contexte

Le projet comporte plusieurs composantes développées en parallèle :
- Le backend Node.js/TypeScript
- La PWA SvelteKit (tablette coach)
- L'app Android (Kotlin, isolée techniquement)
- Des schémas et types de données qu'il faut **absolument** garder synchronisés entre backend et PWA (formats de messages WebSocket, validation des payloads API)

Il faut aussi une manière simple et reproductible de lancer les dépendances d'infrastructure (PostgreSQL, MinIO, Redis) sans polluer la machine de développement avec des installations locales.

Enfin, le backend devra être déployé dans un LXC Proxmox à terme — il faut prévoir le packaging en conteneur dès maintenant pour ne pas avoir de surprise au Sprint 6.

## Alternatives envisagées

### Option A — Repos Git séparés (backend, pwa, android, shared)

Avantages :
- Découplage total, possibilité d'open-sourcer un morceau indépendamment
- Cycles CI/CD séparés

Inconvénients :
- **Synchronisation des types entre backend et PWA pénible** : il faut publier `@cfitv/shared` sur un registre privé ou utiliser des git submodules
- Pull requests cross-repo difficiles à suivre
- Pour un prototype solo, overhead énorme et aucun gain

### Option B — Monorepo avec outillage lourd (Nx, Turborepo)

Avantages :
- Cache de build intelligent, parallélisation, task graph
- Très bien pour les gros monorepos (dizaines de packages)

Inconvénients :
- Courbe d'apprentissage
- Pas de gain réel pour 3 packages (backend, pwa, shared)
- Dépendance supplémentaire à apprendre et maintenir

### Option C — Monorepo avec npm workspaces natif (retenue)

Avantages :
- **Natif npm**, aucune dépendance tierce
- `npm install` à la racine installe tout
- Symlinks automatiques entre packages (`@cfitv/shared` est directement résolvable depuis le backend)
- Suffisant pour notre taille (3 packages JS + 1 package Kotlin isolé)
- Scripts globaux via `npm run <cmd> --workspaces`

Inconvénients :
- Pas de cache de build intelligent (on s'en passe à cette échelle)
- Si le projet grossit à 10+ packages, il faudra migrer vers Turborepo (coût négligeable, la structure est la même)

### Dépendances de dev : locales vs Docker

Installer Postgres, MinIO, Redis directement sur la machine pose plusieurs problèmes : versions différentes selon les devs, pollution du système, processus orphelins. Utiliser **Docker Compose** résout tout ça : un `docker compose up -d` et tout est là, versions figées, isolé.

Le backend lui-même tourne **en local** pendant le dev (hot reload via `tsx watch`), et se connecte aux services du compose via `localhost`. En production (LXC), on utilisera le Dockerfile multi-stage pour packager le backend.

## Décision

**Monorepo npm workspaces** avec cette structure :

```
circuit-fit-tv/
├── package.json           (racine, workspaces)
├── docker-compose.yml     (services de dev)
├── .env.example           (variables à copier vers .env)
├── packages/
│   └── shared/            (types Zod, messages WS, modèles)
├── backend/               (Fastify + Prisma)
├── pwa/                   (SvelteKit, au Sprint 1+)
└── android/               (Kotlin, géré séparément via Gradle)
```

**Docker Compose** fournit : PostgreSQL 16, MinIO (S3), Redis, Adminer. Lancé via `npm run services:up`.

**Backend dockerisé** via un Dockerfile multi-stage (deps → build → runtime) qui intègre FFmpeg, pour déploiement LXC au Sprint 6.

**Tooling TypeScript** : strict activé, ESLint flat config, Prettier, éditorconfig, `.nvmrc`.

## Conséquences

### Positives
- Une seule commande `npm install` configure tout l'environnement JS
- Les types partagés sont naturellement cohérents : si je change un schéma Zod dans `@cfitv/shared`, le backend et la PWA refusent de compiler tant que les deux ne sont pas mis à jour
- Les devs peuvent cloner, `npm install`, `npm run services:up`, `npm run dev` et coder en 2 minutes
- Le Dockerfile prod est isolé et reproductible

### Négatives / risques acceptés
- npm workspaces a parfois des comportements surprenants avec les peer deps (mitigé en préférant des deps directes quand possible)
- Le module Android est géré par Gradle et ignoré par npm : il faudra peut-être un `Makefile` ou un `justfile` racine si on veut orchestrer Kotlin + JS dans une seule commande (pas urgent)

### Points d'attention pour la suite
- Au moindre signe d'amélioration nécessaire (cache de build, task graph complexe), envisager Turborepo
- Si un futur contributeur vient de l'écosystème pnpm/yarn, documenter clairement que le projet utilise npm workspaces
- Le schéma Prisma et les modèles Zod dans `packages/shared/src/models.ts` doivent rester cohérents — envisager une génération automatique de l'un depuis l'autre au Sprint 1 si la divergence commence à coûter

## Notes

- Version Zod retenue : **4.x** (import `import { z } from 'zod'`)
- Version Node retenue : **20 LTS** (verrouillée via `.nvmrc`)
- Les ports par défaut sont configurables via `.env` pour éviter les conflits si plusieurs projets coexistent sur la même machine
- Adminer est exposé sur `http://localhost:8080` pour inspecter la base facilement en dev
- MinIO console sur `http://localhost:9001` (API S3 sur 9000)
