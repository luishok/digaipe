<script lang="ts">
	import { resolve } from '$app/paths';
	import { parseRoles, ROLE_LABELS, can, type Role } from '$lib/permissions';

	let { data } = $props();

	const userRoles = $derived(parseRoles(data.user?.role));
	const isAdmin = $derived(userRoles.includes('admin'));

	// Role filter: 'all' or specific role
	let activeRoleTab = $state<string>('all');
	let searchQuery = $state('');

	// Accordion state for modules
	let openModules = $state<Record<string, boolean>>({
		planillas: true,
		revision: false,
		carga: false,
		procesos: false,
		estadisticas: false,
		catalogos: false,
		admin: false,
		auditoria: false
	});

	function toggleModule(id: string) {
		openModules[id] = !openModules[id];
	}

	function expandAll() {
		for (const key of Object.keys(openModules)) {
			openModules[key] = true;
		}
	}

	function collapseAll() {
		for (const key of Object.keys(openModules)) {
			openModules[key] = false;
		}
	}

	// Modules specification with permissions and roles
	type ModuleDoc = {
		id: string;
		title: string;
		icon: string;
		route: string;
		roles: Role[];
		description: string;
		canAccess: boolean;
		steps: {
			title: string;
			description: string;
			tips?: string;
		}[];
		faqs?: {
			q: string;
			a: string;
		}[];
	};

	const modules = $derived<ModuleDoc[]>([
		{
			id: 'planillas',
			title: 'Generación de Planillas',
			icon: '📄',
			route: '/digaipe/generacion-planilla',
			roles: ['planillas', 'admin'],
			description: 'Búsqueda de aspirantes en procesos activos hoy, verificación de identidad, actualización de datos de contacto y emisión de la planilla de inscripción oficial en PDF.',
			canAccess: can(data.user, 'planillas.view'),
			steps: [
				{
					title: '1. Localizar al aspirante activo hoy',
					description: 'Accede a "Admisiones > Generación de Planilla". En la barra de búsqueda superior introduce la cédula o los apellidos del estudiante. Pulsa "Buscar". Solo se listan aspirantes de procesos cuya fecha de atención esté activa el día de hoy.',
					tips: 'Si el estudiante no aparece, verifica en "Procesos de Admisión" que el proceso tenga la fecha de hoy configurada o consulta con el encargado de carga.'
				},
				{
					title: '2. Abrir el detalle o modal de planilla',
					description: 'Haz clic sobre la fila correspondiente al aspirante en la tabla o pulsa el enlace "Seleccionar". Se abrirá el modal interactivo con los datos del aspirante o podrás ir a su página de detalle.'
				},
				{
					title: '3. Validar y corregir datos personales',
					description: 'Verifica los nombres, teléfono, correo electrónico y género. Si el aspirante indica alguna corrección, modifícala en los campos editables y pulsa "Guardar datos" para actualizar la base de datos institucional.'
				},
				{
					title: '4. Generar o Reimprimir la planilla oficial',
					description: 'Pulsa el botón "Generar Planilla". El sistema generará el PDF oficial en una nueva pestaña listo para imprimir. Si el aspirante ya fue atendido previamente, el botón mostrará automáticamente "Reimprimir Planilla".'
				}
			],
			faqs: [
				{
					q: '¿Por qué un aspirante aparece deshabilitado o no deja generar?',
					a: 'Un proceso cerrado o desactivado no permite emisión de planillas. Debe estar activo y habilitado.'
				},
				{
					q: '¿Qué pasa si el aspirante tiene varias modalidades de admisión?',
					a: 'El sistema consolida las alternativas. Al seleccionar la modalidad procesada, las otras quedan como modalidades alternativas no seleccionadas.'
				}
			]
		},
		{
			id: 'revision',
			title: 'Revisión de Documentos y Matrícula',
			icon: '✅',
			route: '/digaipe/revision-documentos',
			roles: ['revisor', 'admin'],
			description: 'Recepción y cotejo de recaudos físicos presentados por el aspirante con planilla generada. Decisión formal de Matricular o Devolver el trámite.',
			canAccess: can(data.user, 'documents.view'),
			steps: [
				{
					title: '1. Buscar y filtrar aspirantes con planilla',
					description: 'Ingresa a "Admisiones > Revisión de Documentos". Utiliza los filtros superiores para ubicar por cédula, proceso, estado (Pendiente, Matriculado, Devuelto) o rango de fechas.'
				},
				{
					title: '2. Verificar los recaudos físicos',
					description: 'Compara detalladamente los documentos físicos que entrega el aspirante con los datos registrados en pantalla (título, notas, cédula, partida de nacimiento, planilla impresa).'
				},
				{
					title: '3. Seleccionar aspirantes y tomar decisión',
					description: 'Marca la casilla de selección en la fila del aspirante (o varias casillas si procesas por lotes). En la barra de decisión inferior selecciona "Matricular" o "Devolver".'
				},
				{
					title: '4. Devolución (en caso de recaudos incompletos)',
					description: 'Si faltan documentos o hay inconsistencias, selecciona "Devolver" e ingresa obligatoriamente el motivo detallado en el campo de texto (ej. "Falta fondo negro del título"). Luego pulsa "Guardar decisión".'
				},
				{
					title: '5. Desbloqueo (corrección extraordinaria)',
					description: 'Si cometiste un error o el estudiante devuelto subsanó sus recaudos, utiliza el botón "Desbloquear" para regresar su estado a "Pendiente" y reconsiderar la admisión.'
				}
			],
			faqs: [
				{
					q: '¿Se puede matricular a un estudiante sin planilla generada?',
					a: 'No. El flujo estricto de DIGAIPE requiere que primero se genere la planilla para que el aspirante pase a estado pendiente de revisión.'
				}
			]
		},
		{
			id: 'carga',
			title: 'Carga de Admisiones (Lotes)',
			icon: '📤',
			route: '/digaipe/admisiones/cargar',
			roles: ['cargador', 'admin'],
			description: 'Importación masiva de listados de aspirantes asignados mediante archivos de texto/hojas de cálculo. Control de duplicados, validación de procesos y previsualización de errores.',
			canAccess: can(data.user, 'admissions.upload'),
			steps: [
				{
					title: '1. Asegurar la existencia previa del proceso',
					description: 'Antes de cargar un listado, el proceso de admisión (ej. ".UA047/26-04-13") DEBE estar creado y registrado previamente en el sistema. De lo contrario, la carga será rechazada.'
				},
				{
					title: '2. Seleccionar el archivo de asignados',
					description: 'Dirígete a "Admisiones > Gestión de Aspirantes" y pulsa "Cargar admisiones", o ve a "Admisiones > Documentos cargados > Cargar lote". Arrastra o selecciona el archivo CSV/TXT con el listado oficial.'
				},
				{
					title: '3. Revisión del borrador y validación de columnas',
					description: 'El sistema analiza la estructura, identificadores de estudiantes y carreras. Mostrará un resumen con el total de filas válidas, avisos y errores si alguna carrera o código no coincide.'
				},
				{
					title: '4. Confirmar y guardar el lote definitivo',
					description: 'Si la previsualización es correcta, pulsa "Guardar lote". Las admisiones se incorporarán al sistema y quedarán disponibles para ser atendidas en las fechas fijadas.'
				}
			],
			faqs: [
				{
					q: '¿Qué ocurre si un lote se cargó por error?',
					a: 'Los administradores pueden descartar o eliminar lotes que se encuentren en estado de borrador antes de su consolidación final.'
				}
			]
		},
		{
			id: 'procesos',
			title: 'Procesos de Admisión y Calendario',
			icon: '🗓️',
			route: '/digaipe/procesos-adm',
			roles: ['cargador', 'admin'],
			description: 'Creación de procesos de admisión, asignación de fechas de atención presencial/registro y control de apertura o cierre oficial.',
			canAccess: can(data.user, 'processes.view'),
			steps: [
				{
					title: '1. Crear nuevo proceso',
					description: 'En "Admisiones > Procesos de Admisión", escribe en el formulario izquierdo el código oficial del proceso (ej. ".UA048/26-05-15") y pulsa "Crear".'
				},
				{
					title: '2. Asignar fechas activas',
					description: 'Selecciona una fecha en el calendario y pulsa "+". Puedes agregar tantos días como dure el proceso. Al terminar la lista de días, haz clic en "Guardar Fechas".'
				},
				{
					title: '3. Cerrar un proceso finalizado (Exclusivo cierre)',
					description: 'Una vez transcurrida la última fecha activa, en la tabla de procesos aparecerá el botón "Cerrar proceso". Ingresa el motivo formal del cierre y confirma. Esto congela los resultados oficiales de matrícula y genera un informe oficial con firma criptográfica SHA-256.'
				},
				{
					title: '4. Activar o Desactivar temporalmente',
					description: 'Si se requiere pausar la atención sin cerrar el proceso, usa el botón "Desactivar" indicando el motivo.'
				}
			]
		},
		{
			id: 'estadisticas',
			title: 'Estadísticas y Reportes Oficiales',
			icon: '📊',
			route: '/digaipe/estadisticas',
			roles: ['estadisticas', 'admin'],
			description: 'Generación dinámica de reportes consolidados, embudo de reconciliación, cálculo de matrícula y consulta de informes oficiales de cierre inmutables.',
			canAccess: can(data.user, 'statistics.view'),
			steps: [
				{
					title: '1. Seleccionar el Tipo de Reporte',
					description: 'En el módulo "Estadísticas", escoge entre: Análisis general (datos en bruto), Consolidado de revisión, Estadísticas multidimensionales, Reconciliación (embudo de retención) o Matriculados por proceso.'
				},
				{
					title: '2. Definir rango de fechas y filtros',
					description: 'Escoge la base de fecha (Fecha de asignación origen o Fecha válida DIGAIPE). Selecciona "Desde" y "Hasta", o utiliza los botones de rangos rápidos ("Hoy", "Últimos 7 días", "Este mes", "Este año").'
				},
				{
					title: '3. Configurar filtros avanzados y opciones',
					description: 'En el acordeón de Filtros Avanzados puedes segmentar por facultad, proceso, modalidad, carreras específicas o buscar palabras clave.'
				},
				{
					title: '4. Generar y exportar',
					description: 'Pulsa "Generar Vista Previa" para explorar las tablas y tarjetas KPI en pantalla, o exporta directamente con los botones "PDF" o "CSV".'
				},
				{
					title: '5. Consultar informes oficiales de cierre',
					description: 'Despliega la sección "Informes oficiales de cierre" para acceder a las versiones históricas inmutables de los procesos concluidos con su verificación SHA-256.'
				}
			]
		},
		{
			id: 'catalogos',
			title: 'Parámetros (Carreras y Modalidades)',
			icon: '⚙️',
			route: '/digaipe/carreras',
			roles: ['cargador', 'admin'],
			description: 'Mantenimiento del catálogo maestro de carreras universitarias, programas académicos, núcleos, facultades y modalidades de admisión reconocidas.',
			canAccess: can(data.user, 'catalogs.view'),
			steps: [
				{
					title: '1. Administrar Carreras',
					description: 'Accede a "Parámetros > Carreras". Puedes buscar por código, programa o facultad. Los usuarios autorizados pueden registrar nuevas carreras con el botón "Agregar Carrera" o cargar el catálogo masivo en CSV.'
				},
				{
					title: '2. Administrar Modalidades de Admisión',
					description: 'En "Parámetros > Modalidades de Admisión", visualiza los códigos (ej. CV, AR, OPSU) y sus descripciones completas. Utiliza "Agregar Modalidad" para incluir nuevos mecanismos de ingreso.'
				}
			]
		},
		{
			id: 'admin',
			title: 'Administración de Usuarios y Roles',
			icon: '👥',
			route: '/digaipe/admin/roles',
			roles: ['admin'],
			description: 'Gestión integral de cuentas de usuario, asignación de perfiles funcionales con permisos estrictos y revocación de accesos.',
			canAccess: can(data.user, 'users.manage'),
			steps: [
				{
					title: '1. Crear una nueva cuenta',
					description: 'En "Administración > Usuarios y roles", completa el nombre completo, correo institucional único y una contraseña segura inicial.'
				},
				{
					title: '2. Asignar roles con principio de menor privilegio',
					description: 'Marca únicamente las casillas correspondientes a las funciones que el usuario desempeñará (Generación de planillas, Revisión, Carga, Estadísticas o Auditor). Pulsa "Agregar usuario".'
				},
				{
					title: '3. Modificar o revocar permisos',
					description: 'En la lista inferior de usuarios registrados, ajusta las casillas de roles según cambios de personal o elimina cuentas obsoletas.'
				}
			]
		},
		{
			id: 'auditoria',
			title: 'Auditoría y Trazabilidad del Sistema',
			icon: '🔍',
			route: '/digaipe/admin/audit',
			roles: ['auditor', 'admin'],
			description: 'Registro criptográficamente encadenado de todas las operaciones realizadas en el sistema (inicios de sesión, emisiones de planilla, cambios de estado, exportaciones y vistas de datos sensibles).',
			canAccess: can(data.user, 'audit.view'),
			steps: [
				{
					title: '1. Acceder al libro mayor de auditoría',
					description: 'Entra a "Administración > Auditoría". Se mostrará el historial secuencial de eventos con sello de tiempo UTC.'
				},
				{
					title: '2. Filtrar por tipo de evento o usuario',
					description: 'Filtra por acción (ej. "admission_document.reviewed", "auth.sign_in_succeeded"), usuario actuante, entidad o intervalo de fechas.'
				},
				{
					title: '3. Inspeccionar integridad y diferencias',
					description: 'Haz clic en un evento para revisar el estado previo (`before`) y posterior (`after`), dirección IP, agente de usuario y los hashes de la cadena de bloques.'
				},
				{
					title: '4. Exportar bitácora oficial',
					description: 'Indica un rango "Desde" y "Hasta" para descargar hasta 10.000 eventos en formato JSONL/CSV para inspecciones institucionales.'
				}
			]
		}
	]);

	// Filter modules according to active role tab and search query
	const filteredModules = $derived(
		modules.filter((m) => {
			// Role tab match
			const matchesRole =
				activeRoleTab === 'all'
					? true
					: activeRoleTab === 'my_roles'
						? m.roles.some((r) => userRoles.includes(r))
						: m.roles.includes(activeRoleTab as Role);

			// Search query match
			const query = searchQuery.trim().toLowerCase();
			const matchesSearch =
				!query ||
				m.title.toLowerCase().includes(query) ||
				m.description.toLowerCase().includes(query) ||
				m.steps.some((s) => s.title.toLowerCase().includes(query) || s.description.toLowerCase().includes(query));

			return matchesRole && matchesSearch;
		})
	);
