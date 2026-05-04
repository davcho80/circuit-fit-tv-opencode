# Rotation par boucles hybrides

## Objectif

Ajouter un mode de rotation pour les cours de groupe ou plusieurs sous-groupes travaillent en parallele dans des boucles de stations. Exemple cible: 9 stations, 3 boucles de 3 stations, 3 personnes ou groupes par boucle, 3 tours dans chaque boucle, puis changement simultane vers la boucle suivante. La derniere boucle revient a la premiere. Le coach peut aussi demander 2 cycles complets de toutes les boucles.

Ce mode doit rester compatible avec les circuits classiques existants.

## Vocabulaire

- **Boucle**: groupe ordonne de stations, par exemple stations 1, 2, 3.
- **Tour par boucle**: nombre de fois que le groupe repete les stations de sa boucle avant de changer de boucle.
- **Cycle complet**: passage de chaque groupe dans toutes les boucles.
- **Switch de boucle**: moment ou tous les groupes changent de boucle en meme temps.

## Configuration coach

Le Circuit Builder ajoute un mode de rotation:

- `Classique`: comportement actuel.
- `Boucles`: active la configuration hybride.

Quand `Boucles` est actif, le coach configure:

- **Taille des boucles**: nombre de stations par boucle. Exemple: 3.
- **Tours par boucle**: nombre de repetitions internes avant de changer de boucle. Exemple: 3.
- **Cycles complets**: nombre de fois ou chaque groupe doit passer toutes les boucles. Exemple: 1 ou 2.

Le builder cree automatiquement les boucles par ordre de station:

- 9 stations avec taille 3 donne A = 1-2-3, B = 4-5-6, C = 7-8-9.
- Si le nombre de stations ne se divise pas egalement, le builder affiche une erreur claire et demande de modifier la taille ou le nombre de stations pour cette premiere version.

## Plan de salle

Le plan de salle devient l'endroit ou le coach peut verifier et ajuster la rotation:

- Chaque station affiche sa boucle, par exemple A, B, C.
- Les liens internes representent le sens de rotation dans une boucle.
- Les liens de switch representent le passage d'une boucle a la suivante: A vers B, B vers C, C vers A.
- Le mode automatique cree les liens internes et les liens de switch, mais le coach peut modifier les fleches si le layout physique du gym demande une autre direction.

Pour garder la premiere implementation stable, la composition des boucles est derivee de l'ordre des stations et de la taille de boucle. L'edition manuelle de la composition des boucles pourra venir ensuite si necessaire.

## Modele de donnees

Ajouter `LOOPS` a `RotationMode`.

Ajouter un champ JSON `rotationPlan` sur `Circuit`. Forme recommandee:

```json
{
  "mode": "LOOPS",
  "loopSize": 3,
  "lapsPerLoop": 3,
  "fullCycles": 1,
  "loops": [
    { "id": "A", "stationIds": ["station-1", "station-2", "station-3"] },
    { "id": "B", "stationIds": ["station-4", "station-5", "station-6"] },
    { "id": "C", "stationIds": ["station-7", "station-8", "station-9"] }
  ],
  "internalLinks": [
    { "from": "station-1", "to": "station-2", "loopId": "A" }
  ],
  "switchLinks": [
    { "fromLoopId": "A", "toLoopId": "B" },
    { "fromLoopId": "B", "toLoopId": "C" },
    { "fromLoopId": "C", "toLoopId": "A" }
  ]
}
```

`layoutLinks` reste disponible pour les circuits classiques et pour l'affichage visuel. Le `rotationPlan` devient la source de verite metier lorsque `rotationMode = LOOPS`.

## Generation des phases

Le moteur de session doit generer des phases a partir du plan de rotation.

Pour chaque cycle complet:

1. Pour chaque affectation de boucle:
   - Tous les groupes travaillent dans leur boucle courante.
   - Ils font `lapsPerLoop` tours des stations de cette boucle.
2. Apres les tours internes, si toutes les boucles n'ont pas encore ete visitees dans le cycle courant:
   - Creer une phase de repos/switch de boucle.
   - Les groupes avancent vers la boucle suivante.
3. Quand chaque groupe a visite toutes les boucles:
   - Le cycle complet est termine.
   - Si `fullCycles` est plus grand, recommencer un nouveau cycle complet.

Le temps de repos existant (`restSec`) sert aussi de temps de deplacement. Il n'y a pas de nouveau `transitionSec` a utiliser pour ce mode.

## Metadonnees de session

Les messages WebSocket de session ajoutent des metadonnees optionnelles:

- `rotationMode`
- `loopId`
- `loopIndex`
- `totalLoops`
- `loopLap`
- `totalLoopLaps`
- `cycleIndex`
- `totalCycles`
- `isLoopSwitch`

Ces champs sont optionnels pour ne pas casser les ecrans existants. Les circuits classiques continuent d'utiliser `round`, `totalRounds` et `stationIdx`.

## TV centrale

Pendant un repos normal dans une boucle:

- Toutes les stations de toutes les boucles blinkent comme un cours de groupe.
- Les fleches internes des boucles sont mises en evidence.

Pendant un switch de boucle:

- Les fleches internes deviennent secondaires.
- Les liens de switch A -> B, B -> C, C -> A deviennent les fleches principales.
- Le panneau de statut affiche `Changement de boucle`.
- Le libelle indique les progressions utiles, par exemple `Cycle 1/2`, `Boucle 2/3`, `Tour 3/3`.

## Ecrans station

Les ecrans station continuent d'afficher leur station physique. Dans le mode boucles, le contenu de chaque station ne change pas selon le groupe: c'est le groupe qui se deplace. Aucun pairing TV supplementaire n'est requis.

## Validation et erreurs

Le builder bloque la sauvegarde du mode `Boucles` si:

- il y a moins de 2 boucles;
- `stations.length % loopSize !== 0`;
- `lapsPerLoop < 1`;
- `fullCycles < 1`;
- une boucle generee est vide;
- un lien du plan pointe vers une station inexistante.

## Tests

Ajouter des tests backend pour:

- generation classique inchangee;
- generation avec 9 stations, taille 3, 3 tours par boucle, 1 cycle;
- generation avec 9 stations, taille 3, 3 tours par boucle, 2 cycles;
- validation d'une taille de boucle incompatible;
- presence des metadonnees `isLoopSwitch`, `loopLap`, `cycleIndex`.

Ajouter des tests frontend ou checks cibles pour:

- affichage des champs `Boucles` dans le builder;
- sauvegarde du `rotationPlan`;
- rendu des badges de boucle dans le plan de salle;
- rendu TV central des fleches internes et des fleches de switch.

## Hors scope initial

- Edition manuelle complete de la composition des boucles par drag-and-drop.
- Affectation individuelle des participants.
- Temps differents par boucle.
- Nombre de stations variable par boucle.
