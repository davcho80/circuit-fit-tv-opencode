# ADR 0005 — Circuit V2 phases

## Status

Accepted

## Context

Circuit V1 supports timed station work, rest, transitions, scheduled hydration breaks, and station-level reps mode. Circuit V2 needs to represent a fuller class plan without breaking existing circuits:

- optional warmup before station rounds;
- optional cooldown after station rounds;
- coach notes for the class whiteboard;
- a whiteboard toggle for central TV pre-class display;
- room to evolve toward richer warmup/cooldown exercise blocks later.

## Decision

Keep the first Circuit V2 step on the `Circuit` aggregate:

- `warmupSec` and `cooldownSec` are scalar durations with default `0`;
- `coachNotes` stores class-facing coaching notes;
- `whiteboardEnabled` controls whether the central display can show the pre-class board;
- `PhaseType` now includes `WARMUP` and `COOLDOWN`;
- phase planning is extracted to a pure `phase-plan` module so timing behavior is testable without booting the database or WebSocket server.

This keeps old `TIME` circuits valid and avoids creating a second plan model before there is a real need for day-specific overrides.

## Consequences

Existing circuits migrate safely with no warmup/cooldown and the same station timing. New circuits can add start/end phases immediately. A later iteration can introduce occurrence-level `SessionPlan` or schedule overrides for day-to-day coach notes without rewriting the phase planner.

