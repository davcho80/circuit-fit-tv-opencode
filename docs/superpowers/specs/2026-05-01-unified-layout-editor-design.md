# Unified Layout Editor Design

## Goal

Unify the circuit room layout editor so coaches can move stations and create rotation arrows in the same canvas. The arrow direction must be explicit, easy to correct, saved with the circuit, and rendered the same way on the central TV during rest/rotation animation.

## User Experience

The plan editor uses a single canvas. Dragging a station always moves it. Creating a link uses click order: click the departure station, then click the destination station. This creates a directed arrow from departure to destination.

Existing links can be selected directly from the canvas. A selected link shows a small action panel with:

- `Inverser`: swaps `from` and `to`.
- `Supprimer`: removes only that link.

This keeps the fast creation behavior while making mistakes easy to fix without deleting and recreating a line.

## Data Model

The existing `layoutLinks` shape remains compatible:

```ts
type LayoutLink = {
  from: string;
  to: string;
};
```

The direction is represented by `from -> to`. Existing circuits continue to work because the current links already use this structure. No database migration is required unless a future version adds metadata such as labels or colors.

## Frontend Components

`LayoutEditor.svelte` should replace the separate move/link mode UX with one unified editing surface:

- Stations remain draggable at all times.
- Clicking a station starts or completes a directed link.
- Clicking a rendered link selects it.
- Selected link controls appear outside or beside the canvas.
- Reset positions and clear all links remain available.

The UI should make the selected departure station visually clear while creating a link.

## Central TV Rendering

The central TV must read the saved `layoutLinks` direction exactly:

- `from` is the tail.
- `to` is the arrow head.
- During rest time, all station pods blink together for group-class movement.
- All arrows in the saved layout animate with the same emphasis; no single participant-focused arrow.

If a circuit has no manual `layoutLinks`, the central TV can keep its current fallback behavior.

## Error Handling

The editor should prevent duplicate links with the same direction. If the reverse link exists, creating the opposite direction should either select the existing reverse link for inversion or replace it with the new direction; implementation should choose the simplest behavior that avoids two opposing arrows between the same stations unless the user explicitly creates them in a future feature.

Links pointing to missing stations should be ignored in rendering and omitted on the next save.

## Testing

Validation should include:

- Typecheck for PWA and backend/shared if touched.
- Targeted lint for changed files.
- Manual browser check that a station can be dragged and a directed link can be created, selected, inverted, deleted, and saved.
- Central TV check that the arrow direction matches the saved link direction during rest animation.
