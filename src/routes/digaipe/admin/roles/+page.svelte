<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let pending = $state<string | null>(null);
</script>

<div class="page">
	<header>
		<div class="header-inner">
			<div>
				<p class="label">Admin</p>
				<h1>User roles</h1>
			</div>
			<span class="count">{data.users.length} users</span>
		</div>
	</header>

	{#if form?.message}
		<div class="banner error">{form.message}</div>
	{/if}
	{#if form?.success}
		<div class="banner success">Role updated.</div>
	{/if}

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>User</th>
					<th>Joined</th>
					<th>Role</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user (user.id)}
					{@const isSelf = user.id === data.currentUserId}
					<tr class:self={isSelf}>
						<td>
							<div class="user-cell">
								<div class="avatar">{user.name?.[0]?.toUpperCase() ?? '?'}</div>
								<div>
									<span class="name">{user.name ?? '—'}</span>
									<span class="email">{user.email}</span>
								</div>
							</div>
						</td>
						<td class="date">
							{new Date(user.createdAt).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})}
						</td>
						<td>
							<span class="badge {user.role}">{user.role}</span>
						</td>
						<td class="action-cell">
							{#if isSelf}
								<span class="self-label">you</span>
							{:else}
								<form
									method="POST"
									action="?/setRole"
									use:enhance={() => {
										pending = user.id;
										return async ({ update }) => {
											await update();
											pending = null;
										};
									}}
								>
									<input type="hidden" name="userId" value={user.id} />
									<input
										type="hidden"
										name="role"
										value={user.role === 'admin' ? 'user' : 'admin'}
									/>
									<button
										type="submit"
										class="toggle-btn {user.role}"
										disabled={pending === user.id}
									>
										{pending === user.id
											? '...'
											: user.role === 'admin'
												? 'Remove admin'
												: 'Make admin'}
									</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	*,
	*::before,
	*::after {
		box-sizing: border-box;
	}

	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: 48px 24px;
		font-family: 'DM Sans', sans-serif;
		color: #0f0f0f;
	}

	header {
		margin-bottom: 32px;
	}

	.header-inner {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
	}

	.label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #888;
		margin: 0 0 4px;
	}

	h1 {
		font-size: 28px;
		font-weight: 700;
		margin: 0;
		letter-spacing: -0.02em;
	}

	.count {
		font-size: 13px;
		color: #888;
		padding-bottom: 4px;
	}

	.banner {
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		margin-bottom: 20px;
	}
	.banner.error {
		background: #fff0f0;
		color: #c0392b;
		border: 1px solid #fcc;
	}
	.banner.success {
		background: #f0faf4;
		color: #1a7a45;
		border: 1px solid #b6e8c8;
	}

	.table-wrap {
		border: 1px solid #e8e8e8;
		border-radius: 12px;
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}

	thead tr {
		background: #fafafa;
		border-bottom: 1px solid #e8e8e8;
	}

	th {
		padding: 11px 16px;
		text-align: left;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #999;
	}

	tbody tr {
		border-bottom: 1px solid #f0f0f0;
		transition: background 0.1s;
	}
	tbody tr:last-child {
		border-bottom: none;
	}
	tbody tr:hover {
		background: #fafafa;
	}
	tbody tr.self {
		opacity: 0.55;
	}

	td {
		padding: 14px 16px;
		vertical-align: middle;
	}

	.user-cell {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: #0f0f0f;
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.name {
		display: block;
		font-weight: 500;
		color: #0f0f0f;
	}

	.email {
		display: block;
		font-size: 12px;
		color: #999;
		margin-top: 1px;
	}

	.date {
		color: #888;
		font-size: 13px;
	}

	.badge {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 99px;
		font-size: 12px;
		font-weight: 600;
	}
	.badge.admin {
		background: #0f0f0f;
		color: #fff;
	}
	.badge.user {
		background: #f0f0f0;
		color: #555;
	}

	.action-cell {
		text-align: right;
	}

	.self-label {
		font-size: 12px;
		color: #bbb;
		font-style: italic;
	}

	.toggle-btn {
		padding: 6px 14px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid transparent;
		transition: all 0.15s;
	}
	.toggle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-btn.user {
		background: #0f0f0f;
		color: #fff;
		border-color: #0f0f0f;
	}
	.toggle-btn.user:hover:not(:disabled) {
		background: #333;
	}

	.toggle-btn.admin {
		background: #fff;
		color: #c0392b;
		border-color: #fcc;
	}
	.toggle-btn.admin:hover:not(:disabled) {
		background: #fff0f0;
	}
</style>
