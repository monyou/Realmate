# Reelmate

Reelmate helps a group choose a movie or series together. Account owners build private watch lists, select one or more lists, and open a shareable room. Everyone swipes through the same deck until the first unanimous match.

Built with SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4, Supabase Auth/Postgres, Upstash Redis, Vercel, and Bun.

## Architecture

- **Supabase Auth** owns email/password accounts and cookie-based SSR sessions.
- **Supabase Postgres** stores each user's private movie lists. Row Level Security restricts every list to its owner.
- **Upstash Redis** stores short-lived live-room state and serializes party mutations.
- **SvelteKit server actions** validate list data, enforce authentication, and create rooms.
- **Supabase Storage is not required yet.** Poster images are stored as external URLs; Storage can be added later for user uploads.

## User flow

1. A visitor lands on the public product page and chooses **Log in** or **Create account**.
2. After authentication, the visitor reaches `/profile`.
3. **New list** opens a form where multiple movies or series can be added.
4. The profile shows every saved list with a checkbox.
5. Selecting one or more lists reveals **Start matching**.
6. Reelmate combines the selected lists, creates a Redis-backed room, and redirects to its shareable `?room=...` link.
7. Guests can join the room without an account. At least two connected people are required to start swiping.

## Local setup

Install dependencies and create the local environment file:

```bash
bun install
cp .env.example .env
```

Fill these values in `.env`:

```dotenv
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
UPSTASH_REDIS_REST_URL=https://YOUR_DATABASE.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_REDIS_TOKEN
```

The Supabase URL and publishable key are available from the project's **Connect** dialog. Do not put a service-role or secret key in a `PUBLIC_` variable.

### Create the database table

Apply [`supabase/migrations/20260816000000_create_movie_lists.sql`](supabase/migrations/20260816000000_create_movie_lists.sql) through the Supabase SQL editor, or run `supabase db push` after linking the repository with the Supabase CLI.

The migration creates `public.movie_lists`, enables Row Level Security, and adds owner-only select, insert, update, and delete policies based on `auth.uid()`.

### Configure authentication

Email/password authentication is enabled by default on hosted Supabase projects. Hosted projects also require email confirmation by default.

In **Authentication → URL Configuration**:

- Set the development Site URL to `http://localhost:5173` when testing locally.
- Add `http://localhost:5173/auth/callback` to the redirect allow list.
- Add the production equivalent, such as `https://your-domain.com/auth/callback`, before deploying.

Supabase's default email sender is intended for testing and is rate-limited. Configure custom SMTP before production use.

### Start the app

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy to Vercel

1. Import the repository into Vercel. The project uses the official SvelteKit Vercel adapter and Node.js 22.
2. Add the two public Supabase variables to every required Vercel environment.
3. Connect an Upstash Redis database and add its REST URL and token.
4. Add the production `/auth/callback` URL to Supabase's redirect allow list.
5. Deploy or redeploy so the functions receive the updated variables.

The app deliberately has no in-memory fallback. Both local development and production use Redis for rooms.

## Movie and series fields

Every list entry contains:

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

- `type` must be `movie` or `series`.
- `genres` must contain at least one non-empty genre.
- `year` must be an integer from `1888` to `2100`.
- `img` is optional. When omitted, the bundled default poster is shown.
- `imdbRating` is optional. When omitted or set to `0`, the rating is shown as unknown.
- A list can contain up to 500 titles.
- The complete list is rejected if any entry is invalid.

## Room behavior

- Creating a party generates a unique room ID in a shareable `?room=...` URL.
- Guests do not need accounts to join an existing room.
- Active lobby and swiping rooms expire after 24 hours without a heartbeat. Completed rooms expire after two hours.
- Anyone in the lobby can start when at least two people are connected.
- People joining after a round starts spectate until the next round.
- A title matches only after every round participant swipes right on it.
- Refreshing preserves a participant's place. An absent participant is removed after the disconnect timeout.
- Swiping supports touch, mouse drag, buttons, and left/right arrow keys.

## Quality checks

All unit tests live in the top-level `tests/` directory.

```bash
bun run check
bun run test
bun run lint
bun run build
```
