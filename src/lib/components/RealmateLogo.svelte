<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<a
	href={resolve('/')}
	class="flex items-center gap-2.5 text-white no-underline"
	aria-label="Realmate home"
>
	<span
		class="relative grid size-7 rotate-[-8deg] place-items-center rounded-full border-2 border-(--rose) shadow-[0_0_24px_rgba(255,92,116,0.35)] before:absolute before:top-1 before:left-1.5 before:size-1 before:rounded-full before:bg-(--rose) before:content-[''] after:absolute after:top-1.25 after:right-1.25 after:size-1 after:rounded-full after:bg-(--rose) after:content-['']"
		><span
			class="size-2 rounded-full bg-(--rose) before:absolute before:bottom-1 before:left-1.5 before:size-1 before:rounded-full before:bg-(--rose) before:content-['']"
		></span></span
	>
	<span class="text-lg font-extrabold tracking-[-0.04em]">realmate</span>
</a>
