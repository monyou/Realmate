<script lang="ts">
	import { onMount } from 'svelte';
	import Confetti from '$lib/components/Confetti.svelte';
	import type { MediaItem, PartyState } from '$lib/types';

	const guestWords = ['Popcorn', 'Velvet', 'Cosmic', 'Midnight', 'Neon', 'Golden'];
	const guestAnimals = ['Fox', 'Panda', 'Owl', 'Otter', 'Moth', 'Cat'];

	let party = $state<PartyState | null>(null);
	let playerId = $state('');
	let playerName = $state('');
	let connected = $state(false);
	let dragX = $state(0);
	let dragging = $state(false);
	let leaving = $state(false);
	let dragStart = 0;
	let previousCardKey = '';
	let voteSendTimer: ReturnType<typeof setTimeout> | undefined;
	let voteFallback: ReturnType<typeof setTimeout> | undefined;

	const me = $derived(party?.players.find((player) => player.id === playerId));
	const currentItem = $derived(
		party?.phase === 'playing' && me ? (party.deck[me.progress] ?? null) : null
	);
	const nextItem = $derived(
		party?.phase === 'playing' && me ? (party.deck[me.progress + 1] ?? null) : null
	);
	const thirdItem = $derived(
		party?.phase === 'playing' && me ? (party.deck[me.progress + 2] ?? null) : null
	);
	const finishedSwiping = $derived(
		party?.phase === 'playing' && me && me.progress >= party.deck.length
	);
	const readyToStart = $derived((party?.onlineCount ?? 0) >= 2);
	const yesStrength = $derived(Math.min(1, Math.max(0, dragX / 110)));
	const noStrength = $derived(Math.min(1, Math.max(0, -dragX / 110)));
	const cardTransform = $derived(
		`transform: translate3d(${dragX}px, 0, 0) rotate(${dragX / 19}deg); transition: ${dragging ? 'none' : 'transform 260ms cubic-bezier(.2,.9,.2,1)'};`
	);

	$effect(() => {
		const activeCardKey = `${party?.roundId ?? 'no-round'}:${currentItem?.id ?? 'no-card'}`;
		if (activeCardKey !== previousCardKey) {
			previousCardKey = activeCardKey;
			if (voteSendTimer) clearTimeout(voteSendTimer);
			if (voteFallback) clearTimeout(voteFallback);
			dragX = 0;
			leaving = false;
		}
	});

	onMount(() => {
		playerId = localStorage.getItem('reelmate-player-id') ?? crypto.randomUUID();
		localStorage.setItem('reelmate-player-id', playerId);

		playerName = localStorage.getItem('reelmate-player-name') ?? makeGuestName(playerId);
		localStorage.setItem('reelmate-player-name', playerName);

		const hot = import.meta.hot;
		if (!hot) return;

		const receiveState = (nextState: PartyState) => {
			party = nextState;
			connected = true;
		};
		hot.on('reel:state', receiveState);
		hot.send('reel:hello', { playerId, name: playerName });

		return () => {
			hot.off('reel:state', receiveState);
			if (voteSendTimer) clearTimeout(voteSendTimer);
			if (voteFallback) clearTimeout(voteFallback);
		};
	});

	function makeGuestName(id: string) {
		let total = 0;
		for (const character of id) total += character.charCodeAt(0);
		return `${guestWords[total % guestWords.length]} ${guestAnimals[(total * 3 + 1) % guestAnimals.length]}`;
	}

	function sendStart() {
		if (readyToStart) import.meta.hot?.send('reel:start', { playerId });
	}

	function sendAgain() {
		if (!party?.roundId) return;
		if (voteSendTimer) clearTimeout(voteSendTimer);
		if (voteFallback) clearTimeout(voteFallback);
		dragX = 0;
		leaving = false;
		import.meta.hot?.send('reel:again', { playerId, roundId: party.roundId });
	}

	function decide(liked: boolean) {
		if (!currentItem || !party?.roundId || leaving) return;
		leaving = true;
		dragging = false;
		dragX = (liked ? 1 : -1) * Math.max(window.innerWidth, 520);
		const itemId = currentItem.id;
		const roundId = party.roundId;
		voteSendTimer = setTimeout(
			() => import.meta.hot?.send('reel:vote', { playerId, roundId, itemId, liked }),
			190
		);
		voteFallback = setTimeout(() => {
			dragX = 0;
			leaving = false;
		}, 1_200);
	}

	function pointerDown(event: PointerEvent) {
		if (leaving) return;
		dragging = true;
		dragStart = event.clientX - dragX;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function pointerMove(event: PointerEvent) {
		if (!dragging || leaving) return;
		dragX = event.clientX - dragStart;
	}

	function pointerUp() {
		if (!dragging) return;
		dragging = false;
		if (Math.abs(dragX) >= 88) decide(dragX > 0);
		else dragX = 0;
	}

	function handleKey(event: KeyboardEvent) {
		if (party?.phase !== 'playing' || !currentItem || leaving) return;
		if (event.key === 'ArrowLeft') decide(false);
		if (event.key === 'ArrowRight') decide(true);
	}

	function playerInitials(name: string) {
		return name
			.split(' ')
			.map((word) => word[0])
			.join('')
			.slice(0, 2);
	}

	function mediaLabel(item: MediaItem) {
		return item.type === 'movie' ? 'Movie' : 'Series';
	}

	function ratingLabel(item: MediaItem) {
		return item.imdbRating.toFixed(1);
	}
</script>

<svelte:head>
	<title>Reelmate — Find tonight’s watch</title>
	<meta
		name="description"
		content="Swipe together, match on a movie or series, and stop debating what to watch."
	/>
	<meta name="theme-color" content="#0b0910" />
</svelte:head>

<svelte:window onkeydown={handleKey} />

<div class="app-shell" class:celebrating={party?.phase === 'matched'}>
	<div class="aurora aurora-one"></div>
	<div class="aurora aurora-two"></div>
	<div class="noise"></div>

	{#if party?.phase === 'matched'}
		<Confetti />
	{/if}

	<header class="topbar" class:topbar-compact={party?.phase === 'playing'}>
		<div class="brand" aria-label="Reelmate home">
			<span class="brand-mark"><span></span></span>
			<span class="brand-name">reelmate</span>
		</div>

		<div class="presence" class:presence-offline={!connected}>
			<span class="live-dot"></span>
			<span>{connected ? `${party?.onlineCount ?? 0} online` : 'connecting'}</span>
		</div>
	</header>

	<main>
		{#if !party}
			<section class="connection-screen">
				<div class="loader-reel"><span></span></div>
				<p>Joining the watch party…</p>
			</section>
		{:else if party.phase === 'lobby'}
			<section class="lobby-screen">
				<div class="eyebrow"><span></span> One room. One choice.</div>
				<h1>Tonight’s watch,<br /><em>decided together.</em></h1>
				<p class="hero-copy">
					Swipe through movies and series. The instant everyone likes the same title, the search is
					over.
				</p>

				<div class="room-card">
					<div class="room-card-glow"></div>
					<div class="room-heading">
						<div>
							<span class="room-kicker">Your watch party</span>
							<strong
								>{party.onlineCount} {party.onlineCount === 1 ? 'person' : 'people'} here</strong
							>
						</div>
						<div class="signal" aria-label="Live room"><i></i><i></i><i></i></div>
					</div>

					<div class="people-row" aria-label="People in the room">
						{#each party.players as player (player.id)}
							<div class="person" title={player.name}>
								<span class={`avatar avatar-${player.avatar}`}>{playerInitials(player.name)}</span>
								<small>{player.id === playerId ? 'You' : player.name.split(' ')[0]}</small>
							</div>
						{/each}
						{#if party.players.length === 1}
							<div class="person waiting-person">
								<span class="avatar empty-avatar">+</span>
								<small>Waiting</small>
							</div>
						{/if}
					</div>

					{#if party.message}
						<p class="room-message">{party.message}</p>
					{/if}

					<button class="start-button" disabled={!readyToStart} onclick={sendStart}>
						<span>{readyToStart ? 'Start swiping' : 'Waiting for someone else'}</span>
						<b aria-hidden="true">→</b>
					</button>
					<p class="start-note">
						<span>✦</span>
						{readyToStart
							? 'Anyone can start — it begins for everyone'
							: 'Share this page with at least one person'}
					</p>
				</div>
			</section>
		{:else if party.phase === 'playing' && me && !finishedSwiping}
			<section class="swipe-screen">
				<div class="game-meta">
					<div class="mini-people">
						{#each party.players.slice(0, 4) as player (player.id)}
							<span class={`avatar avatar-${player.avatar}`} title={player.name}>
								{playerInitials(player.name)}
							</span>
						{/each}
					</div>
					<div class="progress-copy"><b>{me.progress + 1}</b><span>/</span>{party.deck.length}</div>
				</div>
				<div class="progress-track">
					<span style={`width:${(me.progress / party.deck.length) * 100}%`}></span>
				</div>

				<div class="deck" aria-live="polite">
					{#if thirdItem}
						<div class="media-card card-third" aria-hidden="true"></div>
					{/if}
					{#if nextItem}
						<div class="media-card card-next" aria-hidden="true">
							<img src={nextItem.img} alt="" />
						</div>
					{/if}
					{#if currentItem}
						{#key currentItem.id}
							<article
								class="media-card card-current"
								class:is-dragging={dragging}
								style={cardTransform}
								onpointerdown={pointerDown}
								onpointermove={pointerMove}
								onpointerup={pointerUp}
								onpointercancel={pointerUp}
							>
								<img src={currentItem.img} alt={`${currentItem.title} poster`} draggable="false" />
								<div class="poster-vignette"></div>
								<div class="vote-stamp stamp-no" style={`opacity:${noStrength}`}>PASS</div>
								<div class="vote-stamp stamp-yes" style={`opacity:${yesStrength}`}>YES!</div>
								<div class="card-copy">
									<div class="media-meta-row">
										<div class="media-data">
											<span class={`kind kind-${currentItem.type}`}>{mediaLabel(currentItem)}</span>
											<span>{currentItem.year}</span>
										</div>
										<div
											class="imdb-rating"
											aria-label={`IMDb rating ${ratingLabel(currentItem)} out of 10`}
										>
											<span aria-hidden="true">★</span>
											<b>{ratingLabel(currentItem)}</b>
											<small>IMDb</small>
										</div>
									</div>
									<h2>{currentItem.title}</h2>
									<div class="genre-list" aria-label={`Genres: ${currentItem.genres.join(', ')}`}>
										{#each currentItem.genres.slice(0, 3) as genre (genre)}
											<span>{genre}</span>
										{/each}
									</div>
								</div>
							</article>
						{/key}
					{/if}
				</div>

				<div class="swipe-actions">
					<button
						class="decision-button pass-button"
						onclick={() => decide(false)}
						aria-label="Pass"
					>
						<span>×</span>
					</button>
					<p><b>Swipe</b><span>or tap</span></p>
					<button
						class="decision-button like-button"
						onclick={() => decide(true)}
						aria-label="Like"
					>
						<span>♥</span>
					</button>
				</div>
				<p class="key-hint"><kbd>←</kbd> pass <span>•</span> like <kbd>→</kbd></p>
			</section>
		{:else if party.phase === 'playing' && me && finishedSwiping}
			<section class="waiting-screen">
				<div class="waiting-orbit"><i></i><i></i><span>✓</span></div>
				<div class="eyebrow"><span></span> You’re all caught up</div>
				<h1>Cards down.<br /><em>Waiting on the crew.</em></h1>
				<p>Your votes are locked in. This screen will update the moment everyone finishes.</p>

				<div class="progress-list">
					{#each party.players as player (player.id)}
						<div class="progress-person">
							<span class={`avatar avatar-${player.avatar}`}>{playerInitials(player.name)}</span>
							<div>
								<strong>{player.id === playerId ? 'You' : player.name}</strong>
								<span>{Math.min(player.progress, player.total)} of {player.total}</span>
							</div>
							<i class:done={player.progress >= player.total}>
								{player.progress >= player.total
									? '✓'
									: `${Math.round((player.progress / player.total) * 100)}%`}
							</i>
						</div>
					{/each}
				</div>
			</section>
		{:else if party.phase === 'playing'}
			<section class="waiting-screen spectator-screen">
				<div class="spectator-icon"><span>▶</span></div>
				<div class="eyebrow"><span></span> Round in progress</div>
				<h1>You caught the<br /><em>middle of the movie.</em></h1>
				<p>You’ll join the room automatically when the current group finishes.</p>
				<div class="progress-list">
					{#each party.players as player (player.id)}
						<div class="progress-person">
							<span class={`avatar avatar-${player.avatar}`}>{playerInitials(player.name)}</span>
							<div><strong>{player.name}</strong><span>Choosing now</span></div>
							<i>{player.progress}/{player.total}</i>
						</div>
					{/each}
				</div>
			</section>
		{:else if party.phase === 'matched' && party.match}
			<section class="result-screen match-screen">
				<div class="match-kicker"><span>♥</span> IT’S A MATCH <span>♥</span></div>
				<h1>Tonight is <em>sorted.</em></h1>
				<p>Everyone said yes. No more scrolling.</p>

				<div class="match-card-wrap">
					<div class="match-rays"></div>
					<article class="match-card">
						<img src={party.match.img} alt={`${party.match.title} poster`} />
						<div class="poster-vignette"></div>
						<div class="card-copy">
							<div class="media-meta-row">
								<div class="media-data">
									<span class={`kind kind-${party.match.type}`}>{mediaLabel(party.match)}</span>
									<span>{party.match.year}</span>
								</div>
								<div
									class="imdb-rating"
									aria-label={`IMDb rating ${ratingLabel(party.match)} out of 10`}
								>
									<span aria-hidden="true">★</span>
									<b>{ratingLabel(party.match)}</b>
									<small>IMDb</small>
								</div>
							</div>
							<h2>{party.match.title}</h2>
							<div class="genre-list" aria-label={`Genres: ${party.match.genres.join(', ')}`}>
								{#each party.match.genres.slice(0, 3) as genre (genre)}
									<span>{genre}</span>
								{/each}
							</div>
						</div>
					</article>
					<div class="heart-badge">♥</div>
				</div>

				<div class="match-people">
					<div class="mini-people">
						{#each party.players as player (player.id)}
							<span class={`avatar avatar-${player.avatar}`}>{playerInitials(player.name)}</span>
						{/each}
					</div>
					<span>Matched by everyone</span>
				</div>

				<button class="secondary-button" onclick={sendAgain}>Find another <span>↻</span></button>
			</section>
		{:else}
			<section class="result-screen empty-result">
				<div class="empty-reel"><i></i><i></i><i></i></div>
				<div class="eyebrow"><span></span> Plot twist</div>
				<h1>No match<br /><em>this round.</em></h1>
				<p>Great taste. Terrible overlap. Shuffle the deck and give it another shot.</p>
				<button class="start-button replay-button" onclick={sendAgain}>
					<span>Shuffle & try again</span><b>↻</b>
				</button>
			</section>
		{/if}
	</main>

	<footer>
		<span>reelmate</span>
		<i></i>
		<p>Less browsing. More watching.</p>
	</footer>
</div>
