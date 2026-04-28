#!/usr/bin/env bash
# ============================================================
# Circuit Fit TV — Script de mise à jour
# ============================================================
# Ce script est exécuté sur l'HÔTE (pas dans un container)
# lorsqu'une mise à jour est déclenchée depuis la console web.
#
# Installation :
#   chmod +x /opt/circuit-fit-tv/update.sh
#
# Configuration dans docker-compose.prod.yml :
#   environment:
#     UPDATE_SCRIPT_PATH: /opt/circuit-fit-tv/update.sh
#   volumes:
#     - /opt/circuit-fit-tv/update.sh:/opt/circuit-fit-tv/update.sh:ro
# ============================================================

set -euo pipefail

# Répertoire contenant docker-compose.prod.yml
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$(dirname "$0")" && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.prod.yml}"

echo "╔══════════════════════════════════════╗"
echo "║     Circuit Fit TV — Mise à jour     ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "► Répertoire : $COMPOSE_DIR"
echo "► Compose    : $COMPOSE_FILE"
echo ""

cd "$COMPOSE_DIR"

echo "► Téléchargement des nouvelles images…"
docker compose -f "$COMPOSE_FILE" pull

echo ""
echo "► Redémarrage des services…"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo ""
echo "► Nettoyage des images obsolètes…"
docker image prune -f

echo ""
echo "✅ Mise à jour terminée."
docker compose -f "$COMPOSE_FILE" ps
