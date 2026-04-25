# Instructions de setup — Première fois

> Ce fichier est temporaire. Supprime-le après le premier push réussi.

## Prérequis

- Git installé sur ton poste (`git --version`)
- Un compte GitHub
- Ta clé SSH GitHub configurée (ou tu utiliseras HTTPS + token)

## Étapes

### 1. Créer le repo sur GitHub

1. Va sur https://github.com/new
2. Nom : `circuit-fit-tv`
3. Visibilité : **Private**
4. **NE PAS** cocher « Add a README », « Add .gitignore », « Choose a license » — on a déjà tout
5. Clique « Create repository »
6. Note l'URL proposée (exemple : `git@github.com:TON_USER/circuit-fit-tv.git`)

### 2. Initialiser le repo local

Dans ton terminal, à l'endroit où tu veux garder le projet :

```bash
# Extrais l'archive que je t'ai fournie
tar xzf circuit-fit-tv-initial.tar.gz
cd circuit-fit-tv

# Init git
git init -b main

# Configure ton identité si c'est la première fois
git config user.name "Ton Nom"
git config user.email "ton.email@example.com"

# Supprime ce fichier d'instructions (il n'a pas sa place en commit)
rm SETUP.md

# Ajoute tout, premier commit
git add .
git commit -m "chore: initial project scaffold

- Repository structure with backend, pwa, android, prototypes, docs
- PoC timer sync (validated, dérive < 100ms in real conditions)
- Technical specification document
- ADRs 0001 (backend stack), 0002 (Android TV), 0003 (tablette PWA)
- .gitignore for Node, Android, editors, secrets"

# Connecte à GitHub
git remote add origin git@github.com:TON_USER/circuit-fit-tv.git
# (ou en HTTPS : https://github.com/TON_USER/circuit-fit-tv.git)

# Premier push
git push -u origin main
```

### 3. Vérifier sur GitHub

Va sur ton repo, vérifie que tu vois :
- ✓ Le README du projet s'affiche sur la page d'accueil
- ✓ Les dossiers `backend/`, `pwa/`, `android/`, `prototypes/`, `docs/`
- ✓ Le dossier `docs/adr/` avec les 3 ADR et le TEMPLATE
- ✓ Le PoC dans `prototypes/timer-sync/`

### 4. Créer les premières issues GitHub (optionnel mais recommandé)

Pour suivre les sprints, crée une issue par sprint :

- **#1 Sprint 0 — Fondations** : LXC Proxmox, backend Fastify hello world, DB Postgres, Docker Compose, WebSocket ping-pong
- **#2 Sprint 1 — Bibliothèque d'exercices** : upload vidéo, transcodage FFmpeg, thumbnails, CRUD exercice
- **#3 Sprint 2 — Circuit builder** : UI tablette pour créer, configurer, sauvegarder
- **#4 Sprint 3 — Android TV station** : APK, WebSocket, ExoPlayer loop, QR pairing, timer sync
- **#5 Sprint 4 — Orchestration live** : démarrer, transitions, pause/skip/adjust
- **#6 Sprint 5 — TV centrale** : mode dashboard, diagramme de rotation
- **#7 Sprint 6 — Polish** : animations, sons, robustesse, tests terrain

Tu peux ajouter des labels `sprint-0`, `sprint-1`, etc. pour les retrouver facilement.

### 5. Workflow ensuite

Pour chaque nouvelle fonctionnalité ou correction :

```bash
# Créer une branche
git checkout -b feat/sprint-0-fastify-hello

# Travailler, committer
git add .
git commit -m "feat(backend): initial Fastify server with ping endpoint"

# Push et créer une PR (optionnel pour un projet solo mais propre)
git push -u origin feat/sprint-0-fastify-hello
```

### Conventions de commit

Format : `<type>(<scope>): <description>`

Types utiles :
- `feat` : nouvelle fonctionnalité
- `fix` : correction de bug
- `chore` : tooling, config, housekeeping
- `docs` : documentation
- `refactor` : restructuration sans changement de comportement
- `test` : ajout ou modif de tests
- `perf` : amélioration de performance

Exemples :
- `feat(backend): add exercise upload endpoint`
- `fix(pwa): handle websocket reconnection after sleep`
- `docs(adr): add 0004 about video transcoding strategy`
- `chore(deps): bump fastify to 5.2.0`

## Si tu utilises HTTPS au lieu de SSH

Quand git te demande l'authentification :
- User : ton login GitHub
- Password : **un Personal Access Token**, pas ton mot de passe
- Pour en créer un : https://github.com/settings/tokens → « Generate new token (classic) » → scope `repo`

Tu peux aussi utiliser GitHub CLI (`gh auth login`) pour simplifier.
