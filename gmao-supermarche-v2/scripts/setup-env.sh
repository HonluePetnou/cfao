#!/bin/sh
# Generates gmao-supermarche-v2/.env with strong, random secrets on first run.
# Never commit the resulting .env — it stays local to the machine it's
# generated on. Safe to re-run: does nothing if .env already exists, so it
# never overwrites/rotates secrets you're already relying on.
#
# Usage:
#   ./scripts/setup-env.sh                          # FRONTEND_URL=http://localhost:3000
#   ./scripts/setup-env.sh http://203.0.113.10       # FRONTEND_URL set to the given URL
#
# After this, `docker compose up -d --build` has everything it needs.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$ROOT_DIR/.env"
FRONTEND_URL="${1:-http://localhost:3000}"

if [ -f "$ENV_FILE" ]; then
  echo "$ENV_FILE existe déjà — rien à faire (supprime-le d'abord si tu veux le régénérer)."
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl est requis pour générer des secrets forts (apt/apk/yum install openssl)." >&2
  exit 1
fi

JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n=/+')
POSTGRES_USER=gmao
POSTGRES_DB=gmao

cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?schema=public
JWT_SECRET=${JWT_SECRET}
REDIS_URL=redis://localhost:6379
PORT=4000
FRONTEND_URL=${FRONTEND_URL}

# Utilisées par docker-compose.yml (substitution \${VAR})
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF

chmod 600 "$ENV_FILE"

echo "$ENV_FILE généré avec des secrets aléatoires (FRONTEND_URL=${FRONTEND_URL})."
echo "Si l'URL publique change plus tard, édite FRONTEND_URL à la main et relance : docker compose up -d api"
