<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="login-container">
	<div class="login-image">
		<div class="image-overlay">
			<h2>Portal para uso Universitario</h2>
			<p>
				Sistema de gestión de documentos y procesos internos de la universidad. Accede a tus recursos y gestiona tus tareas de manera eficiente.
			</p>
		</div>
	</div>

	<div class="login-form-wrapper">
		<div class="login-form-content">
			<h1>Iniciar sesión</h1>
			<p>Por favor, introduce tus credenciales para acceder al portal.</p>
			<form method="post" action="?/signInEmail" use:enhance>
				<div class="input-group">
					<label>
						<p>Correo electrónico</p>
						<input type="email" name="email" />
					</label>
				</div>
				<div class="input-group">
					<label>
						<p>Contraseña</p>
						<input type="password" name="password" />
					</label>
				</div>
				<button class="btn-full">Iniciar sesión</button>
			</form>
			<p style="color: red">{form?.message ?? ''}</p>
		</div>
	</div>
</div>
