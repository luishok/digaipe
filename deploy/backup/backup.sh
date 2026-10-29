#!/usr/bin/env bash
# DIGAIPE backup: database dump + uploaded files + SHA-256 manifest + audit chain head.
# Runs weekly from the `backup-worker` service, or by hand:
#   docker compose --profile ops run --rm backup
#
# Output: $BACKUP_ROOT/digaipe-<UTC timestamp>/
#   digaipe.sql.gz   all data, including the audit ledger, and the stored procedures. Not the
#                    triggers: setup rebuilds them from the migrations (see restore.sh).
#   uploads/         copy of the admission files
#   MANIFEST         when, what, and the audit chain head at backup time
#   SHA256SUMS       hash of every file above; restore.sh refuses a backup that does not match
# Last line of output: BACKUP_NAME=<name> (read by worker.sh and restore.sh).
# Every run, success or failure, is written to the audit ledger (backup.completed / backup.failed).
#
# The dump holds student data, password hashes and sessions: store backups as sensitive data.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

DB_HOST=${DB_HOST:-db}
DB_NAME=${DB_NAME:-digaipe}
BACKUP_ROOT=${BACKUP_ROOT:-/backups}
UPLOADS_DIR=${UPLOADS_DIR:-/uploads}
# Retention: delete backups older than BACKUP_KEEP_DAYS, but always keep the newest
# BACKUP_KEEP_MIN whatever their age. Weekly runs with 70 days / 10 keep about 2.5 months.
BACKUP_KEEP_DAYS=${BACKUP_KEEP_DAYS:-70}
BACKUP_KEEP_MIN=${BACKUP_KEEP_MIN:-10}
# 0 skips retention (restore.sh's safety backup must not delete anything).
BACKUP_PRUNE=${BACKUP_PRUNE:-1}
# Refuse to start without this much free space (MB), or twice the last backup if larger.
BACKUP_MIN_FREE_MB=${BACKUP_MIN_FREE_MB:-512}
# The dedicated backup account (scripts/grant-db-users.ts): can read and dump the database and
# append to the audit ledger, nothing else. restore.sh runs this script as root instead.
DB_USER=${BACKUP_DB_USER:-digaipe_respaldo}
export MYSQL_PWD="${BACKUP_DB_PASSWORD:?BACKUP_DB_PASSWORD is not set}"

mkdir -p "$BACKUP_ROOT"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
name="digaipe-$stamp"
work="$BACKUP_ROOT/.$name.partial"
step='start'

on_error() {
	rm -rf "$work"
	echo "Backup FAILED at step: $step" >&2
	ledger_event backup.failed failure "$name" "{\"step\": \"$(sql_safe "$step")\"}" || true
}
trap on_error ERR

step='free space'
newest=$(list_backups "$BACKUP_ROOT" | head -n1 | cut -d' ' -f2)
last_kb=0
[ -n "$newest" ] && last_kb=$(du -sk "$BACKUP_ROOT/$newest" | cut -f1)
need_kb=$((BACKUP_MIN_FREE_MB * 1024))
[ $((last_kb * 2)) -gt "$need_kb" ] && need_kb=$((last_kb * 2))
free_kb=$(df -Pk "$BACKUP_ROOT" | awk 'NR == 2 { print $4 }')
if [ "$free_kb" -lt "$need_kb" ]; then
	step="free space: $((free_kb / 1024)) MB free, $((need_kb / 1024)) MB needed"
	false
fi

mkdir -p "$work"

# Read the head before the dump starts, so the dump always contains it. After a restore,
# the event at this sequence must still carry this hash.
step='read audit head'
read -r head_sequence head_hash < <(
	mysql -h "$DB_HOST" -u"$DB_USER" -N -B -e "SELECT last_sequence, last_hash FROM \`$DB_NAME\`.audit_chain_state WHERE id = 1" | tr -d '\r'
)
server_version=$(mysql -h "$DB_HOST" -u"$DB_USER" -N -B -e 'SELECT VERSION()' | tr -d '\r')

# --single-transaction: consistent InnoDB snapshot without locking the app out.
# --skip-triggers: the backup account may not read triggers (that privilege would also let it
# drop them); setup rebuilds them from the migrations after a restore. No MySQL events are used.
step='mysqldump'
mysqldump -h "$DB_HOST" -u"$DB_USER" --single-transaction --routines --skip-triggers --skip-events \
	--hex-blob --set-gtid-purged=OFF --no-tablespaces "$DB_NAME" | gzip -9 > "$work/digaipe.sql.gz"

step='copy uploads'
if [ -d "$UPLOADS_DIR" ]; then
	mkdir -p "$work/uploads"
	cp -a "$UPLOADS_DIR/." "$work/uploads/"
fi

step='manifest'
cat > "$work/MANIFEST" <<EOF
backup=$name
created_utc=$stamp
database=$DB_NAME
mysql_version=$server_version
audit_head_sequence=$head_sequence
audit_head_hash=$head_hash
EOF

(cd "$work" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

mv "$work" "$BACKUP_ROOT/$name"
trap - ERR
size_kb=$(du -sk "$BACKUP_ROOT/$name" | cut -f1)
manifest_sha=$(sha256sum "$BACKUP_ROOT/$name/SHA256SUMS" | cut -d' ' -f1)
echo "Backup written: $BACKUP_ROOT/$name ($((size_kb / 1024)) MB, audit head $head_sequence)"
ledger_event backup.completed success "$name" \
	"{\"auditHeadSequence\": $head_sequence, \"auditHeadHash\": \"$head_hash\", \"sizeKb\": $size_kb, \"sha256sumsSha256\": \"$manifest_sha\"}" ||
	echo "WARNING: backup written but not recorded in the audit ledger" >&2

if [ "$BACKUP_PRUNE" = "1" ]; then
	cutoff=$(($(date -u +%s) - BACKUP_KEEP_DAYS * 86400))
	position=0
	while read -r epoch old; do
		position=$((position + 1))
		[ "$position" -le "$BACKUP_KEEP_MIN" ] && continue
		[ "$epoch" -ge "$cutoff" ] && continue
		rm -rf "${BACKUP_ROOT:?}/$old"
		echo "Deleted (older than $BACKUP_KEEP_DAYS days): $old"
	done < <(list_backups "$BACKUP_ROOT")
fi

echo "BACKUP_NAME=$name"
