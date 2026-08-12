<script lang="ts">
	const colors = ['#ff5c74', '#7c5cff', '#ffcf5c', '#42e8c1', '#ffffff'];
	const pieces = Array.from({ length: 72 }, (_, index) => ({
		id: index,
		x: (index * 37 + 11) % 100,
		delay: ((index * 17) % 21) / 10,
		duration: 2.8 + ((index * 13) % 18) / 10,
		rotation: (index * 71) % 360,
		color: colors[index % colors.length],
		size: 5 + (index % 5)
	}));
</script>

<div class="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
	{#each pieces as piece (piece.id)}
		<i
			class="absolute top-[-10%] left-(--x) h-[calc(var(--size)*1.8)] w-(--size) animate-[fall_var(--duration)_cubic-bezier(0.15,0.65,0.35,1)_var(--delay)_infinite] rounded-sm bg-(--color)"
			style={`--x:${piece.x}%;--delay:${piece.delay}s;--duration:${piece.duration}s;--rotation:${piece.rotation}deg;--color:${piece.color};--size:${piece.size}px`}
		></i>
	{/each}
	<div
		class="absolute top-[24%] left-[17%] size-1.25 animate-[burst_2.2s_ease-out_infinite] rounded-full shadow-[0_-72px_#ffcf5c,51px_-51px_#ff5c74,72px_0_#7c5cff,51px_51px_#42e8c1,0_72px_#ff5c74,-51px_51px_#ffcf5c,-72px_0_#42e8c1,-51px_-51px_#7c5cff]"
	></div>
	<div
		class="absolute top-[31%] right-[17%] size-1.25 animate-[burst_2.2s_ease-out_0.8s_infinite] rounded-full shadow-[0_-72px_#ffcf5c,51px_-51px_#ff5c74,72px_0_#7c5cff,51px_51px_#42e8c1,0_72px_#ff5c74,-51px_51px_#ffcf5c,-72px_0_#42e8c1,-51px_-51px_#7c5cff]"
	></div>
</div>
