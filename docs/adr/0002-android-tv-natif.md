# 0002 — Applications TV : Android natif (Kotlin + Compose for TV + Media3)

- **Date :** 2026-04-23
- **Statut :** Accepté
- **Décideurs :** David

## Contexte

Chaque station physique dans l'espace d'entraînement est équipée d'une TV (type Chromecast with Google TV, NVIDIA Shield, Onn 4K Pro ou équivalent). Ces écrans doivent :

1. Afficher une vidéo d'exercice en boucle parfaite (sans glitch visible au moment du loop)
2. Afficher un timer synchronisé avec les autres TV (dérive < 100 ms)
3. Se connecter au backend via WebSocket et survivre aux micro-coupures réseau
4. Afficher un QR code d'appairage au premier démarrage
5. Supporter un mode « station » et un mode « central » (dashboard global)
6. Fonctionner de manière fiable en kiosque — zéro interaction, toujours allumé

## Alternatives envisagées

### Option A — PWA en mode kiosque sur le navigateur Android TV

Avantages :
- Développement beaucoup plus rapide, hot reload, stack unifiée (JS/TS partout)
- Pas de distribution APK, pas de signature, pas de gestion de version
- Mises à jour instantanées (changer le code serveur = toutes les TV suivent)

Inconvénients :
- Les Chromecast with Google TV HD et certains appareils bas de gamme ont Chrome/WebView aux performances variables
- Lecture vidéo HTML5 sur ces devices : le décodage hardware n'est pas garanti, et les transitions de loop ont régulièrement un flash visible
- Wake lock et auto-restart peu fiables sur Chrome Android TV
- Pas de vrai kiosk mode natif sans application supplémentaire

### Option B — Flutter

Avantages :
- Single codebase pour Android TV + iOS/iPad (tablette potentiellement)
- UI performante

Inconvénients :
- Support Android TV officiel limité (pas de widgets Leanback, pas de D-pad navigation fluide out-of-the-box)
- Intégration vidéo via plugin tiers, moins stable que Media3 natif
- Écosystème plus petit, moins d'exemples spécifiques TV

### Option C — React Native

Mêmes inconvénients que Flutter pour Android TV, avec en plus une communauté TV encore plus restreinte.

### Option D — Android natif : Kotlin + Jetpack Compose for TV + Media3/ExoPlayer (retenue)

Avantages :
- **ExoPlayer via Media3** : décodage vidéo hardware, lecture en boucle via `Player.REPEAT_MODE_ONE` sans transition visible, gestion des codecs H.264/H.265/VP9
- **Jetpack Compose for TV** : UI déclarative moderne, bonne performance, support D-pad si besoin
- **OkHttp WebSocket** : fiable, reconnexion configurable, même bibliothèque que le reste de l'écosystème Android
- **Contrôle total** sur le wake lock, le kiosque, les permissions, le démarrage auto
- **Room** pour un cache local résilient (dernier état connu si déconnexion prolongée)
- Une seule APK pour les deux rôles (station + central), choix du mode via écran de pairing

Inconvénients :
- Développement plus lent que PWA (Gradle, émulateur, signature, installation)
- Kotlin à maintenir en plus de TS côté serveur et PWA (mais Kotlin est familier et agréable)
- Distribution par sideloading ADB au début (acceptable pour 5-10 TV)

## Décision

On développe **une seule APK Android** en Kotlin avec Jetpack Compose for TV, utilisant Media3/ExoPlayer pour la vidéo et OkHttp pour le WebSocket. L'APK supporte deux rôles sélectionnés au premier démarrage : station ou central.

Distribution pour le prototype : sideloading via ADB ou URL de téléchargement direct. Plus tard, envisager Fully Kiosk ou une solution MDM légère si le nombre de TV augmente.

## Conséquences

### Positives
- Expérience utilisateur fluide, kiosque fiable, pas de problème de loop vidéo
- Média3 est la lib Google officielle à jour (remplace l'ancienne `com.google.android.exoplayer2` qui traîne encore dans beaucoup d'exemples obsolètes en ligne)
- Possibilité d'enrichir plus tard avec des fonctionnalités natives (capteurs, Cast, notifications, etc.)

### Négatives / risques acceptés
- Courbe d'apprentissage Compose for TV (API récente, peu de ressources par rapport à Compose mobile)
- Le pattern Compose + ExoPlayer passe souvent par `AndroidView` + `PlayerView` — acceptable, documenté dans la doc officielle
- Temps de dev du Sprint 3 estimé à 2 semaines (plus long que les autres sprints)

### Points d'attention pour la suite
- Tester tôt sur le matériel réel (Chromecast with Google TV 4K ou équivalent), pas seulement sur l'émulateur
- Prévoir un mécanisme de mise à jour de l'APK (URL de téléchargement ou MDM) dès que le nombre de TV dépasse 3
- Mesurer la dérive timer sur appareils réels après chaque session de dev significatif

## Notes

- Doc Media3 officielle vérifiée via Context7 (2026-04-23) : dépendances `androidx.media3:media3-exoplayer:1.9.3`
- Pour l'intégration Compose, pattern actuel : `AndroidView` + `PlayerView`. L'intégration Compose pure a des limitations connues.
- Le PoC timer sync (`prototypes/timer-sync/`) a été développé en web pour valider la logique serveur ; les clients Android réutiliseront la même logique de clock sync NTP-like.
