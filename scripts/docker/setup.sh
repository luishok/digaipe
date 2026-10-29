#!/bin/sh
# Runs as the database owner (root) before the web app starts. Every step is idempotent,
# so this is safe on every `docker compose up`.
set -eu

echo '==> Migraciones'
npx drizzle-kit migrate

echo '==> Triggers de auditoría (se reconstruyen si faltan, p. ej. tras restaurar)'
npx tsx scripts/ensure-audit-triggers.ts

echo '==> Usuarios de base de datos y permisos'
npx tsx scripts/grant-db-users.ts

echo '==> Administrador inicial'
npx tsx scripts/bootstrap-admin.ts

echo '==> Datos base'
npx tsx scripts/load_admission_mod.ts
npx tsx scripts/load_ocre_types.ts
