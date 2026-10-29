# Shared by backup.sh, restore.sh and worker.sh. Source it; do not run it.
# (mysql output is piped through `tr -d '\r'` in these scripts: the Windows client ends lines
# with CRLF, which would otherwise end up inside hashes and JSON.)
#
# A backup's age comes from its name (digaipe-YYYYmmddTHHMMSSZ, UTC), not the folder's
# modification time, which changes when folders are copied between disks. Folders whose
# name does not parse (e.g. a copy renamed by hand) are never counted and never deleted.

# Seconds since the epoch for a backup name, or nothing when the name does not parse.
backup_epoch() {
	local stamp=${1#digaipe-}
	[[ $stamp =~ ^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})Z$ ]] || return 0
	date -u -d "${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-${BASH_REMATCH[3]} ${BASH_REMATCH[4]}:${BASH_REMATCH[5]}:${BASH_REMATCH[6]}" +%s
}

# "<epoch> <name>" for every complete backup in $1, newest first.
list_backups() {
	local root=$1 dir name epoch
	for dir in "$root"/digaipe-*; do
		[ -d "$dir" ] || continue
		name=$(basename "$dir")
		epoch=$(backup_epoch "$name")
		[ -n "$epoch" ] && echo "$epoch $name"
	done | sort -rn
}

# Appends a backup.* event to the audit ledger, so backups and restores show on the audit page.
# record_backup_event (drizzle/0005) accepts only backup.* actions and names the calling account.
# Args: action outcome backup_name metadata_json
ledger_event() {
	mysql -h "$DB_HOST" -u"$DB_USER" "$DB_NAME" -e \
		"CALL record_backup_event('$1', '$2', '$3', CAST('$4' AS JSON))"
}

# Keeps only characters that are safe inside the SQL string literal and JSON above.
sql_safe() {
	tr -cd 'A-Za-z0-9 ._:/=()-' <<<"$1" | cut -c1-300
}
