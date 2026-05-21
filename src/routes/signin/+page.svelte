<script>
	import { supabase } from '$lib/supabase';
	import { authUser } from '$lib/auth-store';
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let error = '';

	async function signIn() {
		error = '';
		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			error = signInError.message;
			return;
		}

		const user =
			data?.user ??
			data?.session?.user ??
			(await new Promise((resolve) => {
				const unsub = authUser.subscribe((u) => {
					if (u) {
						unsub();
						resolve(u);
					}
				});

				setTimeout(() => {
					unsub();
					resolve(null);
				}, 8000);
			}));

		if (user) {
			const meta = user.user_metadata ?? {};

			const { data: profile, error: profileError } = await supabase
				.from('profiles')
				.select('id, email, first_name, last_name, nickname, phone, department, position, region')
				.eq('id', user.id)
				.single();

			if (profileError && !profile) {
				await supabase.from('profiles').insert({
					id: user.id,
					email: user.email,
					first_name: meta.first_name ?? null,
					last_name: meta.last_name ?? null,
					nickname: meta.nickname ?? null,
					phone: meta.phone ?? null,
					department: meta.department ?? null,
					position: meta.position ?? null,
					region: meta.region ?? null
				});
			} else if (profile) {
				const patch = {};
				const keys = [
					'first_name',
					'last_name',
					'nickname',
					'phone',
					'department',
					'position',
					'region'
				];
				for (const k of keys) {
					if ((profile[k] == null || profile[k] === '') && meta[k]) {
						patch[k] = meta[k];
					}
				}
				if ((profile.email == null || profile.email === '') && user.email) {
					patch.email = user.email;
				}
				if (Object.keys(patch).length) {
					await supabase.from('profiles').update(patch).eq('id', user.id);
				}
			}
		}

		goto('/');
	}
</script>

<div class="box">
	<div class="form">
		<form on:submit|preventDefault={signIn}>
			<h1 class="title">Sign In</h1>
			<p><label for="email">E-mail</label></p>
			<p>
				<input
					name="email"
					type="email"
					bind:value={email}
					placeholder="example@email.com"
					class="input-box"
					required
				/>
			</p>
			<p><label for="password">Password</label></p>
			<p>
				<input
					name="password"
					type="password"
					bind:value={password}
					placeholder="********"
					class="input-box"
					required
				/>
			</p>
			<p><a href="/auth/forgotpw" class="forgotpw">Forgot password?</a></p>
			{#if error}
				<p class="error">{error}</p>
			{/if}
			<button type="submit" class="button-primary">Sign In</button>
			<p class="no-account">
				Don't have an account? Sign up <a href="/signup" class="signup">here</a>.
			</p>
		</form>
	</div>
</div>

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	.box {
		vertical-align: middle;
		display: grid;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		margin: 30px 0;
	}

	button {
		background-color: #064c6dd7;
		color: #ffffff;
		border: none;
		font-size: small;
		padding: 6px 14px;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #064c6da4;
	}

	.button-primary {
		width: 100%;
		background-color: #091747;
		font-weight: bold;
		margin-top: 10px;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.error {
		font-size: 12px;
		color: #ff0000;
	}

	.forgotpw {
		font-size: 14px;
		text-align: right;
	}

	.forgotpw:hover,
	.signup:hover {
		cursor: pointer;
		text-decoration: underline;
	}

	.form {
		background-color: #ffffff;
		border: 1px solid #091747b7;
		border-radius: 4px;
		padding: 30px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 420px;
	}

	.input-box {
		width: 100%;
		max-width: 350px;
		margin-bottom: 10px;
	}

	label {
		font-weight: bold;
	}

	.no-account {
		font-size: 14px;
		margin-top: 5px;
	}

	.signup {
		font-size: 14px;
		text-decoration: underline;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
	}

	@media (max-width: 600px) {
		.box {
			padding-left: 15px;
			padding-right: 15px;
		}

		.form {
			width: 100%;
			max-width: 100%;
			margin: 0;
			padding: 20px;
		}

		.input-box {
			width: 100%;
		}
	}

	@media (min-width: 1024px) {
		.form {
			max-width: 520px;
		}
	}
</style>
