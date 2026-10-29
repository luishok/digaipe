# Instalación de DIGAIPE con Docker (red sin internet)

Servicios: `db` (MySQL 8.4), `setup` (migraciones, permisos, admin inicial; se ejecuta y
termina), `app` (SvelteKit) y `caddy` (HTTPS). La base de datos y la app no publican puertos:
los navegadores solo llegan a `caddy` por 443 (y 80, que redirige a HTTPS).

## 1. Preparar las imágenes (en una PC con internet)

`docker build` descarga paquetes de npm, así que no puede ejecutarse en la red aislada.

Desde la raíz del repositorio (no hace falta `.env`; la etiqueta `local` debe coincidir con
`DIGAIPE_VERSION` del servidor):

```sh
docker build --target app -t digaipe/app:local .
docker build --target setup -t digaipe/setup:local .
docker pull mysql:8.4
docker pull caddy:2.11.7-alpine
docker save -o digaipe-imagenes.tar digaipe/app:local digaipe/setup:local mysql:8.4 caddy:2.11.7-alpine
```

Lleve a la red aislada: `digaipe-imagenes.tar` y la carpeta `deploy/` completa.
Registre el SHA-256 del `.tar` (`sha256sum digaipe-imagenes.tar` o
`Get-FileHash digaipe-imagenes.tar`) y compárelo al llegar.

## 2. Instalar (en el servidor de la red aislada)

```sh
docker load -i digaipe-imagenes.tar
cd deploy
cp .env.example .env                 # PowerShell: Copy-Item .env.example .env
# Edite .env: contraseñas, BETTER_AUTH_SECRET, DIGAIPE_HOST y ORIGIN=https://<DIGAIPE_HOST>
docker compose up -d                 # sin --build: usa las imágenes cargadas
```

El contenedor `setup` aplica las migraciones, crea el usuario de base de datos de la aplicación
con permisos mínimos, crea el administrador inicial y carga modalidades y tipos OCRE. Al terminar
arranca `app`. Revise con `docker compose logs setup`.

## 3. Certificado HTTPS

Sin internet no hay Let's Encrypt. Caddy funciona como autoridad certificadora local: emite y
renueva el certificado del sitio sin conexión. Cada PC cliente debe **confiar una vez** en la raíz
de esa autoridad; si no, el navegador mostrará "La conexión no es privada".

Exportar la raíz (válida 10 años):

```sh
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./digaipe-ca.crt
```

Instalarla en cada PC cliente:

- **Windows (Chrome, Edge):** en una consola de administrador,
  `certutil -addstore -f Root digaipe-ca.crt`. En un dominio, distribúyala por GPO.
- **Firefox:** Configuración → Privacidad y seguridad → Certificados → Ver certificados →
  Autoridades → Importar, y marque "Confiar en esta CA para identificar sitios web".

Antes de instalarla, compare la huella con la que muestra el servidor
(`openssl x509 -in digaipe-ca.crt -noout -fingerprint -sha256`).

**El volumen `digaipe_caddy-data` contiene esa autoridad.** Si se pierde, Caddy crea otra y hay que
volver a instalar la raíz en todas las PCs. Inclúyalo en sus copias de seguridad del servidor.

Si la institución tiene su propia autoridad certificadora, use su certificado: ver el comentario
al inicio de `Caddyfile`.

## 4. Respaldos

El servicio `backup-worker` hace un respaldo **semanal** (7 días después del anterior, a las
02:00 de Caracas; el primero, al instalar) y conserva **al menos 2 meses**: borra los de más de 70 días, pero
siempre deja los 10 más recientes. Arranca con `docker compose up -d`; no hace falta cron.
Cada respaldo, y cada fallo, queda en el registro de auditoría.

```sh
docker compose logs --tail 20 backup-worker        # último resultado
docker compose --profile ops run --rm backup       # respaldo manual ahora
```

**Procedimiento completo, revisión semanal y restauración: [`docs/respaldos.md`](../docs/respaldos.md).**
En resumen, para restaurar:

```sh
docker compose stop app backup-worker
docker compose --profile ops run --rm -e RESTORE_CONFIRM=digaipe-20261028T060000Z \
  restore /scripts/restore.sh digaipe-20261028T060000Z
docker compose run --rm setup                     # obligatorio: reconstruye los triggers
docker compose --profile ops run --rm audit verify
docker compose start app backup-worker
```

Los respaldos contienen datos de estudiantes, hashes de contraseñas y sesiones. Copie el más
reciente cada semana a un medio fuera del servidor.

