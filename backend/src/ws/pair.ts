// ============================================================
// Registre en mémoire des PIN d'appairage TV
// PIN (4 chiffres) → ConnectedClient en attente de config
// ============================================================

import type { ConnectedClient } from './hub.js';

const registry = new Map<string, ConnectedClient>();

/** La TV s'enregistre avec son PIN après la connexion WS */
export function registerPin(pin: string, client: ConnectedClient): void {
  // Supprimer un éventuel PIN existant pour ce client
  for (const [p, c] of registry) {
    if (c.id === client.id) { registry.delete(p); break; }
  }
  registry.set(pin, client);
}

/** L'admin revendique un PIN → retourne le client TV et supprime le PIN */
export function claimPin(pin: string): ConnectedClient | undefined {
  const client = registry.get(pin);
  if (client) registry.delete(pin);
  return client;
}

/** Nettoyage quand une TV se déconnecte pendant l'appairage */
export function removeByClient(clientId: string): void {
  for (const [pin, c] of registry) {
    if (c.id === clientId) { registry.delete(pin); break; }
  }
}
