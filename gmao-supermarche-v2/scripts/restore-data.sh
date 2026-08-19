#!/bin/sh
# Restores the real production data dump into the running Postgres
# container. Never committed to git (see data/*.sql in .gitignore) —
# transfer it to the server separately first (scp/LocalSend), then run:
#
#   ./scripts/restore-data.sh                 # uses data/gmao-seed.sql
#   ./scripts/restore-data.sh path/to/other.sql
#
# Requires `docker compose up -d --build` already done. Idempotent: if the
# target table already has rows, it skips instead of erroring out on
# duplicate keys (the dump is plain INSERTs, no ON CONFLICT).

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR"

DUMP_FILE="${1:-data/gmao-seed.sql}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Introuvable : $DUMP_FILE (transfère-le sur le serveur avant de relancer, hors git)." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env manquant — lance ./scripts/setup-env.sh d'abord." >&2
  exit 1
fi
set -a
. ./.env
set +a

psql_exec() {
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

echo "En attente que le schéma existe (conteneur api 'healthy', prisma db push déjà passé)..."
tries=0
max_tries=24 # 24 * 5s = 2 min
until psql_exec -c 'SELECT 1 FROM "Supermarket" LIMIT 1;' >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge "$max_tries" ]; then
    echo "Le schéma n'existe toujours pas après 2 minutes." >&2
    echo "Vérifie : docker compose ps   /   docker compose logs api" >&2
    exit 1
  fi
  sleep 5
done

existing=$(psql_exec -t -A -c 'SELECT count(*) FROM "Supermarket";')
if [ "$existing" != "0" ]; then
  echo "La base contient déjà des données (Supermarket: $existing lignes) — restauration ignorée."
  echo "Pour recharger depuis zéro il faut vider la base à la main d'abord (action destructive, hors de ce script)."
  exit 0
fi

echo "Restauration de $DUMP_FILE ..."
# Strip lines the dump's source (pg_dump 18.1) emits that our postgres:15
# target doesn't understand — harmless to drop, none of them affect data:
# - \restrict/\unrestrict: client-side safety meta-command (newer psql).
# - SET transaction_timeout: session GUC only added in PostgreSQL 17.
grep -v '^\\restrict\|^\\unrestrict\|^SET transaction_timeout' "$DUMP_FILE" | \
  psql_exec -v ON_ERROR_STOP=1 --single-transaction

echo "Restauration terminée. Vérification :"
psql_exec -c "
SELECT 'Supermarket' AS tbl, count(*) FROM \"Supermarket\"
UNION ALL SELECT 'User', count(*) FROM \"User\"
UNION ALL SELECT 'Localisation', count(*) FROM \"Localisation\"
UNION ALL SELECT 'Equipment', count(*) FROM \"Equipment\"
UNION ALL SELECT 'PreventivePlan', count(*) FROM \"PreventivePlan\"
UNION ALL SELECT 'Ticket', count(*) FROM \"Ticket\"
UNION ALL SELECT 'RondeConfiguration', count(*) FROM \"RondeConfiguration\";"
