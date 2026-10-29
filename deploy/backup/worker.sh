#!/usr/bin/env bash
# Weekly backup worker: the `backup-worker` service, started by `docker compose up`.
#
# Every BACKUP_CHECK_SECONDS it decides whether a backup is due:
#   - no backup yet, or the newest is older than the interval plus one day (a run was missed,
#     e.g. the server was off on backup night): back up now;
#   - the newest is (about) one interval old and the current UTC hour is BACKUP_HOUR_UTC:
#     back up now;
#   - otherwise: wait.
# backup.sh records each result in the audit ledger and applies retention.
#
# WORKER_ONCE=1 makes a single decision and exits (used to test the schedule).
set -uo pipefail
here=$(dirname "$0")
source "$here/lib.sh"

BACKUP_ROOT=${BACKUP_ROOT:-/backups}
BACKUP_INTERVAL_DAYS=${BACKUP_INTERVAL_DAYS:-7}
# 06 UTC = 02:00 in Caracas (UTC-4 all year, no daylight saving time).
BACKUP_HOUR_UTC=${BACKUP_HOUR_UTC:-6}
BACKUP_CHECK_SECONDS=${BACKUP_CHECK_SECONDS:-900}

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

# Prints why a backup is due, or nothing when it is not.
due_reason() {
	local newest age interval
	newest=$(list_backups "$BACKUP_ROOT" | head -n1)
	if [ -z "$newest" ]; then
		echo 'no backup exists yet'
		return
	fi
	age=$(($(date -u +%s) - ${newest%% *}))
	interval=$((BACKUP_INTERVAL_DAYS * 86400))
	if [ "$age" -ge $((interval + 86400)) ]; then
		echo "newest backup ${newest#* } is $((age / 86400)) days old (missed run)"
	# Three hours of slack, so a run that started a little late last week is still due.
	elif [ "$age" -ge $((interval - 3 * 3600)) ] && [ $((10#$(date -u +%H))) -eq "$BACKUP_HOUR_UTC" ]; then
		echo "weekly run (newest backup is $((age / 86400)) days old)"
	fi
}

log "Backup worker started: every $BACKUP_INTERVAL_DAYS days at $(printf %02d "$BACKUP_HOUR_UTC"):00 UTC, keeping ${BACKUP_KEEP_DAYS:-70} days (newest ${BACKUP_KEEP_MIN:-10} always)."
while true; do
	reason=$(due_reason)
	if [ -n "$reason" ]; then
		log "Backup due: $reason"
		if bash "$here/backup.sh"; then
			log 'Backup finished.'
		else
			# Wait before retrying, so a full disk does not add a failure event every check.
			log "Backup FAILED (recorded in the audit ledger as backup.failed); retrying in $((${BACKUP_RETRY_SECONDS:-21600} / 3600)) h."
			[ "${WORKER_ONCE:-0}" = "1" ] && exit 1
			sleep "${BACKUP_RETRY_SECONDS:-21600}"
			continue
		fi
	elif [ "${WORKER_ONCE:-0}" = "1" ]; then
		log 'No backup due.'
	fi
	[ "${WORKER_ONCE:-0}" = "1" ] && exit 0
	sleep "$BACKUP_CHECK_SECONDS"
done
