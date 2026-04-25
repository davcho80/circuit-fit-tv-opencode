# 0003 — Tablette coach : Progressive Web App (SvelteKit)

- **Date :** 2026-04-23
- **Statut :** Accepté
- **Décideurs :** David

## Contexte

La tablette du coach est l'interface principale de contrôle : gestion de la bibliothèque d'exercices, construction des circuits, pilotage live des sessions. Elle doit :

1. Fonctionner sur tablette Android (possiblement iPad à terme)
2. Être confortable en usage tactile, avec une ergonomie pensée pour un usage en studio
3. Se connecter au backend en REST et WebSocket
4. Permettre l'upload de vidéos d'exercices avec barre de progression
5. Rester responsive en cours de session live (pas de freeze, pas de latence perçue)

Le projet est un prototype : la vélocité de développement et la capacité à itérer rapidement priment sur le polish d'une app native.

## Alternatives envisagées

### Option A — App Android native (Kotlin + Jetpack Compose)

Avantages :
- Performance maximale, intégration système complète
- Cohérent avec la stack Android TV

Inconvénients :
- Temps de dev significativement plus long (cycles Gradle, émulateur, signature, Play Store si distribution publique)
- Pas testable sur iPad ni sur laptop
- Chaque itération UI demande rebuild complet

### Option B — Application multi-plateforme (Flutter ou React Native)

Avantages :
- Single codebase, Android + iOS

Inconvénients :
- Stack en plus à maintenir (Dart ou bundler RN)
- Pas de gain net par rapport à une PWA pour ce use case
- Tooling lourd pour un prototype

### Option C — PWA React + Vite + Tailwind

Avantages :
- Écosystème React ultra-mature
- Beaucoup d'exemples et composants disponibles

Inconvénients :
- Bundle plus lourd que Svelte
- Plus de boilerplate (hooks, state management)
- Tendance à la sur-ingénierie pour un prototype

### Option D — PWA SvelteKit + Tailwind (retenue)

Avantages :
- Meilleur compromis taille de bundle / performance / simplicité
- Syntaxe concise, courbe d'apprentissage rapide
- SvelteKit fournit routing, SSR optionnel, endpoints serveur si besoin
- PWA : installable sur tablette en un tap via Chrome (« Ajouter à l'écran d'accueil »), comportement quasi-natif
- Testable directement sur laptop pendant le dev, puis sur tablette via le réseau local
- Si besoin un jour d'une version Play Store, Capacitor emballe la PWA en APK en quelques heures

Inconvénients :
- Écosystème plus petit que React, moins de composants UI tout faits
- Quelques changements majeurs récents (runes, form actions) à bien suivre — mitigé via Context7

## Décision

On développe la tablette coach comme une **PWA SvelteKit + Tailwind CSS**, hébergée sur le même LXC que le backend (ou servie directement par Fastify pour le MVP).

L'installation sur la tablette se fait via le navigateur Chrome (prompt d'installation automatique une fois les critères PWA remplis : manifest, service worker, HTTPS via Caddy).

## Conséquences

### Positives
- Itération ultra-rapide : hot reload, debug dans les devtools du navigateur
- Un seul écosystème (TS/JS) entre backend, PoC et tablette — partage potentiel de types via un package commun dès que le projet grandit
- Multi-plateforme gratuit : le coach peut piloter depuis iPad, tablette Android, laptop, même son téléphone en dépannage

### Négatives / risques acceptés
- Performance légèrement inférieure à du natif (négligeable pour une UI de contrôle)
- Nécessite HTTPS pour profiter de toutes les capacités PWA (wake lock, install prompt, notifications) — acceptable via Caddy
- Pas d'accès à certaines APIs natives (Bluetooth low-level, etc.) — pas pertinent pour ce cas d'usage

### Points d'attention pour la suite
- Configurer le service worker dès le Sprint 1 pour que la PWA reste réactive même avec un réseau intermittent
- Bien gérer le wake lock API côté tablette pour éviter qu'elle s'éteigne en pleine session
- Tester l'installation PWA sur la tablette cible tôt (certains comportements diffèrent entre navigateurs et versions Android)

## Notes

- SvelteKit version cible : la plus récente stable au moment du Sprint 1, vérifier via Context7
- Tailwind CSS pour éviter d'écrire du CSS custom dans un prototype
- Garder l'option Capacitor en tête si un jour une version Play Store est souhaitée
