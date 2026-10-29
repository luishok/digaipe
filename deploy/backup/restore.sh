#!/usr/bin/env bash
# DIGAIPE restore. REPLACES the current database and uploaded files with a backup.
#   docker compose --profile ops run --rm -e RESTORE_CONFIRM=<backup name> restore \
#     /scripts/restore.sh <backup name>
#
# Order: check every file against SHA256SUMS, take a safety backup of the current state, then
# recreate the database from the dump, put the uploads back, check the audit head recorded in
# MANIFEST is present with the same hash, and append a backup.restored event so the ledger
# itself records the rollback. Full procedure: docs/respaldos.md.
#
# SKIP_SAFETY_BACKUP=1 skips the safety backup, for when the current database is too damaged
# to dump (the reason for restoring). Everything after the backup's date is then lost for good.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

DB_HOST=${DB_HOST:-db}
DB_NAME=${DB_NAME:-digaipe}
BACKUP_ROOT=${BACKUP_ROOT:-/backups}
UPLOADS_DIR=${UPLOADS_DIR:-/uploads}
# Restoring needs root: the dump recreates triggers and procedures as DEFINER=root, which only
# an account with SET_USER_ID / SYSTEM_USER may do. Runs in the `restore` service, not the
# always-on backup worker, which only has the backup account.
DB_USER=root
export MYSQL_PWD="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is not set}"

name=${1:?Usage: restore.sh <backup name, e.g. digaipe-20261028T230000Z>}
src="$BACKUP_ROOT/$name"
[ -d "$src" ] || { echo "No backup at $src" >&2; exit 1; }
if [ "${RESTORE_CONFIRM:-}" != "$name" ]; then
	echo "This replaces database '$DB_NAME' and $UPLOADS_DIR with $name." >&2
	echo "Re-run with RESTORE_CONFIRM=$name to proceed." >&2
	exit 1
fi

echo '==> Checking backup integrity'
(cd "$src" && sha256sum --quiet -c SHA256SUMS)
head_sequence=$(sed -n 's/^audit_head_sequence=//p' "$src/MANIFEST")
head_hash=$(sed -n 's/^audit_head_hash=//p' "$src/MANIFEST")

previous_head=$(mysql -h "$DB_HOST" -uroot -N -B -e 	"SELECT last_sequence FROM \`$DB_NAME\`.audit_chain_state WHERE id = 1" 2>/dev/null | tr -d '\r' || true)

safety_name=none
if [ "${SKIP_SAFETY_BACKUP:-}" != "1" ]; then
	echo '==> Safety backup of the current state'
	# Never prune here: retention must not delete anything while we are restoring.
	safety_output=$(BACKUP_PRUNE=0 BACKUP_DB_USER=root BACKUP_DB_PASSWORD="$MYSQL_ROOT_PASSWORD" bash "$(dirname "$0")/backup.sh")
	echo "$safety_output"
	safety_name=$(sed -n 's/^BACKUP_NAME=//p' <<<"$safety_output")
fi

echo "==> Restoring database $DB_NAME"
mysql -h "$DB_HOST" -uroot -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\`"
gzip -dc "$src/digaipe.sql.gz" | mysql -h "$DB_HOST" -uroot "$DB_NAME"

if [ -d "$src/uploads" ]; then
	echo "==> Restoring uploads into $UPLOADS_DIR"
	mkdir -p "$UPLOADS_DIR"
	find "$UPLOADS_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
	cp -a "$src/uploads/." "$UPLOADS_DIR/"
fi

restored_hash=$(mysql -h "$DB_HOST" -uroot -N -B -e \
	"SELECT event_hash FROM \`$DB_NAME\`.audit_events WHERE sequence = $head_sequence" | tr -d '\r')
if [ "$restored_hash" != "$head_hash" ]; then
	echo "Audit head $head_sequence does not match MANIFEST after restore." >&2
	exit 1
fi
ledger_event backup.restored success "$name" 	"{\"restoredHeadSequence\": $head_sequence, \"previousHeadSequence\": \"$(sql_safe "${previous_head:-unknown}")\", \"safetyBackup\": \"$safety_name\"}"
echo "Restore complete. Audit head $head_sequence matches the backup."
echo "The database has NO audit triggers yet: run the setup service before starting the app"
echo "(docker compose run --rm setup), which rebuilds them from the migrations."
echo "Events $((head_sequence + 1))..${previous_head:-?} of the previous ledger are only in the safety backup ($safety_name)."
