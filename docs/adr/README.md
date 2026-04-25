# Architecture Decision Records

Journal des décisions architecturales importantes. Chaque ADR capture une décision à un moment donné, avec son contexte, les alternatives envisagées et les conséquences assumées.

## Pourquoi des ADR ?

Dans quelques mois, je ne me souviendrai plus pourquoi j'ai choisi Fastify plutôt qu'Express, ou Kotlin plutôt que Flutter. Les ADR existent pour capturer le *pourquoi*, pas juste le *quoi*. C'est un outil pour le futur-moi (et pour toute personne qui reprendrait le projet).

## Convention

- Un ADR par décision significative
- Fichier nommé `NNNN-titre-court.md`
- Statut : `Proposé`, `Accepté`, `Déprécié`, `Remplacé par ADR-XXXX`
- Une décision n'est jamais modifiée rétroactivement : si elle évolue, on crée un nouvel ADR qui marque l'ancien comme `Remplacé par`

## Comment en ajouter un

1. Copier `TEMPLATE.md` vers `NNNN-titre.md` (incrémenter NNNN)
2. Remplir les sections
3. Mettre à jour l'index ci-dessous
4. Committer avec un message du style `docs(adr): add NNNN about X`

## Index

| N°   | Titre | Statut | Date |
|------|-------|--------|------|
| [0001](0001-stack-backend.md) | Stack backend : Node.js + Fastify + PostgreSQL | Accepté | 2026-04-23 |
| [0002](0002-android-tv-natif.md) | Apps TV : Android natif (Kotlin + Compose + Media3) | Accepté | 2026-04-23 |
| [0003](0003-tablette-pwa-sveltekit.md) | Tablette coach : PWA SvelteKit | Accepté | 2026-04-23 |
| [0004](0004-dev-environment.md) | Environnement de dev : monorepo npm + Docker Compose | Accepté | 2026-04-24 |
