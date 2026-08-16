create table if not exists public.movie_list_shares (
	list_id uuid not null references public.movie_lists (id) on delete cascade,
	user_id uuid not null references auth.users (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (list_id, user_id)
);

create index if not exists movie_list_shares_user_idx
	on public.movie_list_shares (user_id, created_at desc);

create schema if not exists private;

create or replace function private.is_movie_list_owner(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.movie_lists
		where id = target_list_id
			and user_id = (select auth.uid())
	);
$$;

create or replace function private.has_movie_list_share(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.movie_list_shares
		where list_id = target_list_id
			and user_id = (select auth.uid())
	);
$$;

revoke all on function private.is_movie_list_owner(uuid) from public;
revoke all on function private.has_movie_list_share(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_movie_list_owner(uuid) to authenticated;
grant execute on function private.has_movie_list_share(uuid) to authenticated;

alter table public.movie_list_shares enable row level security;

drop policy if exists "Users can read their own movie lists" on public.movie_lists;
drop policy if exists "Users can read accessible movie lists" on public.movie_lists;
create policy "Users can read accessible movie lists"
	on public.movie_lists for select
	to authenticated
	using (
		(select auth.uid()) = user_id
		or (select private.has_movie_list_share(id))
	);

drop policy if exists "Users can update their own movie lists" on public.movie_lists;
drop policy if exists "Users can update accessible movie lists" on public.movie_lists;
create policy "Users can update accessible movie lists"
	on public.movie_lists for update
	to authenticated
	using (
		(select auth.uid()) = user_id
		or (select private.has_movie_list_share(id))
	)
	with check (
		(select auth.uid()) = user_id
		or (select private.has_movie_list_share(id))
	);

drop policy if exists "Users can read shares for their lists" on public.movie_list_shares;
create policy "Users can read shares for their lists"
	on public.movie_list_shares for select
	to authenticated
	using (
		user_id = (select auth.uid())
		or (select private.is_movie_list_owner(list_id))
	);

revoke all on table public.movie_list_shares from anon;
revoke all on table public.movie_list_shares from authenticated;
grant select on table public.movie_list_shares to authenticated;

-- List collaborators can edit content, but neither owners nor collaborators can
-- transfer ownership or directly alter timestamps through the API.
revoke update on table public.movie_lists from authenticated;
grant update (name, description, items) on table public.movie_lists to authenticated;

create or replace function public.get_movie_list_share_emails(target_list_id uuid)
returns table (email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.is_movie_list_owner(target_list_id) then
		raise exception 'Only the list owner can view sharing settings' using errcode = '42501';
	end if;

	return query
	select lower(users.email)::text
	from public.movie_list_shares as shares
	join auth.users as users on users.id = shares.user_id
	where shares.list_id = target_list_id
	order by lower(users.email);
end;
$$;

create or replace function public.sync_movie_list_shares(
	target_list_id uuid,
	recipient_emails text[]
)
returns table (email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
	normalized_emails text[];
	missing_emails text[];
begin
	if not private.is_movie_list_owner(target_list_id) then
		raise exception 'Only the list owner can change sharing settings' using errcode = '42501';
	end if;

	select coalesce(array_agg(distinct normalized_email order by normalized_email), '{}'::text[])
	into normalized_emails
	from (
		select lower(btrim(input_email)) as normalized_email
		from unnest(coalesce(recipient_emails, '{}'::text[])) as requested(input_email)
		where btrim(input_email) <> ''
	) as normalized;

	select coalesce(array_agg(requested_email order by requested_email), '{}'::text[])
	into missing_emails
	from unnest(normalized_emails) as requested(requested_email)
	left join auth.users as users on lower(users.email) = requested_email
	where users.id is null;

	if cardinality(missing_emails) > 0 then
		raise exception 'No account found for: %', array_to_string(missing_emails, ', ')
			using errcode = 'P0001';
	end if;

	delete from public.movie_list_shares as shares
	where shares.list_id = target_list_id
		and shares.user_id not in (
			select users.id
			from auth.users as users
			where lower(users.email) = any(normalized_emails)
				and users.id <> (select auth.uid())
		);

	insert into public.movie_list_shares (list_id, user_id)
	select target_list_id, users.id
	from auth.users as users
	where lower(users.email) = any(normalized_emails)
		and users.id <> (select auth.uid())
	on conflict (list_id, user_id) do nothing;

	return query
	select lower(users.email)::text
	from public.movie_list_shares as shares
	join auth.users as users on users.id = shares.user_id
	where shares.list_id = target_list_id
	order by lower(users.email);
end;
$$;

revoke all on function public.get_movie_list_share_emails(uuid) from public;
revoke all on function public.sync_movie_list_shares(uuid, text[]) from public;
grant execute on function public.get_movie_list_share_emails(uuid) to authenticated;
grant execute on function public.sync_movie_list_shares(uuid, text[]) to authenticated;
