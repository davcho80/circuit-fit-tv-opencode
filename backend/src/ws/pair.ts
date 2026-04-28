// ============================================================
// Registre en mémoire des PIN d'appairage TV
// PIN (4 chiffres) → ConnectedClient en attente de config
// ============================================================

import type { ConnectedClient } from './hub.js';

interface PendingEntry {
  client:       ConnectedClient;
  deviceModel?: string;
  deviceOs?:    string;
  appVersion?:  string;
  registeredAt: number;
}

const registry = new Map<string, PendingEntry>();

/** La TV s'enregistre avec son PIN après la connexion WS */
export function registerPin(
  pin: string,
  client: ConnectedClient,
  deviceInfo?: { deviceModel?: string; deviceOs?: string; appVersion?: string },
): void {
  // Supprimer un éventuel PIN existant pour ce client
  for (const [p, e] of registry) {
    if (e.client.id === client.id) { registry.delete(p); break; }
  }
  registry.set(pin, {
    client,
    deviceModel:  deviceInfo?.deviceModel,
    deviceOs:     deviceInfo?.deviceOs,
    appVersion:   deviceInfo?.appVersion,
    registeredAt: Date.now(),
  });
}

/** L'admin revendique un PIN → retourne le client TV et supprime le PIN */
export function claimPin(pin: string): ConnectedClient | undefined {
  const entry = registry.get(pin);
  if (entry) registry.delete(pin);
  return entry?.client;
}

/** Nettoyage quand une TV se déconnecte pendant l'appairage */
export function removeByClient(clientId: string): void {
  for (const [pin, e] of registry) {
    if (e.client.id === clientId) { registry.delete(pin); break; }
  }
}

/** Liste des TVs en attente d'appairage (pour l'affichage console) */
export function getPendingPairs(): Array<{
  pin:          string;
  clientId:     string;
  deviceModel?: string;
  deviceOs?:    string;
  appVersion?:  string;
  waitingSec:   number;
}> {
  const now = Date.now();
  return [...registry.entries()].map(([pin, e]) => ({
    pin,
    clientId:    e.client.id,
    deviceModel: e.deviceModel,
    deviceOs:    e.deviceOs,
    appVersion:  e.appVersion,
    waitingSec:  Math.floor((now - e.registeredAt) / 1000),
  }));
}
