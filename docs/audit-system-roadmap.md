# Institutional audit system roadmap

## Purpose

DIGAIPE retains permanent, admin-only evidence of institutional actions. The system records complete student before/after values for investigation, but never passwords, tokens, cookies, or authentication secrets.

## Phase 1: trusted application and database ledger

Phase 1 creates the live audit ledger. Application events record the business action, authenticated actor, request correlation ID, outcome, and approved before/after values. MySQL triggers independently record row changes to core tables, including changes made outside the web application.

Each event is appended through a stored procedure that links it to the previous event with a SHA-256 hash. Audit rows and chain state reject updates and deletes. Separate database accounts must restrict the web application to procedure execution and prevent it from changing audit tables directly.

The admin investigation page supports filtering and event detail. It records access attempts, views, and exports. `npm run audit:verify` validates the complete live hash chain.

Phase 1 acceptance requires that application writes and direct SQL changes both create evidence, app/read-only database users cannot modify ledger data, and a modified/deleted event is detected by the verifier.

### Development migration rebuild

The Drizzle history is deliberately a fresh, generated baseline (`0000_baseline.sql`) followed by a journaled custom migration (`0001_audit_ledger_controls.sql`). The baseline owns tables, indexes, and foreign keys; the custom migration owns the audit procedures, immutability controls, and database triggers. Do not regenerate or edit either after it has been applied to a shared environment.

For a local Docker development database only, the following command deletes the `local` MySQL volume, applies both migrations, creates the bootstrap administrator, loads reference data, and validates the audit hash chain:

```powershell
$env:DIGAIPE_CONFIRM_DEV_DB_RESET = 'YES'
npm run db:rebuild:dev
```

The command refuses to run with `NODE_ENV=production`, a non-local database host, a database other than `local`, missing bootstrap credentials, or without the explicit confirmation variable. It is not a production migration or recovery procedure.

## Phase 2: automatic incremental archive

Phase 2 creates an air-gapped Linux archive process. A dedicated `digaipe-audit` system account, launched by a persistent systemd timer, writes one signed daily UTC bundle to `/srv/digaipe-audit/archive` on a dedicated mounted volume. Each bundle contains compressed event data, a manifest, payload hash, chain boundaries, prior-manifest hash, and an Ed25519 signature.

The web application has no access to the signing key or archive volume. A root-owned post-step makes completed bundles immutable. The audit dashboard reports archive freshness and integrity failures; host service failure is the primary alert signal.

Phase 2 acceptance requires incremental signed bundles, independent signature/hash verification, visible stale/failure status after 26 hours, and a successful restore-and-verify drill.

## Operating rules

- Production is air-gapped Linux; all audit timestamps are UTC.
- Detailed audit records and archive bundles are retained permanently.
- Only administrators can investigate or export audit data.
- The current target is under 10,000 events/day. Review partitioning and storage quarterly.
- Break-glass database maintenance, signing-key rotation, archive restoration, and quarterly integrity drills require written operational runbooks.
