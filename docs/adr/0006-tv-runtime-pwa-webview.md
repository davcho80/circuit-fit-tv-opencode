# ADR 0006 — TV runtime PWA + Android WebView

## Status

Accepted

## Context

The TV experience originally existed in two places: a native Android TV UI and the SvelteKit PWA TV routes. That duplicates pairing, display roles, session rendering, reconnect logic, offline behavior, and future Circuit V2 features.

## Decision

The PWA is the single TV runtime. Android TV is a thin WebView wrapper that loads `/tv` and provides only platform concerns:

- fullscreen/kiosk-style window flags;
- keep-screen-on behavior;
- WebView JavaScript, DOM storage, cache, media playback;
- build-time target URL via `-PcfitvTvUrl=https://.../tv`.

Pairing, `displayId`, TV device secret, station/central/schedule routing, whiteboard, session state, offline cache, and reconnect behavior stay in the PWA/backend contract.

## Consequences

New TV features ship once in SvelteKit and are available in browser, installed PWA, and Android WebView. The Android app no longer contains workout UI, WebSocket protocol handling, QR setup, or station rendering logic.

For local development, the default Android URL is `http://10.0.2.2:3000/tv`. For a gym LAN build, pass the production URL:

```bash
./gradlew :app:assembleDebug -PcfitvTvUrl=http://192.168.1.50:3000/tv
```

Field validation still needs a real TV/WebView device to verify kiosk behavior, LAN reachability, and long-running cache behavior.

