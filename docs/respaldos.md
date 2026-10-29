# Respaldos y restauración de DIGAIPE

Procedimiento de operación. Los comandos se ejecutan en el servidor, desde la carpeta `deploy/`.

## 1. Cómo funcionan los respaldos

El servicio `backup-worker` arranca con `docker compose up -d` y no necesita cron ni el
Programador de tareas.

| Qué | Valor por defecto (`deploy/.env`) |
|---|---|
| Frecuencia | Cada 7 días (`BACKUP_INTERVAL_DAYS`) |
| Hora | 06:00 UTC = 02:00 en Caracas (`BACKUP_HOUR_UTC`) |
| Conservación | Se borran los de más de 70 días (`BACKUP_KEEP_DAYS`), pero **siempre** quedan los 10 más recientes (`BACKUP_KEEP_MIN`): unos 2 meses y medio |
| Dónde | `BACKUP_DIR` (por defecto `deploy/backups`) |
| Espacio mínimo | No empieza con menos de 512 MB libres, o el doble del último respaldo (`BACKUP_MIN_FREE_MB`) |

- Si el servidor estaba apagado la noche del respaldo, se hace en cuanto vuelve a encenderse
  (cuando el último tiene más de 8 días). Al instalar por primera vez se hace uno de inmediato.
- Si un respaldo falla, se reintenta a las 6 horas.
- El respaldo no detiene ni bloquea la aplicación (instantánea consistente de MySQL).
- Cada respaldo queda en el registro de auditoría: `backup.completed` (con tamaño y cabeza de la
  cadena) o `backup.failed` (con el paso que falló). Consulte Administración → Auditoría,
  filtrando por acción.
- Los respaldos usan una cuenta de MySQL propia (`BACKUP_DB_USER`, por defecto
  `digaipe_respaldo`): puede leer la base para respaldarla y anotar eventos `backup.*`, nada más.
  No puede modificar datos ni triggers. El servicio de respaldos no conoce la contraseña de root;
  la restauración (servicio `restore`) sí la usa.

Cada respaldo es una carpeta `digaipe-<fecha UTC>` con:

| Archivo | Contenido |
|---|---|
| `digaipe.sql.gz` | Todos los datos, incluido el registro de auditoría, y los procedimientos. **No** los triggers: `setup` los reconstruye desde las migraciones (ver sección 3) |
| `uploads/` | Archivos de admisiones cargados |
| `MANIFEST` | Fecha, versión de MySQL y la cabeza de la cadena de auditoría en ese momento |
| `SHA256SUMS` | Hash de cada archivo; la restauración se niega si no coinciden |

**Los respaldos contienen datos de estudiantes, hashes de contraseñas y sesiones.** Guárdelos con
el mismo cuidado que la base de datos. No cambie el nombre de las carpetas: la antigüedad se lee
del nombre, y una carpeta con otro nombre nunca se cuenta ni se borra.

### Revisión semanal (5 minutos)

1. `docker compose logs --tail 20 backup-worker`: debe decir `Backup finished.`
2. En Auditoría, la acción `backup.completed` debe tener un evento de los últimos 7 días, y
   ningún `backup.failed` sin atender.
3. Copie la carpeta del respaldo más reciente a un medio fuera del servidor (disco externo,
   carpeta compartida de otra PC). **Un respaldo en el mismo disco que la base de datos se pierde
   junto con ella.**

### Respaldo manual (por ejemplo, antes de una actualización)

```sh
docker compose --profile ops run --rm backup
```

## 2. Antes de restaurar: decidir

**Restaurar devuelve el sistema al momento del respaldo. Todo lo posterior se pierde** de la
base activa: admisiones cargadas, planillas generadas, revisiones, usuarios creados y los eventos
de auditoría de ese periodo. Todos los usuarios tendrán que iniciar sesión de nuevo.

Restaure solo cuando la base de datos está dañada o se perdió, o por decisión documentada ante un
incidente. Para *consultar* datos antiguos no restaure: vea la sección 6.

1. **Registre el incidente**: qué pasó, quién autoriza la restauración, fecha y hora.
2. **Elija el respaldo**: el más reciente anterior al problema.

   ```sh
   ls backups/
   cat backups/digaipe-20261028T060000Z/MANIFEST
   ```

3. **Avise a los usuarios**: el sistema estará detenido durante la restauración (minutos).

## 3. Restaurar

Reemplace `digaipe-20261028T060000Z` por el nombre elegido en todos los comandos.

