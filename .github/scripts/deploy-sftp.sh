#!/bin/bash
# Déploiement SFTP de public/ vers one.com
set -euo pipefail

# ── Validation des secrets ────────────────────────────────────────────────────
missing=()
[ -z "${SFTP_HOST:-}" ] && missing+=("SFTP_HOST")
[ -z "${SFTP_USER:-}" ] && missing+=("SFTP_USER")
[ -z "${SFTP_PASS:-}" ] && missing+=("SFTP_PASS")
if [ ${#missing[@]} -gt 0 ]; then
  echo "ERREUR : secrets GitHub manquants : ${missing[*]}"
  exit 1
fi

# ── Chemin distant ────────────────────────────────────────────────────────────
# Sur one.com le home SFTP EST la racine du webspace.
# On retire le slash initial s'il y en a un (/www/ → www/)
RAW="${SFTP_REMOTE_PATH:-webroots/by-route/lingenieur.de_/}"
REMOTE="${RAW#/}"          # supprime le '/' de début si présent
REMOTE="${REMOTE%/}/"      # garantit un slash de fin

echo "Hôte   : ${SFTP_HOST}"
echo "User   : ${SFTP_USER}"
echo "Remote : ${REMOTE}"
echo ""

# ── Diagnostic : liste le répertoire distant ──────────────────────────────────
echo "=== Contenu du répertoire racine SFTP ==="
lftp \
  -u "${SFTP_USER},${SFTP_PASS}" \
  "sftp://${SFTP_HOST}:22" \
  -e "set sftp:auto-confirm yes; set net:timeout 15; ls; bye" || true
echo "========================================="
echo ""

# ── Transfert ─────────────────────────────────────────────────────────────────
echo "Déploiement de public/ → ${REMOTE} ..."
lftp \
  -u "${SFTP_USER},${SFTP_PASS}" \
  "sftp://${SFTP_HOST}:22" \
  -e "
    set sftp:auto-confirm yes;
    set net:timeout 30;
    set net:max-retries 3;
    set net:reconnect-interval-base 5;
    mirror --reverse --delete --verbose ./public/ ${REMOTE};
    bye
  "

echo ""
echo "Déploiement terminé."
