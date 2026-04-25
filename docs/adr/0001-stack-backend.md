# 0001 — Stack backend : Node.js + Fastify + PostgreSQL

- **Date :** 2026-04-23
- **Statut :** Accepté
- **Décideurs :** David

## Contexte

Le projet Circuit Fit TV a besoin d'un serveur central qui :

1. Expose une API REST (CRUD exercices, circuits, displays, sessions)
2. Diffuse des messages temps réel via WebSocket à plusieurs TV simultanément
3. Stocke et sert des fichiers vidéo aux écrans Android TV
4. Orchestre le déroulé temporel d'une session d'entraînement (phases, timers, transitions)
5. Tourne dans un LXC léger sur Proxmox, avec une empreinte mémoire raisonnable

La synchronisation multi-écrans à moins de 100 ms de dérive est le point critique — le backend est responsable de diffuser des timestamps absolus de fin de phase, les clients calculent localement leur temps restant.

## Alternatives envisagées

### Option A — Node.js + Express + Socket.IO + MongoDB

Avantages :
- Écosystème ultra-mature, documentation abondante
- Socket.IO gère la reconnexion et les fallbacks automatiquement
- MongoDB flexible pour prototyper

Inconvénients :
- Express est plus lent que les alternatives modernes
- Socket.IO ajoute un protocole custom par-dessus WebSocket (overhead, moins interopérable avec des clients natifs comme OkHttp côté Android)
- MongoDB mal adapté aux relations (circuits ↔ stations ↔ exercices forment un graphe relationnel classique)

### Option B — Python + FastAPI + WebSocket + PostgreSQL

Avantages :
- FastAPI est excellent pour les APIs REST, typage Pydantic fort
- Familier pour beaucoup de développeurs

Inconvénients :
- Python + asyncio + WebSocket demande plus de vigilance que Node sur la concurrence
- Charger FFmpeg en sous-processus depuis Python est moins fluide qu'en Node
- Deux runtimes à gérer (Python backend + Node pour PWA/tooling) au lieu d'un seul

### Option C — Go + Fiber + WebSocket + PostgreSQL

Avantages :
- Performance brute excellente
- Binaire unique, déploiement trivial

Inconvénients :
- Vélocité de dev plus lente pour un prototype (pas de hot reload natif confortable)
- Écosystème moins riche pour l'intégration FFmpeg et le tooling JS/TS
- Courbe d'apprentissage plus raide si besoin de pivoter vite

### Option D — Node.js + Fastify + WebSocket natif + PostgreSQL via Prisma (retenue)

Avantages :
- Fastify est plus rapide qu'Express, avec une API plus propre et un support WebSocket de première classe via `@fastify/websocket`
- WebSocket natif (pas de couche Socket.IO) = compatibilité directe avec OkHttp Android et le WebSocket du navigateur, sans client spécifique
- Prisma fournit migrations versionnées, types auto-générés, excellente DX
- PostgreSQL est relationnel, robuste, et parfait pour le modèle de données du projet (exercices, circuits avec stations ordonnées, sessions)
- Un seul runtime JS pour backend + PWA = partage facile de types et utilitaires
- Validation déjà faite dans le PoC timer sync — la synchronisation fonctionne

Inconvénients :
- JavaScript/TypeScript, donc typage moins strict que Go/Rust (mitigé par TS + Prisma)
- Gestion manuelle de la reconnexion WebSocket (pas de Socket.IO) — code déjà écrit dans le PoC

## Décision

On utilise **Node.js 20 + Fastify 5 + `@fastify/websocket` + PostgreSQL via Prisma** pour le backend, déployé en LXC Debian 12 sur Proxmox.

Pour le V1 prototype, SQLite peut remplacer PostgreSQL pour aller plus vite (Prisma supporte les deux avec un changement de datasource). Migration PostgreSQL à partir du Sprint 1 dès que les données commencent à compter.

FFmpeg est invoqué en sous-processus via `node:child_process` pour le transcodage des vidéos uploadées.

## Conséquences

### Positives
- Stack unique (JS/TS) côté serveur et côté PWA tablette : réutilisation du code, un seul écosystème à maintenir
- WebSocket natif garantit l'interopérabilité avec Android (OkHttp) et navigateurs sans client spécifique
- Le PoC timer sync a déjà prouvé que la fondation fonctionne

### Négatives / risques acceptés
- Si un jour on veut du multi-tenant avec haute charge (milliers de connexions WS simultanées), Node atteindra ses limites avant Go/Rust. Pour le prototype et même une V1 commerciale modeste, c'est largement suffisant.
- Le typage TS demande discipline pour ne pas dériver en `any`.

### Points d'attention pour la suite
- Mettre en place ESLint + TypeScript strict dès le Sprint 0
- Configurer Prisma avec une stratégie de migration propre (pas de `db push` en prod)
- Documenter les formats de messages WebSocket dans un seul fichier partagé entre serveur et clients

## Notes

- Le PoC dans `prototypes/timer-sync/` utilise déjà cette stack (sans Prisma, sans DB pour le PoC) et a validé la synchronisation temps réel.
- Voir aussi ADR-0002 (stratégie Android TV) et ADR-0003 (stratégie tablette).
