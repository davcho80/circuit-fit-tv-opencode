// ============================================================
// Registre en mémoire des PIN d'appairage TV
// PIN (4 chiffres) → ConnectedClient en attente de config
// ============================================================

import type { ConnectedClient } from './hub.js';

export interface PendingEntry {
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
  const entry: PendingEntry = {
    client,
    registeredAt: Date.now(),
  };
  if (deviceInfo?.deviceModel) entry.deviceModel = deviceInfo.deviceModel;
  if (deviceInfo?.deviceOs) entry.deviceOs = deviceInfo.deviceOs;
  if (deviceInfo?.appVersion) entry.appVersion = deviceInfo.appVersion;

  registry.set(pin, entry);
}

/** L'admin revendique un PIN → retourne le client TV et supprime le PIN */
export function claimPin(pin: string): ConnectedClient | undefined {
  const entry = registry.get(pin);
  if (entry) registry.delete(pin);
  return entry?.client;
}

/** Variante enrichie : retourne le client + les infos device */
export function claimPinWithInfo(pin: string): (PendingEntry & { client: ConnectedClient }) | undefined {
  const entry = registry.get(pin);
  if (!entry) return undefined;
  registry.delete(pin);
  return entry;
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
  return [...registry.entries()].map(([pin, e]) => {
    const pair: {
      pin:          string;
      clientId:     string;
      deviceModel?: string;
      deviceOs?:    string;
      appVersion?:  string;
      waitingSec:   number;
    } = {
      pin,
      clientId:   e.client.id,
      waitingSec: Math.floor((now - e.registeredAt) / 1000),
    };
    if (e.deviceModel) pair.deviceModel = e.deviceModel;
    if (e.deviceOs) pair.deviceOs = e.deviceOs;
    if (e.appVersion) pair.appVersion = e.appVersion;
    return pair;
  });
}
