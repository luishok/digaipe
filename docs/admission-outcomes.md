# Modalidades alternativas y cierre de procesos

Una asignación corresponde a **estudiante + carrera + proceso/documento**. Puede tener varias
ofertas de admisión, una por modalidad. Solo una puede tener matrícula. Otras carreras o procesos
del mismo estudiante siguen siendo independientes.

## Uso

- **Carga de admisiones:** distintas modalidades se aceptan con advertencia. Una fila repetida
  dentro del archivo sigue siendo un error. Una admisión ya guardada con los mismos datos de
  asignación se omite y se informa; una con datos de asignación distintos impide guardar el lote.
  Los datos de una admisión existente y su lote original no se sobrescriben.
  Las cédulas se resuelven por identidad normalizada: `V-12345678`, `V 12345678` y `V012345678`
  identifican al mismo estudiante. La nacionalidad V/E es obligatoria y no se admiten letras dentro
  del número. La carga nunca modifica el perfil de un estudiante existente. Si difieren nombre,
  teléfono, correo o género, se advierte y se conservan los datos registrados. En un archivo nuevo,
  la primera fila inicializa el perfil; las modalidades posteriores tampoco lo sobrescriben.
- **Generación de planillas:** se advierte si hay modalidades alternativas. Cuando ya se eligió
  una matrícula, las demás dejan de estar disponibles para generar planilla.
  Se conserva el número institucional de planilla. La pantalla y el PDF incluyen además una
  **Referencia de admisión ADM-id** que distingue las ofertas aunque compartan ese número.
- **Revisión:** se muestra la modalidad. Matricular una oferta excluye las demás, incluso si
  nunca generaron planilla. No se pueden matricular dos modalidades del mismo grupo en un lote.
  Para corregir una matrícula se usa **Anular matrícula y desbloquear**, con motivo; luego se
  matricula la oferta correcta. Las reglas existentes para revisar un Devuelto siguen aplicando.
- **Admisiones:** el filtro Resultado permite buscar matriculados, no matriculados y pendientes,
  incluidos quienes nunca generaron planilla. Se muestra el motivo del resultado.
- **Procesos:** después de la última fecha activa, un administrador puede **Cerrar proceso**
  con motivo. No se cierra automáticamente al terminar las fechas ni al deshabilitarlo. El cierre
  impide nuevas cargas, revisión, desbloqueo, fechas y generación de planillas hasta reabrirlo.
- **Reportes y estadísticas:** elegir **Matriculados / no matriculados por proceso**, seleccionar
  uno o más procesos y generar la vista previa, CSV o PDF. Incluye todas sus asignaciones y no
  usa filtros de fecha de procesamiento. **Reconciliación** también cuenta asignaciones únicas,
  muestra las ofertas por separado y nunca cuenta una alternativa descartada como no procesada.
  General, Consolidado y Estadísticas también agrupan por asignación antes de filtrar; una oferta
  descartada no vuelve a aparecer como pendiente o devuelta. Se muestran asignaciones y ofertas
  por separado. Los modos de revisión incluyen únicamente asignaciones con trámite registrado.
  En su matriz por modalidad, una asignación sin matrícula con varias ofertas se muestra en
  «Varias modalidades»; si tiene matrícula se atribuye a la modalidad elegida. Los filtros de
  modalidad y período se aplican después de resolver la selección. La cohorte por asignación usa
  la fecha de la oferta elegida si tiene matrícula, o la primera del grupo si no tiene selección;
  por DIGAIPE usa la fecha de la planilla representativa (elegida,
  pendiente o devuelta). Las devoluciones históricas consideran todas las ofertas del grupo.
- **Informes oficiales de cierre:** se guarda una versión inmutable con todos los resultados,
  nombres y modalidades de ese momento y su SHA-256. Puede consultarse y exportarse desde
  Estadísticas y desde el proceso. Una reapertura conserva las versiones anteriores; el siguiente
  cierre genera una nueva. El PDF/CSV se genera desde esos datos guardados, no desde datos actuales.

Sin selección y con el proceso abierto, la asignación está pendiente. Al cerrar pasa a
**No matriculado**, con motivo: sin trámite registrado, trámite incompleto o documentación
devuelta. Se conserva el estado de procesamiento original. Una oferta descartada por otra
modalidad se muestra como **No matriculado — otra modalidad seleccionada**, sin contarla como
otra asignación sin matrícula en el resumen departamental.

Ejemplo: 100 asignaciones, 115 ofertas por modalidades y 70 matrículas representan **30
asignaciones sin matrícula**. Los cupos disponibles necesitan además el cupo autorizado;
no se calculan contando modalidades descartadas. Las personas únicas se muestran aparte de las
asignaciones porque una persona puede tener asignaciones a distintas carreras/procesos.

## Migración 0007

- Agrega el índice único de estudiante/carrera/proceso/modalidad **antes** de retirar el anterior.
- Agrega `admission_selections`, con una selección por grupo y una clave foránea compuesta que
  garantiza que la admisión elegida pertenezca al mismo grupo.
- Copia las matrículas existentes desde `admission_processings`, preservando fecha/actor nulos
  cuando no se conocen. No cambia IDs, filas de admisiones ni historial de procesamiento.