```sh
# 1. Detener la aplicación y el respaldo automático (la base queda en marcha)
docker compose stop app backup-worker

# 2. Restaurar. Verifica SHA256SUMS, hace un respaldo de seguridad del estado actual,
#    reemplaza la base de datos y los archivos, y comprueba la cabeza de la cadena.
docker compose --profile ops run --rm -e RESTORE_CONFIRM=digaipe-20261028T060000Z \
  restore /scripts/restore.sh digaipe-20261028T060000Z

# 3. OBLIGATORIO antes de arrancar: reconstruye los triggers de auditoría (los respaldos no
#    los traen), aplica migraciones y vuelve a dar permisos a las cuentas de MySQL.
#    Debe decir "Recreated 35 missing ... trigger(s)" (o el número de triggers vigente).
docker compose run --rm setup

# 4. Verificar la cadena de auditoría y que estén todos los triggers
docker compose --profile ops run --rm audit verify

# 5. Arrancar
docker compose start app backup-worker
```

Después de arrancar:

- Inicie sesión con un administrador y abra Admisiones y Auditoría.
- En Auditoría deben aparecer `backup.restored` y, justo después, `schema.triggers_repaired`
  (los triggers reconstruidos por `setup`). `backup.restored` indica qué respaldo se restauró, la
  cabeza anterior y el nombre del **respaldo de seguridad**, que es la única copia de lo que se
  perdió. Anote ese nombre en el registro del incidente y no lo borre.
- Fuera de una restauración, un `schema.triggers_repaired` significa que alguien borró o cambió
  un trigger de auditoría: trátelo como incidente.
- Si usa anclas de auditoría, `verify --anchors` marcará como faltantes las anclas posteriores al
  respaldo restaurado. Es esperado: el evento `backup.restored` y el respaldo de seguridad lo
  documentan. Registre esa salida en el incidente.

### Si el paso 2 se niega o falla

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| `Re-run with RESTORE_CONFIRM=…` | Falta la confirmación o no coincide con el nombre | Repita con el nombre exacto |
| `./digaipe.sql.gz: FAILED` | El respaldo está dañado o fue modificado | **No lo use.** Elija el anterior; registre el hallazgo |
| Falla en "Safety backup of the current state" | La base actual está demasiado dañada para respaldarla | Repita agregando `-e SKIP_SAFETY_BACKUP=1`. Lo posterior al respaldo se pierde definitivamente |
| `Audit head … does not match MANIFEST` | La base quedó cargada, pero no con la cadena esperada | No arranque la app. Restaure de nuevo el respaldo de seguridad (nombre en la salida del paso 2) y escale |
| `verify` dice `audit triggers missing` | No se ejecutó el paso 3 (`setup`) o falló | Ejecute el paso 3 y revise su salida; no arranque la app sin triggers |
| Falla a mitad de la carga | La base puede haber quedado vacía o incompleta | Vuelva a ejecutar el paso 2 con el mismo respaldo; si persiste, restaure el respaldo de seguridad |

## 4. Recuperar en un servidor nuevo

Si el servidor se perdió por completo:

1. Instale Docker e importe las imágenes (`deploy/README.md`, pasos 1 y 2), con el mismo
   `deploy/.env` (las mismas contraseñas) si lo conserva.
2. Copie la carpeta del respaldo a `BACKUP_DIR` en el servidor nuevo.
3. `docker compose up -d db` (solo la base) y espere a que esté `healthy` (`docker compose ps`).
4. Siga la sección 3 desde el paso 2, agregando `-e SKIP_SAFETY_BACKUP=1` (no hay nada que
   respaldar).
5. Exporte la raíz del certificado HTTPS nuevo e instálela en las PCs (`deploy/README.md`,
   sección 3), salvo que también haya conservado el volumen `digaipe_caddy-data`.

## 5. Simulacro de restauración

Un respaldo que nunca se restauró no está comprobado. Al menos una vez por periodo académico,
haga la sección 4 completa en un equipo aparte (no en el servidor de producción), con el respaldo
más reciente, y compruebe que puede iniciar sesión y ver las últimas admisiones. Registre fecha,
respaldo usado y resultado.

## 6. Consultar un respaldo sin restaurar

Para revisar datos de una fecha pasada sin tocar la base activa, cargue el respaldo en una base
aparte (no copia archivos, no cambia la base `digaipe`; esa copia no tiene triggers, así que no
la use para trabajar, solo para consultar):

```sh
docker compose --profile ops run --rm restore -c '
  export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
  mysql -h db -uroot -e "CREATE DATABASE digaipe_consulta"
  gzip -dc /backups/digaipe-20261028T060000Z/digaipe.sql.gz | mysql -h db -uroot digaipe_consulta'
```

Consulte con la cuenta de solo lectura o con root y, al terminar, bórrela:

```sh
docker compose --profile ops run --rm restore -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h db -uroot -e "DROP DATABASE digaipe_consulta"'
```
