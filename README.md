# Reelmate

A local-first group swiping app for choosing a movie or series together. Everyone on the same URL joins one live room. A round ends immediately when every participant likes the same title, or after every participant finishes the deck without a match.

Built with SvelteKit, Svelte 5, TypeScript, Tailwind CSS 4, Vite's development WebSocket channel, and Bun.

## Run it

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). The dev server listens on the local network, so phones on the same Wi-Fi can also use the network URL printed by Vite.

To share it through ngrok:

```bash
ngrok http 5173
```

Send the generated HTTPS URL to the other people. WebSocket traffic uses that same URL automatically.

> This project intentionally keeps the room in the running dev server's memory. Restarting `bun run dev` resets the lobby and votes. Keep an ngrok URL private: it exposes a development server and is not intended as a public deployment.

## Add your movies and series

Replace `media.json` in the public `realmate-blob-store`. The app reads it from:

```text
https://epureihf1azmctan.public.blob.vercel-storage.com/media.json
```

The file must contain a JSON array. Each item must have exactly the data shape below; an internal stable ID is generated automatically.

```json
{
	"title": "Dune: Part Two",
	"type": "movie",
	"genres": ["Drama", "Sci-Fi"],
	"img": "https://example.com/poster.jpg",
	"year": 2024,
	"imdbRating": 8.5
}
```

- `type` must be either `"movie"` or `"series"`.
- `genres` must be a non-empty array of genre names. Up to three are displayed on cards.
- `img` can be any browser-accessible image URL.
- `imdbRating` must be a number between `0` and `10` and is displayed with one decimal place.
- The server shuffles the list once per round, and all participants receive the same order.
- The media list is refreshed from Blob when someone starts a round. An active round keeps its existing deck, and a later round receives the updated file after Vercel's cache propagation, which may take up to 60 seconds.

## How the room behaves

- One URL is one shared room; there are no room codes or accounts.
- At least two connected people are required to start.
- Anyone in the lobby can start a round for everyone.
- People joining after a round starts spectate until the next round.
- A title matches only after every round participant swipes right on it.
- Starting another round clears every participant's previous choices; delayed messages from an older round are ignored.
- Someone can refresh without losing their place. After an eight-second disconnect, a missing participant is removed; if fewer than two remain, the room returns to the lobby.
- Swiping works with touch, mouse drag, buttons, and the left/right arrow keys.

## Quality checks

```bash
bun run check
bun run test
bun run lint
bun run build
```

The unit tests cover the minimum-player rule, immediate unanimous matches, completion without a match, and rejection of out-of-order votes.