- Agrega metadatos de cierre nulos: los procesos históricos requieren revisión y cierre explícito.
- Agrega informes de cierre inmutables y auditoría de selecciones/cierres.
- Agrega `acquire_audit_lock`, un procedimiento con permisos del propietario para adquirir el
  bloqueo de auditoría. La aplicación recibe EXECUTE; no recibe permiso para modificar la cadena.
  Las transacciones auditadas adquieren ese bloqueo antes de los bloqueos de negocio para evitar
  ciclos de bloqueo entre importaciones, revisión y cierre.

No se ejecuta esta migración con `db:push`, no se edita una migración ya aplicada y no se usa
`db:rebuild:dev` ni `compose down -v` en producción. Las alternativas rechazadas anteriormente
deben cargarse de nuevo; los registros ya existentes se omiten.

## Actualización en Podman

La migración **0008_student_identity** agrega una clave generada de identidad y su índice único
en una sola sentencia ALTER. Conserva la cédula original y todos los IDs. Rechaza atómicamente
identidades inválidas o dos estudiantes que representen la misma cédula normalizada. No fusiona
estudiantes ni sus matrículas. Antes de migrar, `setup` y `npm run db:migrate` ejecutan una revisión
de solo lectura; también puede ejecutarse por separado con `npm run db:check-identities`. Si hay
conflictos, informa los IDs para revisión y detiene el despliegue. No elimine ni fusione estos
registros sin revisar sus admisiones, selecciones e historial de auditoría.

Preparar imágenes **app y setup de la misma versión**. Antes de producción, restaurar un respaldo
en una instalación aislada con la **misma versión MySQL 8.4 de producción** y ensayar la actualización.
Las pruebas locales de este cambio utilizan el MySQL disponible en la máquina; no sustituyen ese ensayo.

Comprobar en la copia que `SHOW CREATE TABLE admissions` corresponde al esquema esperado y que
la cantidad de matrículas por estudiante/carrera/proceso no excede uno:

```sql
SELECT a.student_id, a.career_id, a.proceso_id, COUNT(*) AS matriculas
FROM admissions a
JOIN admission_processings p ON p.admission_id = a.id
WHERE p.status = 'matriculado'
GROUP BY a.student_id, a.career_id, a.proceso_id
HAVING COUNT(*) > 1;
```

La consulta debe devolver cero filas. Registrar también los conteos de `admissions`, `students`
y `admission_processings` para compararlos después de migrar.

En una ventana de mantenimiento, desde `deploy/` y con las imágenes nuevas disponibles:

```sh
podman compose stop app backup-worker
podman compose --profile ops run --rm backup
# Comprobar que el respaldo terminó correctamente y conservarlo fuera del servidor.
# Ajustar DIGAIPE_VERSION en deploy/.env a las imágenes nuevas.
podman compose run --rm setup
podman compose --profile ops run --rm audit verify
```

Si setup falla, **no iniciar la app** ni repetir operaciones SQL manuales sin inspeccionar lo
aplicado. MySQL confirma los cambios de esquema por sentencia; una migración de varias sentencias
no tiene rollback transaccional completo. Comparar conteos y verificar las selecciones migradas:

```sql
SELECT COUNT(*) AS matriculas_sin_seleccion
FROM admission_processings p
LEFT JOIN admission_selections s ON s.admission_id = p.admission_id
WHERE p.status = 'matriculado' AND s.admission_id IS NULL;
```

Debe devolver cero. Después:

```sh
podman compose up -d app backup-worker
```

Comprobar inicio de sesión, consulta de una matrícula existente, carga con alternativas,
rechazo de una segunda matrícula y consulta de no procesados. No cerrar procesos históricos
automáticamente: revisar cada uno antes de emitir su primer informe oficial.

Una vez aceptadas ofertas alternativas, no se puede restaurar el índice antiguo sin resolver
esas filas. Evitar regresar a una app anterior que desconoce las selecciones. Si se necesita
restaurar el respaldo, coordinar base de datos, archivos cargados y versión de la aplicación;
las escrituras posteriores al respaldo no estarán en él.

## Validación local

```sh
npm run test:admissions
npm run test:admissions:db
npm run test:admissions:db -- --browser
npm run test:admissions:db -- --browser --screenshots
npm run test:admissions:db -- --browser --statistics-pdfs
npm run test:statistics
npm run test:permissions
npm run test:csv
npm run check
npm run build
```

La integración toma las credenciales locales de `DATABASE_URL`, rechaza servidores remotos,
crea bases desechables `digaipe_admission_test_*` y una cuenta temporal con los permisos reales
de despliegue. Las elimina al terminar. Nunca utiliza ni migra la base indicada originalmente
en esa URL. Cubre instalación nueva, actualización con datos, importación/reimportación,
matrícula concurrente, cierre concurrente, informes inmutables, auditoría y exportaciones.
La opción `--browser` usa Chrome instalado para comprobar las pantallas con datos ficticios.
La opción `--screenshots` guarda una galería de operaciones exitosas y errores en
`artifacts/admission-review/index.html`. La evidencia incluye capturas de Chrome y PDF reales
renderizados con PyMuPDF. Nunca utiliza datos de estudiantes reales.
La opción `--statistics-pdfs` descarga los cinco tipos de reporte a través de las rutas reales
de la aplicación, verifica texto y márgenes de los PDF, cierra el proceso de prueba desde la UI
y guarda el informe oficial, el listado de no matriculados y una guía PDF del cierre en
`artifacts/statistics-review/`. El proceso ficticio tiene 111 asignaciones y 122 ofertas; después
del cierre conserva 2 matriculados, 109 no matriculados y ningún pendiente de matrícula.
