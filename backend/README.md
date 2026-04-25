# Backend

Serveur central de Circuit Fit TV : API REST + WebSocket + orchestration de sessions.

## Stack

- Node.js 20 + TypeScript
- Fastify 5 + `@fastify/websocket`
- Prisma + PostgreSQL
- Zod (via `@cfitv/shared`) pour la validation et le typage
- FFmpeg pour le transcodage vidéo (sous-processus)

## Installation (première fois)

```bash
# Depuis la racine du monorepo
npm install

# Démarrer les services (Postgres, MinIO, Redis, Adminer)
npm run services:up

# Se placer dans le backend
cd backend
npm run dev
```

## Structure

```
backend/
├── src/
│   ├── server.ts          ← point d'entrée
│   ├── config.ts          ← variables d'env typées
│   ├── routes/            ← routes REST
│   ├── ws/                ← WebSocket (hub, handlers, clock)
│   ├── sessions/          ← orchestrateur de sessions
│   ├── exercises/         ← logique d'upload et transcodage
│   └── circuits/          ← CRUD circuits
├── prisma/
│   └── schema.prisma      ← source de vérité DB
├── eslint.config.js
├── tsconfig.json
└── package.json
```

> La structure interne sera remplie au **Sprint 0**. Pour l'instant, `src/` contient uniquement un hello world qui valide la chaîne TypeScript → Fastify → build.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Mode dev avec hot reload (tsx watch) |
| `npm run build` | Compile TS → JS dans `dist/` |
| `npm start` | Lance le serveur compilé (mode prod) |
| `npm run typecheck` | Vérifie les types sans émettre |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Variables d'environnement

Voir `.env.example` à la racine du monorepo.
