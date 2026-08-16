<script lang="ts">
	let { visible, label = 'Loading…' }: { visible: boolean; label?: string } = $props();
</script>

{#if visible}
	<div
		class="fixed inset-0 z-9999 grid cursor-wait place-items-center bg-[#0b0910]/72 px-5 backdrop-blur-sm"
		role="status"
		aria-live="polite"
		aria-label={label}
		data-loading-overlay
	>
		<div
			class="flex min-w-45 flex-col items-center rounded-[26px] border border-white/12 bg-[#17131e]/95 px-7 py-6 text-center shadow-[0_26px_90px_rgba(0,0,0,.55)]"
		>
			<div
				class="relative size-15 animate-[reel-spin_1.15s_linear_infinite] rounded-full border-2 border-white/15 border-t-(--rose) shadow-[0_0_28px_rgba(255,92,116,.18)] before:absolute before:top-2.5 before:left-2.5 before:size-3 before:rounded-full before:bg-white/12 before:content-[''] after:absolute after:top-2.5 after:right-2.5 after:size-3 after:rounded-full after:bg-white/12 after:content-['']"
				aria-hidden="true"
			>
				<span
					class="before:absolute before:bottom-2.25 before:left-5.5 before:size-3 before:rounded-full before:bg-white/12 before:content-['']"
				></span>
			</div>
			<p class="mt-4 text-sm font-extrabold text-white">{label}</p>
			<p class="mt-1 text-[11px] text-(--muted)">Please wait a moment.</p>
		</div>
	</div>
{/if}
