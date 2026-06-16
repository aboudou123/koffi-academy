#!/bin/bash
# Déploiement SFTP de public/ vers one.com
# Appelé par .github/workflows/deploy.yml — ne pas exécuter directement.
set -euo pipefail

REMOTE="${SFTP_REMOTE_PATH:-www/}"

# Vérification des secrets requis
missing=()
[ -z "${SFTP_HOST:-}" ]  && missing+=("SFTP_HOST")
[ -z "${SFTP_USER:-}" ]  && missing+=("SFTP_USER")
[ -z "${SFTP_PASS:-}" ]  && missing+=("SFTP_PASS")
if [ ${#missing[@]} -gt 0 ]; then
  echo "ERREUR : secrets GitHub manquants : ${missing[*]}"
  echo "Aller dans : Settings → Secrets and variables → Actions"
  exit 1
fi

echo "Hôte   : ${SFTP_HOST}"
echo "User   : ${SFTP_USER}"
echo "Remote : ${REMOTE}"
echo ""

# Lancement du transfert lftp
# -u user,pass  → credentials séparés de l'URL (gère les caractères spéciaux)
# -e "..."      → commandes lftp en ligne, pas de heredoc
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