## 5. Auditoría: verificar y anclar

El registro de auditoría es una cadena de hashes. Detecta cambios en eventos, pero alguien con
acceso de administrador a MySQL podría borrar los eventos más recientes o reescribir la cadena
completa. Para detectarlo, se **ancla** la cabeza de la cadena en un archivo guardado fuera de su
alcance (`ANCHOR_DIR`: USB del auditor, carpeta compartida de otra PC).

```sh
# Verificar cadena + anclas (diario)
docker compose --profile ops run --rm audit

# Anclar la cabeza actual (semanal, y al cerrar cada proceso de admisión)
docker compose --profile ops run --rm audit anchor --anchors /anchors/digaipe-anchors.jsonl --note "cierre UA06426"
```

`anchor` primero verifica la cadena y se niega a anclar una cadena rota. Imprime la línea del
ancla: cópiela también en un registro independiente (libro de actas, correo interno). Cada ancla
queda además registrada en la propia cadena como evento `audit.anchored`.

Si `verify` falla, **no repare nada**: conserve la base, los respaldos y el archivo de anclas tal
como están, y registre el incidente. La salida indica qué eventos no coinciden.

## 6. Roles de la aplicación

Cada usuario tiene uno o más roles (Administración → Usuarios y roles). Un usuario sin roles
solo ve la página de inicio.

| Rol | Puede |
|---|---|
| Administrador | Todo, incluidos usuarios y auditoría |
| Generación de planillas | Buscar admisiones, editar datos del estudiante, generar y reimprimir planillas |
| Matrícula y devolución | Revisar documentos: matricular, devolver y desbloquear (con motivo) |
| Estadísticas | Ver estadísticas y exportar CSV/PDF |
| Carga de admisiones | Cargar lotes de admisiones, gestionar procesos de admisión, importar carreras |
| Auditor (solo lectura) | Ver todas las páginas, exportaciones y el registro de auditoría; no puede modificar nada |

Las listas (carreras, modalidades) las ven todos los roles. Cada acceso denegado queda en la
auditoría como `route.access_denied`. La definición está en `src/lib/permissions.ts`.

## 7. Cuentas de MySQL

| Cuenta | Para | Puede |
|---|---|---|
| root | `setup` y `restore` (se ejecutan a mano) | Todo |
| `APP_DB_USER` (`digaipe_app`) | La aplicación | Leer y escribir datos de negocio; solo leer y anexar a la auditoría |
| `BACKUP_DB_USER` (`digaipe_respaldo`) | `backup-worker` | Leer todo para respaldar; anotar eventos `backup.*`. No modifica datos ni triggers |
| `READONLY_DB_USER` (`digaipe_lectura`) | Auditores (opcional) | Leer todo salvo contraseñas, tokens y códigos; exige TLS |

Las crea y ajusta `setup` en cada arranque (`scripts/grant-db-users.ts`).

### Cuenta de solo lectura

Para auditores que usan herramientas SQL. Se crea si `READONLY_DB_PASSWORD` tiene valor en
`.env` (se aplica al reiniciar `setup`: `docker compose run --rm setup`).

- Lee todas las tablas, incluido el registro de auditoría.
- **No** ve contraseñas, tokens de sesión ni códigos de verificación (columnas excluidas).
- No puede modificar nada ni ejecutar procedimientos. Exige conexión cifrada (TLS).

El puerto de MySQL no se publica en la red. Para consultar desde el servidor:

```sh
docker compose exec db mysql -h 127.0.0.1 --ssl-mode=REQUIRED -u digaipe_lectura -p digaipe
```

## Operación

| Tarea | Comando (desde `deploy/`) |
|---|---|
| Ver estado | `docker compose ps` |
| Ver registros | `docker compose logs -f app` |
| Ver la instalación | `docker compose logs setup` |
| Detener | `docker compose down` |
| Actualizar | Repetir el paso 1 con la versión nueva (otra `DIGAIPE_VERSION`), `docker load`, editar `DIGAIPE_VERSION` en `.env` y `docker compose up -d` |

`docker compose down` conserva los datos. **`docker compose down -v` borra la base de datos, los
archivos cargados y la autoridad certificadora.** No lo use salvo que quiera empezar de cero.

## Datos

| Volumen | Contenido |
|---|---|
| `digaipe_db-data` | Base de datos |
| `digaipe_uploads` | Archivos de admisiones cargados |
| `digaipe_caddy-data` | Autoridad certificadora local y certificados |
