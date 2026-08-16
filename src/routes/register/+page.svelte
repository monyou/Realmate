<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import ReelmateLogo from '$lib/components/ReelmateLogo.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Create an account — Reelmate</title>
	<meta name="description" content="Create your Reelmate account and start building watch lists." />
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
				Your watch space
			</p>
			<h1 class="m-0 text-[clamp(38px,9vw,52px)] leading-none font-[850] tracking-[-0.055em]">
				Create account
			</h1>
			<p class="mt-4 text-sm leading-relaxed text-(--muted)">
				Save private movie and series lists, then turn any combination into a matching party.
			</p>

			{#if !data.configured}<p
					class="mt-5 rounded-2xl border border-(--gold)/25 bg-(--gold)/8 px-4 py-3 text-xs leading-relaxed text-(--gold)"
					role="alert"
				>
					Supabase credentials are missing. Copy <code>.env.example</code> to <code>.env</code> and add
					your project values.
				</p>{/if}

			{#if form?.success}
				<div
					class="mt-7 rounded-2xl border border-(--mint)/25 bg-(--mint)/8 p-5 text-sm leading-relaxed text-(--mint)"
					role="status"
				>
					<p class="m-0 font-bold">{form.message}</p>
					<a href={resolve('/login')} class="mt-4 inline-block font-extrabold text-white"
						>Go to login →</a
					>
				</div>
			{:else}
				<form method="POST" class="mt-7 space-y-4">
					<label class="block text-xs font-bold text-[#d8d2e2]" for="email">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						value={form?.email ?? ''}
						required
						autocomplete="email"
						placeholder="you@example.com"
						class="box-border w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) focus:ring-3 focus:ring-(--purple)/15"
					/>
					<label class="block text-xs font-bold text-[#d8d2e2]" for="password">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						minlength="8"
						required
						autocomplete="new-password"
						class="box-border w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-(--purple) focus:ring-3 focus:ring-(--purple)/15"
					/>
					<label class="block text-xs font-bold text-[#d8d2e2]" for="confirmPassword"
						>Confirm password</label
					>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						minlength="8"
						required
						autocomplete="new-password"
						class="box-border w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-(--purple) focus:ring-3 focus:ring-(--purple)/15"
					/>
					{#if form?.message}<p class="text-xs leading-relaxed text-(--gold)" role="alert">
							{form.message}
						</p>{/if}
					<button
						type="submit"
						class="mt-2 flex w-full cursor-pointer items-center justify-between rounded-2xl border-0 bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-4 font-extrabold text-[#160b10] shadow-[0_14px_34px_rgba(255,63,102,.24)] transition hover:-translate-y-0.5"
						><span>Create my account</span><span aria-hidden="true">→</span></button
					>
				</form>
			{/if}

			<p class="mt-6 text-center text-xs text-(--muted)">
				Already registered? <a href={resolve('/login')} class="font-bold text-white">Log in</a>
			</p>
		</section>
	</main>
</div>
