<script lang="ts">
	import { tick } from 'svelte';
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { emailValidationMessage, loginPasswordValidationMessage } from '$lib/auth-validation';
	import ReelmateLogo from '$lib/components/ReelmateLogo.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const restoreEmail = () => form?.email ?? '';
	let email = $state(restoreEmail());
	let password = $state('');
	let validationAttempted = $state(false);
	const emailError = $derived(validationAttempted ? emailValidationMessage(email) : '');
	const passwordError = $derived(
		validationAttempted ? loginPasswordValidationMessage(password) : ''
	);

	const handleSubmit = (event: SubmitEvent) => {
		validationAttempted = true;
		if (!emailValidationMessage(email) && !loginPasswordValidationMessage(password)) return;

		event.preventDefault();
		void tick().then(() => {
			document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		});
	};
</script>

<svelte:head>
	<title>Log in — Reelmate</title>
	<meta name="description" content="Log in to manage your Reelmate watch lists." />
</svelte:head>

<div class="relative isolate min-h-dvh overflow-hidden bg-[#0b0910] px-5 py-7 text-(--ink)">
	<div
		class="pointer-events-none fixed -top-48 -left-32 -z-1 size-140 rounded-full bg-[#7c5cff]/22 blur-[110px]"
	></div>
	<div
		class="pointer-events-none fixed -right-40 -bottom-56 -z-1 size-140 rounded-full bg-[#ff3f66]/18 blur-[110px]"
	></div>

	<header class="mx-auto flex w-[min(100%,1120px)] items-center">
		<ReelmateLogo />
	</header>

	<main
		class="mx-auto grid min-h-[calc(100dvh-92px)] w-[min(100%,1040px)] place-items-center py-10"
	>
		<section
			class="w-[min(100%,440px)] rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(31,27,42,.94),rgba(15,13,21,.97))] p-6 shadow-[0_28px_90px_rgba(0,0,0,.38)] backdrop-blur-xl min-[600px]:p-8"
		>
			<p class="mb-3 text-[10px] font-extrabold tracking-[0.2em] text-(--rose) uppercase">
				Welcome back
			</p>
			<h1 class="m-0 text-[clamp(38px,9vw,52px)] leading-none font-[850] tracking-[-0.055em]">
				Log in
			</h1>
			<p class="mt-4 text-sm leading-relaxed text-(--muted)">
				Open your saved lists and get everyone matching.
			</p>

			{#if !data.configured}
				<p
					class="mt-5 rounded-2xl border border-(--gold)/25 bg-(--gold)/8 px-4 py-3 text-xs leading-relaxed text-(--gold)"
					role="alert"
				>
					Supabase credentials are missing. Copy <code>.env.example</code> to <code>.env</code> and add
					your project values.
				</p>
			{/if}
			{#if data.confirmationFailed && !form?.message}
				<p
					class="mt-5 rounded-2xl border border-(--gold)/25 bg-(--gold)/8 px-4 py-3 text-xs leading-relaxed text-(--gold)"
					role="alert"
				>
					The confirmation link is invalid or expired. Register again to request a new one.
				</p>
			{/if}

			<form method="POST" class="mt-7 space-y-4" novalidate onsubmit={handleSubmit}>
				<div>
					<label class="mb-2 block text-xs font-bold text-[#d8d2e2]" for="email">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						bind:value={email}
						required
						autocomplete="email"
						placeholder="you@example.com"
						aria-invalid={Boolean(emailError)}
						aria-describedby={emailError ? 'email-error' : undefined}
						class="box-border w-full rounded-2xl border bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) focus:ring-3 focus:ring-(--purple)/15 {emailError
							? 'border-[#ff5c74]/70 ring-3 ring-[#ff5c74]/10'
							: 'border-white/12'}"
					/>
					{#if emailError}<small
							id="email-error"
							class="mt-1.5 block text-[10px] font-semibold text-[#ff8ca0]">{emailError}</small
						>{/if}
				</div>

				<div>
					<label class="mb-2 block text-xs font-bold text-[#d8d2e2]" for="password">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						bind:value={password}
						required
						autocomplete="current-password"
						aria-invalid={Boolean(passwordError)}
						aria-describedby={passwordError ? 'password-error' : undefined}
						class="box-border w-full rounded-2xl border bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-(--purple) focus:ring-3 focus:ring-(--purple)/15 {passwordError
							? 'border-[#ff5c74]/70 ring-3 ring-[#ff5c74]/10'
							: 'border-white/12'}"
					/>
					{#if passwordError}<small
							id="password-error"
							class="mt-1.5 block text-[10px] font-semibold text-[#ff8ca0]">{passwordError}</small
						>{/if}
				</div>

				{#if form?.message}<p class="text-xs leading-relaxed text-(--gold)" role="alert">
						{form.message}
					</p>{/if}

				<button
					type="submit"
					class="mt-2 flex w-full cursor-pointer items-center justify-between rounded-2xl border-0 bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-4 font-extrabold text-[#160b10] shadow-[0_14px_34px_rgba(255,63,102,.24)] transition hover:-translate-y-0.5"
				>
					<span>Log in to Reelmate</span><span aria-hidden="true">→</span>
				</button>
			</form>

			<p class="mt-6 text-center text-xs text-(--muted)">
				New here? <a href={resolve('/register')} class="font-bold text-white">Create an account</a>
			</p>
		</section>
	</main>
</div>
