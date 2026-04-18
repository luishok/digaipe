<script lang="ts">
    import { enhance } from '$app/forms';
    import type { ActionData } from './$types';

    let { form }: { form: ActionData } = $props();
</script>

<div class="login-container">
    <div class="login-form-wrapper">
		<div class="login-form-content">
			<h1>Registro</h1>
			<p>Por favor, introduce tus credenciales para acceder al portal.</p>
            <form method="post" action="?/signInEmail" use:enhance>
                <label>
                    <p>Email</p>
                    <input class="input-group" type="email" name="email" />
                </label>
                <label>
                    <p>Password</p>
                    <input class="input-group" type="password" name="password" />
                </label>
                <label>
                    <p>Name (for registration)</p>
                    <input class="input-group" name="name" />
                </label>
                <button formaction="?/signUpEmail">Register</button>
            </form>
        </div>
    </div>

<p style="color: red">{form?.message ?? ''}</p>
</div>