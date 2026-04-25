# Circuit Fit TV — PoC Timer Sync

Proof of concept qui valide le point de risque n°1 du projet : **peut-on synchroniser un timer sur plusieurs écrans avec une dérive inférieure à 100 ms, même en conditions réseau réelles ?**

## TL;DR

- Backend Node.js + Fastify + WebSocket (un seul fichier `server.js`)
- Trois pages web : `/coach`, `/tv`, `/drift`
- Algorithme NTP-like simplifié pour synchroniser les horloges clients
- Le serveur est autoritaire : il diffuse des **timestamps absolus de fin de phase**, les clients calculent localement le temps restant

Si la dérive mesurée sur `/drift` reste sous 100 ms avec plusieurs appareils différents connectés au même WiFi, **on a validé la fondation technique du projet** et on peut attaquer le Sprint 0 en confiance.

## Lancer le PoC

### Option A : local (sur ton PC)

```bash
cd poc-timer-sync
npm install
npm start
```

Puis ouvre dans ton navigateur :

- Coach : http://localhost:3000/coach
- TV : http://localhost:3000/tv (ouvre plusieurs onglets)
- Drift : http://localhost:3000/drift

### Option B : dans un LXC Proxmox ou container Docker

```bash
# Remplacer <IP> par l'IP du container
npm install
HOST=0.0.0.0 PORT=3000 npm start
```

Ensuite, depuis n'importe quel appareil du réseau local :
- http://<IP>:3000/coach depuis ta tablette
- http://<IP>:3000/tv depuis chaque téléphone, ordi, tablette que tu as sous la main
- http://<IP>:3000/drift pour le monitoring

## Comment interpréter le verdict

Ouvre `/drift`. Tu verras une grosse valeur de **dérive max** qui s'actualise en continu.

| Valeur | Signification |
|--------|---------------|
| **< 100 ms** | ✅ Objectif atteint. Les écrans sont visuellement synchronisés. |
| **100-200 ms** | 🟡 Acceptable mais optimisable (probablement dû à la charge réseau). |
| **> 200 ms** | ❌ À investiguer (WiFi faible, device avec horloge instable, etc.). |

Le graphique montre la dérive sur 60 secondes glissantes, avec la ligne de seuil 100 ms.

## Scénarios à tester

1. **Baseline** : ouvre 3 TV sur le même PC (3 onglets). Dérive attendue : quasi 0.
2. **Multi-appareils** : ouvre une TV sur PC, une sur téléphone, une sur tablette. Dérive attendue : 20-80 ms.
3. **Coupure réseau** : sur un appareil, active le mode avion 5 secondes puis désactive. La TV doit se reconnecter automatiquement et reprendre en sync.
4. **Pause/reprise** : depuis `/coach`, met en pause au milieu d'une phase, attends 10 s, reprends. Tous les écrans doivent afficher le même temps restant qu'avant la pause.
5. **Skip** : saute des phases, tout le monde doit basculer simultanément.
6. **Ajustement** : ajoute 10s en cours de phase. Les timers doivent augmenter en même temps.

## Ce que le PoC démontre

- ✅ Architecture serveur-autoritaire : une seule source de vérité
- ✅ Clock sync NTP-like : offset calculé par burst initial puis ajustement périodique
- ✅ Reconnexion automatique avec backoff exponentiel
- ✅ Broadcast ciblé (commandes coach, télémétrie drift, mises à jour session)
- ✅ Orchestration de phases automatique côté serveur
- ✅ Résilience : la logique métier ne tourne pas sur les clients, ils peuvent tous tomber et revenir

## Ce que le PoC ne couvre pas (volontairement)

- Lecture vidéo (sera testé au Sprint 3 avec ExoPlayer sur Android TV)
- UI Android native (ici c'est juste du web pour prouver la fondation)
- Persistance en base de données (tout est en mémoire, un restart efface la session)
- Authentification (zéro)
- HTTPS (ajouter Caddy devant quand on veut)

## Structure

```
poc-timer-sync/
├── package.json
├── server.js              ← backend Fastify + WebSocket + orchestrateur
├── test-integration.js    ← test automatisé en ligne de commande
└── public/
    ├── index.html         ← page d'accueil
    ├── coach.html         ← panneau de contrôle coach
    ├── tv.html            ← simulation d'un écran de station
    ├── drift.html         ← moniteur de dérive (cœur du PoC)
    └── sync-client.js     ← lib partagée : WS + clock sync
```

## Après le PoC

Si le verdict est ✅ :
1. Archiver ce PoC dans le repo final sous `prototypes/timer-sync/`
2. Démarrer le **Sprint 0** du vrai projet (voir document de spec)
3. Réutiliser directement `sync-client.js` et les patterns du serveur
