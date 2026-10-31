-- ─────────────────────────────────────────────────────────────────────────────
-- Meeting-data version history.
--
-- Why: clients.session_json is a single blob that every autosave overwrites in
-- full. On 2026-10-09 a page that had failed to load a client autosaved blank
-- tools over that client's real meeting, and with no history the data was gone.
--
-- This trigger copies the PREVIOUS session_json into client_session_history
-- before every change. It runs inside Postgres, so no front-end bug can bypass
-- it — any overwrite, from any page or tool, can be rolled back.
--
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_session_history (
  id            bigserial primary key,
  client_id     uuid        not null references public.clients(id) on delete cascade,
  advisor_id    uuid,
  session_json  jsonb       not null,
  replaced_at   timestamptz not null default now()
);

create index if not exists client_session_history_client_idx
  on public.client_session_history (client_id, replaced_at desc);

create or replace function public.snapshot_client_session()
returns trigger
language plpgsql
security definer          -- inserts regardless of the caller's RLS policies
set search_path = public
as $$
begin
  if old.session_json is not null
     and old.session_json <> '{}'::jsonb
     and old.session_json is distinct from new.session_json then
    insert into public.client_session_history (client_id, advisor_id, session_json)
    values (old.id, old.advisor_id, old.session_json);
  end if;
  return new;
end;
$$;

drop trigger if exists clients_snapshot_session on public.clients;
create trigger clients_snapshot_session
  before update of session_json on public.clients
  for each row execute function public.snapshot_client_session();

-- Advisors can read their own clients' history; nobody can edit or delete it
-- through the API (no insert/update/delete policies — only the trigger writes).
alter table public.client_session_history enable row level security;

drop policy if exists "advisors read own history" on public.client_session_history;
create policy "advisors read own history"
  on public.client_session_history for select
  using (advisor_id = auth.uid());

-- ── Restoring a client (run by hand in the SQL editor) ───────────────────────
-- 1. Find the version you want:
--      select id, replaced_at, length(session_json::text) as size
--      from client_session_history
--      where client_id = '<client uuid>'
--      order by replaced_at desc;
--    (A much larger "size" than the current one is usually the good copy.)
--
-- 2. Restore it (the current version is itself snapshotted first, so this is
--    undoable too):
--      update clients
--      set session_json = (select session_json from client_session_history where id = <history id>)
--      where id = '<client uuid>';