</script>

<svelte:head>
	<title>Centro de Ayuda y Guía de Módulos - DIGAIPE</title>
</svelte:head>

<div class="help-container">
	<!-- Hero Header -->
	<header class="help-header">
		<div class="header-badges">
			<span class="badge-system">DIGAIPE · Sistema de Admisiones</span>
			{#if userRoles.length}
				<div class="user-roles-chips">
					<span class="roles-intro">Tus roles activos:</span>
					{#each userRoles as role (role)}
						<span class="role-chip my-role">{ROLE_LABELS[role] ?? role}</span>
					{/each}
				</div>
			{/if}
		</div>

		<h1>Centro de Ayuda e Instrucciones por Módulo</h1>
		<p class="header-desc">
			Guía paso a paso y manual interactivo del sistema. Consulta el flujo de trabajo correspondiente a tus permisos asignados o explora las instrucciones detalladas de cada módulo.
		</p>

		<!-- Search and Role Filter Bar -->
		<div class="filter-controls-card">
			<div class="search-box">
				<span class="search-icon">🔍</span>
				<input
					type="search"
					placeholder="Buscar instrucción, paso o módulo (ej. planilla, matricular, lote, filtros)..."
					bind:value={searchQuery}
					aria-label="Buscar en la ayuda"
				/>
				{#if searchQuery}
					<button class="clear-search-btn" type="button" onclick={() => (searchQuery = '')}>✕</button>
				{/if}
			</div>

			<div class="roles-tabs-row">
				<span class="tabs-label">Filtrar por rol:</span>
				<div class="tabs-scroll">
					<button
						type="button"
						class="tab-btn {activeRoleTab === 'all' ? 'active' : ''}"
						onclick={() => (activeRoleTab = 'all')}
					>
						Todos los módulos ({modules.length})
					</button>

					{#if userRoles.length}
						<button
							type="button"
							class="tab-btn highlight {activeRoleTab === 'my_roles' ? 'active' : ''}"
							onclick={() => (activeRoleTab = 'my_roles')}
						>
							⭐ Mis módulos habilitados
						</button>
					{/if}

					<button
						type="button"
						class="tab-btn {activeRoleTab === 'planillas' ? 'active' : ''}"
						onclick={() => (activeRoleTab = 'planillas')}
					>
						Generación de planillas
					</button>

					<button
						type="button"
						class="tab-btn {activeRoleTab === 'revisor' ? 'active' : ''}"
						onclick={() => (activeRoleTab = 'revisor')}
					>
						Matrícula y devolución
					</button>

					<button
						type="button"
						class="tab-btn {activeRoleTab === 'cargador' ? 'active' : ''}"
						onclick={() => (activeRoleTab = 'cargador')}
					>
						Carga de admisiones
					</button>

					<button
						type="button"
						class="tab-btn {activeRoleTab === 'estadisticas' ? 'active' : ''}"
						onclick={() => (activeRoleTab = 'estadisticas')}
					>
						Estadísticas
					</button>

					<button
						type="button"
						class="tab-btn {activeRoleTab === 'auditor' ? 'active' : ''}"
						onclick={() => (activeRoleTab = 'auditor')}
					>
						Auditor
					</button>

					{#if isAdmin}
						<button
							type="button"
							class="tab-btn admin-tab {activeRoleTab === 'admin' ? 'active' : ''}"
							onclick={() => (activeRoleTab = 'admin')}
						>
							Administrador
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Global Expand/Collapse -->
		<div class="view-actions">
			<span class="modules-counter">
				Mostrando <strong>{filteredModules.length}</strong> de {modules.length} módulos
			</span>
			<div class="expand-buttons">
				<button type="button" class="btn-text-action" onclick={expandAll}>Expandir todos</button>
				<span class="action-sep">·</span>
				<button type="button" class="btn-text-action" onclick={collapseAll}>Colapsar todos</button>
			</div>
		</div>
	</header>

	<!-- Modules List -->
	<main class="modules-list">
		{#if filteredModules.length === 0}
			<div class="empty-state">
				<span class="empty-icon">🔎</span>
				<h3>No se encontraron instrucciones</h3>
				<p>No hay módulos que coincidan con la búsqueda "{searchQuery}" para el filtro seleccionado.</p>
				<button type="button" class="btn-reset" onclick={() => { searchQuery = ''; activeRoleTab = 'all'; }}>
					Restablecer filtros
				</button>
			</div>
		{:else}
			{#each filteredModules as m (m.id)}
				<article class="module-card {m.canAccess ? 'can-access' : 'no-access'}">
					<!-- Module Header (Clickable Accordion) -->
					<div
						class="module-header"
						role="button"
						tabindex="0"
						onclick={() => toggleModule(m.id)}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModule(m.id); } }}
					>
						<div class="header-left">
							<span class="module-icon">{m.icon}</span>
							<div class="title-wrap">
								<div class="title-row">
									<h2>{m.title}</h2>
									{#if m.canAccess}
										<span class="access-pill available">Habilitado para ti</span>
									{:else}
										<span class="access-pill restricted">Requiere rol</span>
									{/if}
								</div>
								<p class="module-desc">{m.description}</p>
							</div>
						</div>

						<div class="header-right">
							<div class="module-roles-list">
								<span class="roles-title">Roles:</span>
								{#each m.roles as role (role)}
									<span class="role-badge {userRoles.includes(role) ? 'is-user-role' : ''}">
										{ROLE_LABELS[role] ?? role}
									</span>
								{/each}
							</div>
							<span class="toggle-indicator {openModules[m.id] ? 'open' : ''}">
								{openModules[m.id] ? '▲' : '▼'}
							</span>
						</div>
					</div>

					<!-- Module Body: Step-by-Step Instructions -->
					{#if openModules[m.id]}
						<div class="module-body">
							<!-- Direct Access Button if user has permission -->
							{#if m.canAccess}
								<div class="direct-link-bar">
									<span>¿Deseas acceder ahora?</span>
									<a href={resolve(m.route as any)} class="btn-goto-module">
										Ir al módulo {m.title} →
									</a>
								</div>
							{/if}

							<h3 class="steps-heading">📋 Procedimiento Paso a Paso</h3>
							<div class="steps-timeline">
								{#each m.steps as step, idx (step.title)}
									<div class="step-card">
										<div class="step-num">{idx + 1}</div>
										<div class="step-content">
											<h4 class="step-title">{step.title}</h4>
											<p class="step-desc">{step.description}</p>
											{#if step.tips}
												<div class="step-tip">
													<span class="tip-icon">💡</span>
													<span><strong>Consejo:</strong> {step.tips}</span>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>

							<!-- FAQ section if available -->
							{#if m.faqs && m.faqs.length}
								<div class="faq-section">
									<h4>Preguntas Frecuentes y Situaciones Especiales</h4>
									<div class="faq-list">
										{#each m.faqs as faq (faq.q)}
											<div class="faq-item">
												<strong class="faq-q">❓ {faq.q}</strong>
												<p class="faq-a">{faq.a}</p>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		{/if}
	</main>

	<!-- Footer Guidance -->
	<footer class="help-footer">
		<div class="footer-card">
			<h3>¿Necesitas permisos adicionales o soporte técnico?</h3>
			<p>
				Los permisos son administrados centralmente por los responsables del sistema en DIGAIPE. Si tu usuario no puede ver o interactuar con un módulo necesario para tus funciones, comunícate con un Administrador para la asignación del rol correspondiente.
			</p>
			{#if isAdmin}
				<a href={resolve('/digaipe/admin/roles')} class="btn-primary">
					Gestionar Usuarios y Roles →
				</a>
			{/if}
		</div>
	</footer>
</div>

<style>
	.help-container {
		max-width: 1200px;
		margin: 0 auto;
		padding-bottom: var(--spacing-xxl);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}

	/* Hero Header */
	.help-header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.header-badges {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.badge-system {
		background-color: #e0f2fe;
		color: #0369a1;
		font-weight: 700;
		font-size: 12px;
		padding: 4px 12px;
		border-radius: 9999px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		border: 1px solid #bae6fd;
	}

	.user-roles-chips {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.roles-intro {
		font-size: 13px;
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.role-chip {
		background-color: #f1f5f9;
		color: #334155;
		padding: 3px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		border: 1px solid #cbd5e1;
	}

	.role-chip.my-role {
		background-color: #eff6ff;
		color: var(--ula-blue);
		border-color: #bfdbfe;
		font-weight: 700;
	}

	h1 {
		font-size: var(--font-size-h2);
		color: var(--ula-blue);
		margin: 0;
		line-height: 1.2;
		text-align: left;
	}

	.header-desc {
		color: var(--color-text-muted);
		font-size: 16px;
		line-height: 1.5;
		max-width: 900px;
		margin: 0;
	}

	/* Controls Card */
	.filter-controls-card {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: var(--spacing-md);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 14px;
		font-size: 16px;
		pointer-events: none;
		color: #94a3b8;
	}

	.search-box input {
		width: 100%;
		padding: 12px 40px 12px 42px;
		border: 2px solid #e2e8f0;
		border-radius: 8px;
		font-size: 15px;
		background: #f8fafc;
		transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
	}

	.search-box input:focus {
		outline: none;
		border-color: var(--ula-blue);
		background: #ffffff;
		box-shadow: 0 0 0 3px rgba(0, 51, 160, 0.12);
	}

	.clear-search-btn {
		position: absolute;
		right: 12px;
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 16px;
		cursor: pointer;
		padding: 4px;
	}

	.clear-search-btn:hover {
		color: #0f172a;
	}

	/* Tabs Filter */
	.roles-tabs-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.tabs-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.tabs-scroll {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.tab-btn {
		padding: 6px 14px;
		border-radius: 9999px;
		background: #f1f5f9;
		border: 1px solid #e2e8f0;
		color: #475569;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab-btn:hover {
		background: #e2e8f0;
		color: #1e293b;
	}

	.tab-btn.active {
		background: var(--ula-blue);
		color: #ffffff;
		border-color: var(--ula-blue);
		box-shadow: 0 2px 4px rgba(0, 51, 160, 0.2);
	}

	.tab-btn.highlight {
		border-color: #fde68a;
		background: #fffbeb;
		color: #92400e;
	}

	.tab-btn.highlight.active {
		background: #d97706;
		color: #ffffff;
		border-color: #d97706;
	}

	.tab-btn.admin-tab {
		border-color: #fbcfe8;
		color: #9d174d;
	}

	.tab-btn.admin-tab.active {
		background: #be185d;
		color: #ffffff;
		border-color: #be185d;
	}

	/* View Actions */
	.view-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 4px;
	}

	.modules-counter {
		font-size: 14px;
		color: var(--color-text-muted);
	}

	.expand-buttons {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.btn-text-action {
		background: none;
		border: none;
		padding: 0;
		color: var(--ula-blue);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
	}

	.btn-text-action:hover {
		color: var(--ula-dark);
	}

	.action-sep {
		color: #cbd5e1;
	}

	/* Modules List */
	.modules-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.module-card {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.module-card.can-access {
		border-left: 5px solid var(--ula-blue);
	}

	.module-card.no-access {
		border-left: 5px solid #cbd5e1;
		opacity: 0.95;
	}

	/* Module Header */
	.module-header {
		padding: var(--spacing-lg);
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		user-select: none;
		background: #ffffff;
		transition: background-color 0.15s;
		gap: var(--spacing-md);
	}

	.module-header:hover {
		background-color: #f8fafc;
	}

	.header-left {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		flex: 1;
	}

	.module-icon {
		font-size: 32px;
		line-height: 1;
		flex-shrink: 0;
		padding: 8px;
		background: #f1f5f9;
		border-radius: 10px;
	}

	.title-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.title-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.title-row h2 {
		font-size: 19px;
		color: #0f172a;
		margin: 0;
		font-weight: 700;
	}

	.access-pill {
		font-size: 11px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.access-pill.available {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #bbf7d0;
	}

	.access-pill.restricted {
		background: #f1f5f9;
		color: #64748b;
		border: 1px solid #e2e8f0;
	}

	.module-desc {
		font-size: 14px;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.4;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		flex-shrink: 0;
	}

	.module-roles-list {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.roles-title {
		font-size: 11px;
		text-transform: uppercase;
		color: #94a3b8;
		font-weight: 700;
	}

	.role-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 4px;
		background: #f1f5f9;
		color: #475569;
		border: 1px solid #e2e8f0;
	}

	.role-badge.is-user-role {
		background: #eff6ff;
		color: var(--ula-blue);
		border-color: #bfdbfe;
		font-weight: 700;
	}

	.toggle-indicator {
		font-size: 14px;
		color: #64748b;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: #f1f5f9;
		transition: transform 0.2s;
	}

	.toggle-indicator.open {
		color: var(--ula-blue);
		background: #eff6ff;
	}

	/* Module Body */
	.module-body {
		padding: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
		border-top: 1px solid #f1f5f9;
		background: #ffffff;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.direct-link-bar {
		margin-top: var(--spacing-md);
		padding: 12px var(--spacing-md);
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 14px;
		color: #1e3a8a;
		font-weight: 500;
	}

	.btn-goto-module {
		background: var(--ula-blue);
		color: #ffffff;
		padding: 6px 14px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: background-color 0.2s;
	}

	.btn-goto-module:hover {
		background: var(--ula-dark);
		text-decoration: none;
	}

	.steps-heading {
		font-size: 16px;
		color: var(--ula-blue);
		margin: var(--spacing-sm) 0 0 0;
		font-weight: 700;
	}

	/* Step-by-Step Timeline */
	.steps-timeline {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.step-card {
		display: flex;
		gap: var(--spacing-md);
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: var(--spacing-md);
		transition: background-color 0.2s;
	}

	.step-card:hover {
		background: #f1f5f9;
	}

	.step-num {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--ula-blue);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 14px;
		flex-shrink: 0;
	}

	.step-content {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
	}

	.step-title {
		font-size: 15px;
		font-weight: 700;
		color: #0f172a;
		margin: 0;
	}

	.step-desc {
		font-size: 14px;
		color: #334155;
		margin: 0;
		line-height: 1.5;
	}

	.step-tip {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		background: #fefce8;
		border: 1px solid #fef08a;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 13px;
		color: #854d0e;
		margin-top: 4px;
	}

	.tip-icon {
		flex-shrink: 0;
	}

	/* FAQ */
	.faq-section {
		background: #f8fafc;
		border: 1px dashed #cbd5e1;
		border-radius: 8px;
		padding: var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.faq-section h4 {
		font-size: 14px;
		color: #1e293b;
		margin: 0;
		font-weight: 700;
	}

	.faq-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.faq-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.faq-q {
		font-size: 13px;
		color: #1e293b;
	}

	.faq-a {
		font-size: 13px;
		color: #64748b;
		margin: 0;
		line-height: 1.4;
	}

	/* Empty State */
	.empty-state {
		background: #ffffff;
		border: 2px dashed #cbd5e1;
		border-radius: 12px;
		padding: var(--spacing-xxl) var(--spacing-md);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.empty-icon {
		font-size: 40px;
	}

	.empty-state h3 {
		font-size: 18px;
		color: #0f172a;
		margin: 0;
	}

	.empty-state p {
		color: var(--color-text-muted);
		font-size: 14px;
		margin: 0;
	}

	.btn-reset {
		margin-top: var(--spacing-sm);
		padding: 8px 16px;
		background: var(--ula-blue);
		color: #ffffff;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}

	/* Footer Card */
	.footer-card {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: var(--spacing-xl);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
	}

	.footer-card h3 {
		font-size: 18px;
		color: var(--ula-blue);
		margin: 0;
	}

	.footer-card p {
		color: var(--color-text-muted);
		font-size: 14px;
		max-width: 700px;
		line-height: 1.5;
		margin: 0;
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.module-header {
			flex-direction: column;
			align-items: stretch;
			gap: var(--spacing-md);
			padding: var(--spacing-md);
		}

		.header-right {
			justify-content: space-between;
			width: 100%;
			border-top: 1px solid #f1f5f9;
			padding-top: var(--spacing-sm);
		}

		.module-roles-list {
			align-items: flex-start;
		}

		.direct-link-bar {
			flex-direction: column;
			align-items: stretch;
			gap: var(--spacing-sm);
			text-align: center;
		}

		.btn-goto-module {
			text-align: center;
		}

		.step-card {
			flex-direction: column;
			gap: var(--spacing-sm);
		}

		.tabs-scroll {
			width: 100%;
		}

		.tab-btn {
			font-size: 12px;
			padding: 5px 10px;
		}
	}
</style>