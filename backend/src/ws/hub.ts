// ============================================================
// WebSocket Hub — registry des clients connectés
// ============================================================

import { randomUUID } from 'node:crypto';
import type { WebSocket } from '@fastify/websocket';
import type { ServerMessage } from '@cfitv/shared';

export type ClientRole = 'tv' | 'coach' | 'monitor';

export interface ConnectedClient {
  id: string;
  socket: WebSocket;
  role: ClientRole;
  label: string;
  displayId: string | undefined;
  connectedAt: number;
}

class WsHub {
  private clients = new Map<string, ConnectedClient>();

  add(socket: WebSocket, role: ClientRole, label: string, displayId?: string): ConnectedClient {
    const client: ConnectedClient = {
      id: randomUUID(),
      socket,
      role,
      label,
      displayId,
      connectedAt: Date.now(),
    };
    this.clients.set(client.id, client);
    return client;
  }

  remove(id: string): void {
    this.clients.delete(id);
  }

  get(id: string): ConnectedClient | undefined {
    return this.clients.get(id);
  }

  all(): ConnectedClient[] {
    return [...this.clients.values()];
  }

  byRole(role: ClientRole): ConnectedClient[] {
    return this.all().filter((c) => c.role === role);
  }

  send(client: ConnectedClient, msg: ServerMessage): void {
    if (client.socket.readyState === client.socket.OPEN) {
      client.socket.send(JSON.stringify(msg));
    }
  }

  broadcast(msg: ServerMessage, filter?: (c: ConnectedClient) => boolean): void {
    for (const client of this.clients.values()) {
      if (!filter || filter(client)) {
        this.send(client, msg);
      }
    }
  }

  broadcastAll(msg: ServerMessage): void {
    this.broadcast(msg);
  }

  /** Diffuse à toutes les TV (role='tv') */
  broadcastToTvs(msg: ServerMessage): void {
    this.broadcast(msg, (c) => c.role === 'tv');
  }

  /** Diffuse au coach et aux monitors */
  broadcastToCoaches(msg: ServerMessage): void {
    this.broadcast(msg, (c) => c.role === 'coach' || c.role === 'monitor');
  }

  clientList() {
    return this.all().map((c) => ({
      id:          c.id,
      role:        c.role,
      label:       c.label,
      displayId:   c.displayId ?? null,
      connectedAt: c.connectedAt,
    }));
  }

  /** Retourne les displayIds des TV actuellement connectées */
  onlineDisplayIds(): Set<string> {
    return new Set(
      this.all()
        .filter((c) => c.role === 'tv' && c.displayId)
        .map((c) => c.displayId as string),
    );
  }
}

export const hub = new WsHub();
