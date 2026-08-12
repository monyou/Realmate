# Reelmate

A group swiping app for choosing a movie or series together. Everyone on the same URL joins one live room. A round ends immediately when every participant likes the same title, or after every participant finishes the deck without a match.

Built with SvelteKit, Svelte 5, TypeScript, Tailwind CSS 4, Upstash Redis, Vercel Blob, and Bun.

## Run it

```bash
bun install
cp .env.example .env
bun run dev
```

Fill `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env`, then open [http://localhost:5173](http://localhost:5173). The dev server listens on the local network, so phones on the same Wi-Fi can also use the network URL printed by Vite.

To share it through ngrok:

```bash
ngrok http 5173
```

Send the generated HTTPS URL to the other people. Redis credentials are mandatory in every environment; there is no separate in-memory implementation.

## Deploy to Vercel

1. Import this repository into Vercel. The repository includes the official SvelteKit Vercel adapter and pins Node.js 22.
2. In the Vercel project, open **Storage**, add an **Upstash Redis** database from the Marketplace, and connect it to this project.
3. Confirm that the integration added `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for the environments you will deploy.
4. Deploy, or redeploy after connecting Redis so the new environment variables are included.

No Vercel Blob token is required because `media.json` is public. The app refuses to run its party API without Redis credentials.

`REALMATE_ROOM_KEY` is optional. Set it when multiple apps share one Redis database and should not share the same party state. Otherwise production and preview deployments use separate default keys based on `VERCEL_ENV`.

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
