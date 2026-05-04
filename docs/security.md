# Securite production

Cette note resume l'etat de securite attendu pour un deploiement local de gym.

## Authentification

- Les routes API protegees exigent un JWT.
- Les roles WebSocket `coach` et `monitor` doivent fournir un JWT valide dans `REGISTER`.
- Les roles WebSocket `tv` restent publics au premier pairing, puis se reconnectent avec `displayId` et `tvSecret`.
- Le secret TV est genere au pairing et seul son hash SHA-256 est stocke en base.
- Les routes TV publiques (`/tv`, `/tv/central`, `/tv/schedule`, `/pair`) ne doivent pas recevoir de token coach/admin.

## Sessions coach/admin

- Les JWT expirent par defaut apres `30d`.
- La duree est configurable avec `JWT_EXPIRES_IN`.
- La PWA lit `exp`, affiche l'echeance dans le menu utilisateur et supprime le token expire.
- Sur tablette partagee, preferer une duree courte et former les coachs a utiliser `Logout`.

## Secrets

En production, le serveur refuse les secrets de developpement pour:

- `JWT_SECRET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

Generer les secrets avec `npm run prod:setup` ou une commande comme:

```bash
openssl rand -base64 48
```

## Audit admin

Les actions critiques sont journalisees dans `AuditLog`:

- login reussi/echec;
- changement de mot de passe;
- pairing TV;
- commandes session HTTP et WebSocket;
- modifications users, settings, displays;
- demarrage update systeme.

Les derniers evenements sont visibles dans Admin > Diagnostics.

## Dependances

Commandes de verification:

```bash
npm audit --omit=dev
npm outdated --workspaces --long
```

Etat au 2026-04-30:

- aucune vulnerabilite haute ou critique connue sur `npm audit --omit=dev`;
- vulnerabilite moderee restante via `prisma` -> `@prisma/dev` -> `@hono/node-server <1.19.13`;
- `npm audit fix --force` propose un downgrade cassant vers Prisma 6, non applique volontairement;
- a traiter par upgrade controle quand Prisma 7 expose une resolution propre.

## Reseau LAN

Le deploiement production utilise `network_mode: host` pour permettre mDNS `_cfitv._tcp`. Garder le firewall minimal:

- ouvrir TCP 3000 pour backend/PWA/WebSocket;
- ouvrir TCP 9000 pour medias MinIO;
- ouvrir UDP 5353 pour mDNS;
- garder PostgreSQL, Redis et la console MinIO limites a `127.0.0.1`.
