# Phase 1 database-role deployment controls

Run the Phase 1 migration with a database-owner account, never with the production web-app account. Create unique, high-entropy credentials outside version control and limit network hosts to the application server.

The web application account needs normal DML rights on business tables and `EXECUTE` on `append_audit_event`; it must not receive `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE ROUTINE`, or `TRIGGER` rights on `audit_events`, `audit_chain_state`, or `audit_logs`.

The future Phase 2 archive account will receive `SELECT` on the ledger only. It must not use the web-app credential.

The database-owner account owns migrations, stored procedures, triggers, and break-glass maintenance. Record every use of that account in the institutional operations register, immediately run `npm run audit:verify`, and preserve the command output with the maintenance ticket.

Before deployment, inspect grants with `SHOW GRANTS`, confirm the web application no longer uses a MySQL root account, and prove that direct `UPDATE`/`DELETE` statements against the ledger fail for application and archive accounts.
