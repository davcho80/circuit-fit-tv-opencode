# Deploiement production locale

Cette procedure vise un serveur local de gym: mini-PC, VM Proxmox ou LXC Debian avec Docker. Le backend utilise le reseau host pour publier `_cfitv._tcp` en mDNS sur le LAN.

## Demarrage

```bash
cp .env.production.example .env.production
$EDITOR .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

Un assistant CLI peut aussi generer `.env.production` avec des questions et des secrets aleatoires:

```bash
npm run prod:setup
```

Si `.env.production` existe deja, la commande refuse de l'ecraser. Utiliser `npm run prod:setup -- --force` pour regenerer le fichier volontairement.

Le service `migrate` applique automatiquement `prisma migrate deploy` avant le demarrage du backend. Pour relancer les migrations manuellement apres une intervention:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
```

Verification sante apres demarrage:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl http://<SERVER_LAN_IP>:3000/health
```

La duree de session coach/admin est controlee par `JWT_EXPIRES_IN` dans `.env.production`. Garder une duree courte si la tablette est partagee, et documenter la valeur choisie pour le gym.

## Ports et firewall

| Port | Exposition | Usage |
|------|------------|-------|
| TCP 3000 | LAN | Backend, PWA, WebSocket |
| UDP 5353 | LAN | mDNS `_cfitv._tcp` |
| TCP 9000 | LAN | Medias MinIO servis aux navigateurs/TV |
| TCP 9001 | localhost | Console MinIO |
| TCP 5432 | localhost | PostgreSQL |
| TCP 6379 | localhost | Redis |

Ouvrir au minimum TCP 3000, TCP 9000 et UDP 5353 sur le firewall du serveur. Garder PostgreSQL, Redis et la console MinIO limites a `127.0.0.1`.

## mDNS

Le backend publie `_cfitv._tcp` quand `MDNS_ENABLED=true`. Le choix `network_mode: host` evite le probleme classique ou le multicast mDNS reste bloque dans le bridge Docker.

Tests terrain:

```bash
dns-sd -B _cfitv._tcp local
dns-sd -L "Circuit Fit TV" _cfitv._tcp local
avahi-browse -rt _cfitv._tcp
curl http://<SERVER_LAN_IP>:3000/health
```

Risque de `network_mode: host`: le conteneur backend partage la pile reseau de l'hote. Il faut donc eviter d'y lancer d'autres services inutiles, garder les secrets forts, et limiter les ports ouverts par le firewall.

## Backups PostgreSQL

Demarrer les backups automatiques:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production --profile backup up -d postgres-backup
```

Les dumps compresses sont ecrits dans `backups/postgres/` et conserves selon `BACKUP_RETENTION_DAYS`.

Backup manuel:

```bash
npm run prod:backup
```

Restore sur une base vide:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production stop backend
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \
  sh -lc 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \
  sh -lc 'createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/postgres/cfitv-YYYYMMDD-HHMMSS.dump
docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend
```

Tester un restore au moins une fois avant d'utiliser le systeme en production reelle.
