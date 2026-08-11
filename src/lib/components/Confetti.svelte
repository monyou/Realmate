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

<div class="confetti" aria-hidden="true">
	{#each pieces as piece (piece.id)}
		<i
			style={`--x:${piece.x}%;--delay:${piece.delay}s;--duration:${piece.duration}s;--rotation:${piece.rotation}deg;--color:${piece.color};--size:${piece.size}px`}
		></i>
	{/each}
	<div class="firework firework-one"></div>
	<div class="firework firework-two"></div>
</div>

<style>
	.confetti {
		position: fixed;
		inset: 0;
		z-index: 30;
		pointer-events: none;
		overflow: hidden;
	}

	i {
		position: absolute;
		top: -10%;
		left: var(--x);
		width: var(--size);
		height: calc(var(--size) * 1.8);
		border-radius: 2px;
		background: var(--color);
		animation: fall var(--duration) cubic-bezier(0.15, 0.65, 0.35, 1) var(--delay) infinite;
	}

	.firework {
		position: absolute;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		box-shadow:
			0 -72px #ffcf5c,
			51px -51px #ff5c74,
			72px 0 #7c5cff,
			51px 51px #42e8c1,
			0 72px #ff5c74,
			-51px 51px #ffcf5c,
			-72px 0 #42e8c1,
			-51px -51px #7c5cff;
		animation: burst 2.2s ease-out infinite;
	}

	.firework-one {
		top: 24%;
		left: 17%;
	}

	.firework-two {
		top: 31%;
		right: 17%;
		animation-delay: 0.8s;
	}

	@keyframes fall {
		0% {
			transform: translate3d(0, -10vh, 0) rotate(var(--rotation));
			opacity: 0;
		}
		8% {
			opacity: 1;
		}
		100% {
			transform: translate3d(40px, 115vh, 0) rotate(calc(var(--rotation) + 760deg));
			opacity: 0.8;
		}
	}

	@keyframes burst {
		0%,
		20% {
			transform: scale(0.05);
			opacity: 0;
		}
		42% {
			opacity: 1;
		}
		72%,
		100% {
			transform: scale(1.15);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		i,
		.firework {
			animation-duration: 8s;
			animation-iteration-count: 1;
		}
	}
</style>
