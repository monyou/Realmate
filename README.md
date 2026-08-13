# Reelmate

A group swiping app for choosing a movie or series together. Create a room from a public JSON link or a local JSON file, then share its unique URL. A round ends immediately when every participant likes the same title, or after every participant finishes the deck without a match.

Built with SvelteKit, Svelte 5, TypeScript, Tailwind CSS 4, Upstash Redis, and Bun.

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

The app refuses to run its party API without Redis credentials.

## Add your movies and series

Open the app without a `room` query parameter. Paste a public HTTP/HTTPS link to a JSON file or upload a `.json` file from your device. The file can be up to 2 MB and must contain a JSON array. Each item must have the data shape below; an internal stable ID is generated automatically.

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
- Every object must include all six fields shown above. Missing fields, unsupported fields, or an invalid value in any object reject the complete file.
- `genres` must be a non-empty array of genre names. Up to three are displayed on cards.
- `img` can be any browser-accessible image URL.
- `year` must be an integer.
- `imdbRating` must be a number between `0` and `10` and is displayed with one decimal place.
- The server validates and stores the list when the room is created.
- The server shuffles the stored list once per round, and all participants receive the same order.

## How the room behaves

- Creating a party generates a random room ID and adds it to a shareable `?room=...` URL.
- Everyone who opens the same generated URL joins the same isolated room; there are no accounts.
- Active lobby and swiping rooms expire after 24 hours without a heartbeat. Completed rooms expire after two hours without a heartbeat. Redis lock keys have a 12-second safety expiry.
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
