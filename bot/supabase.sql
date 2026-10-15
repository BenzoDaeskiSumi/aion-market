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

-- Price alerts (profiles.alerts = [{item, server, price, dir}]), used by /avviso and the 15-minute check.
create or replace function public.alerts_by_discord(did text)
returns table (alerts jsonb)
language sql stable security definer set search_path = public, auth
as $$
  select p.alerts from auth.identities i join public.profiles p on p.id = i.user_id
  where i.provider = 'discord' and i.provider_id = did limit 1
$$;
create or replace function public.set_alerts_by_discord(did text, a jsonb)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
begin
  update public.profiles p set alerts = a, updated_at = now()
  from auth.identities i where i.user_id = p.id and i.provider = 'discord' and i.provider_id = did;
  return found;
end $$;
create or replace function public.all_alerts()
returns table (discord_id text, alerts jsonb)
language sql stable security definer set search_path = public, auth
as $$
  select i.provider_id, p.alerts from auth.identities i join public.profiles p on p.id = i.user_id
  where i.provider = 'discord' and jsonb_array_length(p.alerts) > 0
$$;
revoke all on function public.alerts_by_discord(text) from public, anon, authenticated;
revoke all on function public.set_alerts_by_discord(text, jsonb) from public, anon, authenticated;
revoke all on function public.all_alerts() from public, anon, authenticated;
grant execute on function public.alerts_by_discord(text) to service_role;
grant execute on function public.set_alerts_by_discord(text, jsonb) to service_role;
grant execute on function public.all_alerts() to service_role;
