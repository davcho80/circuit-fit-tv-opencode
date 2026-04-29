# Circuit Fit TV — Backlog

## Sprint : Expérience utilisateur (inspiré CloudFit)

| # | Feature | Effort estimé | Valeur |
|---|---------|---------------|--------|
| 1 | Sons de timer | 2-3h | Impact immédiat — feedback sonore à chaque changement de phase |
| 2 | Whiteboard module | ~1 jour | Remplace le tableau blanc physique — warm-up, consignes, hydratation |
| 3 | Logs de workout | ~1 jour | Historique des séances pour les gérants (durée, phases, date) |
| 4 | Intégration Spotify | 2-3 jours | Contrôle musique depuis l'admin — gros différenciateur marché |

---

### 1. Sons de timer
- Jouer un son sur la TV Android à chaque changement de phase (WORK → REST → TRANSITION)
- Sons configurables depuis l'admin (Bell, Bleep, Gong, Boxing Bell, Countdown Beeps…)
- Sons stockés côté backend, téléchargés sur la TV
- Déclenchement via message WebSocket `SESSION_UPDATE`

### 2. Whiteboard module
- Nouveau type de phase `WHITEBOARD` dans le circuit
- Contenu : texte libre (titre + sous-titre) + timer optionnel + image de fond optionnelle
- Éditeur dans l'admin (ajout entre les phases du circuit)
- Nouveau composable Compose sur la TV (texte plein écran, grande police)
- Cas d'usage : warm-up, hydratation, consignes de mouvement, fin de cours

### 3. Logs de workout
- Enregistrer automatiquement chaque séance : date, circuit, durée réelle, nb rounds complétés
- Table `WorkoutLog` en DB (déjà une table `Session` — enrichir ou créer une vue)
- Page "Historique" dans l'admin avec filtres par date / circuit
- Export CSV optionnel

### 4. Intégration Spotify
- Auth OAuth Spotify depuis l'admin (compte instructeur)
- Choisir un device Spotify actif (enceinte du gym)
- Choisir une playlist par circuit
- Actions automatiques : play au début de WORK, pause pendant REST/TRANSITION
- Contrôles manuels depuis l'admin : play/pause/next track
- API : `https://api.spotify.com/v1/me/player/`
