create table if not exists public.movie_lists (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	name text not null check (char_length(name) between 1 and 80),
	description text not null default '' check (char_length(description) <= 500),
	items jsonb not null check (
		jsonb_typeof(items) = 'array'
		and jsonb_array_length(items) between 1 and 500
	),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists movie_lists_user_created_idx
	on public.movie_lists (user_id, created_at desc);

create or replace function public.set_movie_lists_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists movie_lists_set_updated_at on public.movie_lists;
create trigger movie_lists_set_updated_at
	before update on public.movie_lists
	for each row execute function public.set_movie_lists_updated_at();

alter table public.movie_lists enable row level security;

drop policy if exists "Users can read their own movie lists" on public.movie_lists;
create policy "Users can read their own movie lists"
	on public.movie_lists for select
	to authenticated
	using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own movie lists" on public.movie_lists;
create policy "Users can create their own movie lists"
	on public.movie_lists for insert
	to authenticated
	with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own movie lists" on public.movie_lists;
create policy "Users can update their own movie lists"
	on public.movie_lists for update
	to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own movie lists" on public.movie_lists;
create policy "Users can delete their own movie lists"
	on public.movie_lists for delete
	to authenticated
	using ((select auth.uid()) = user_id);

revoke all on table public.movie_lists from anon;
grant select, insert, update, delete on table public.movie_lists to authenticated;
