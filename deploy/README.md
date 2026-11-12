# Instalación de DIGAIPE con Docker o Podman (red sin internet)

Con Podman sin root, vea la sección 2b y escriba `podman compose` donde dice `docker compose`.

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

## 2b. Alternativa: Podman sin root (Linux)

El mismo `compose.yaml` funciona con Podman ejecutado por un usuario normal, sin demonio con
privilegios de root. **En el resto de este documento, donde dice `docker compose`, escriba
`podman compose`** (y `podman` en lugar de `docker` para `build`, `pull`, `save` y `load`).

**Requisitos:** Podman 5 (Debian 13, Fedora, RHEL 9.5 o posterior; `podman --version`) y el
binario `docker-compose` v2. `podman compose` usa `docker-compose` cuando lo encuentra; no use
`podman-compose`, que no admite bien las condiciones `service_healthy` /
`service_completed_successfully`, los perfiles ni las anclas YAML de este archivo.

Preparar las imágenes (paso 1) con Podman: los mismos comandos cambiando `docker` por `podman`,
y `podman save` necesita `-m` para guardar varias imágenes en un archivo:

```sh
podman save -m -o digaipe-imagenes.tar digaipe/app:local digaipe/setup:local \
  docker.io/library/mysql:8.4 docker.io/library/caddy:2.11.7-alpine
```

Instalación en el servidor, una sola vez, como administrador:

```sh
sudo apt install -y podman systemd-container       # Debian; en Fedora/RHEL: dnf install podman
# docker-compose v2: descargue de https://github.com/docker/compose/releases el binario
# docker-compose-linux-x86_64 y su .sha256, compruebe la suma y cópielo:
sudo install -m 755 docker-compose-linux-x86_64 /usr/local/bin/docker-compose

sudo useradd --create-home --shell /bin/bash digaipe  # usuario que ejecuta los contenedores
grep digaipe /etc/subuid /etc/subgid                  # debe mostrar un rango en ambos archivos
sudo loginctl enable-linger digaipe                   # sus servicios arrancan sin iniciar sesión

# Un usuario normal no puede abrir puertos menores de 1024; Caddy necesita 80 y 443.
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-digaipe.conf
sudo sysctl --system

# .env y las carpetas de BACKUP_DIR / ANCHOR_DIR deben pertenecer al usuario digaipe.
sudo chown digaipe:digaipe /opt/digaipe/app/deploy/.env && sudo chmod 600 /opt/digaipe/app/deploy/.env
```

Luego, **como el usuario `digaipe`** (use `sudo machinectl shell digaipe@`, no `sudo -u` ni
`su`: hace falta una sesión de systemd para el socket de Podman y los healthchecks):

```sh
systemctl --user enable --now podman.socket
cd /opt/digaipe/app/deploy
podman load -i digaipe-imagenes.tar      # o: podman compose build
podman compose up -d
```

Arranque automático: Podman no tiene demonio que reinicie los contenedores tras un reinicio del
servidor. Cree `~/.config/systemd/user/digaipe.service` (usuario `digaipe`):

```ini
[Unit]
Description=DIGAIPE (podman compose)
Wants=podman.socket
After=podman.socket

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/digaipe/app/deploy
ExecStart=/usr/bin/podman compose up -d
ExecStop=/usr/bin/podman compose stop
TimeoutStartSec=600

[Install]
WantedBy=default.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable digaipe.service
```

Reinicie el servidor una vez y compruebe con `podman compose ps -a` que todo vuelve a arrancar.

Diferencias con Docker:

- **IP real de los usuarios: compruébela antes de usar el sistema.** La auditoría y el límite
  de intentos de inicio de sesión usan la IP que Caddy recibe. Según la versión y la red de
  Podman sin root, Caddy puede ver una IP interna (10.x, 169.254.x) para todas las conexiones:
  la auditoría perdería la IP y un usuario que falla la contraseña bloquearía a todos. Prueba:
  inicie sesión desde otra PC y mire la IP registrada en Administración → Auditoría. Si no es la
  de esa PC, use Podman con root (`sudo podman compose ...`) o Docker.
- **Cortafuegos:** Podman sin root no modifica las reglas del sistema (Docker sí), así que
  `ufw`/`firewalld` se aplican a los puertos 80 y 443 como a cualquier programa.
- **SELinux** (Fedora/RHEL): las carpetas montadas llevan `:z` en `compose.yaml` para que los
  contenedores puedan leerlas. Si `BACKUP_DIR` está en un disco sin etiquetas SELinux (USB FAT,
  NFS) y el montaje falla, quite `:z` de esa línea y monte el disco con la opción `context=`.
- **Volúmenes:** quedan en `/home/digaipe/.local/share/containers/storage/volumes/`. Sus
  archivos pertenecen a UIDs del rango de `/etc/subuid`; para copiarlos use
  `podman unshare cp -a ...` o `podman volume export`.
- El aviso `>>>> Executing external compose provider` es normal; se oculta con
  `compose_warning_logs = false` en la sección `[engine]` de
  `~/.config/containers/containers.conf`.

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

Con Podman sin root, estos volúmenes están en
`/home/digaipe/.local/share/containers/storage/volumes/` (ver sección 2b).
