-- Lets the Discord bot read a user's favourites from their Discord id (run once in Supabase → SQL Editor).
-- Only the secret/service key can call it: the public anon key and logged-in users cannot.
create or replace function public.favorites_by_discord(did text)
returns table (favorites text[], server_id int)
language sql stable security definer set search_path = public, auth
as $$
  select p.favorites, p.server_id
  from auth.identities i join public.profiles p on p.id = i.user_id
  where i.provider = 'discord' and i.provider_id = did
  limit 1
$$;
revoke all on function public.favorites_by_discord(text) from public, anon, authenticated;
grant execute on function public.favorites_by_discord(text) to service_role;
