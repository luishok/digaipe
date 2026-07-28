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
				Lorem ipsum dolor sit amet, consectetur adipisicing elit. Neque, perferendis quas totam
				impedit reiciendis recusandae voluptatem magni architecto voluptatibus repellat?
			</p>
		</div>
	</div>

	<div class="login-form-wrapper">
		<div class="login-form-content">
			<h1>Login</h1>
			<p>Por favor, introduce tus credenciales para acceder al portal.</p>
			<form method="post" action="?/signInEmail" use:enhance>
				<div class="input-group">
					<label>
						<p>Email</p>
						<input type="email" name="email" />
					</label>
				</div>
				<div class="input-group">
					<label>
						<p>Contraseña</p>
						<input type="password" name="password" />
					</label>
				</div>
				<button class="btn-full">Login</button>
			</form>
			<p style="color: red">{form?.message ?? ''}</p>
		</div>
	</div>
</div>
