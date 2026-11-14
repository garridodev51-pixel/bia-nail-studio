-- =====================================================================
-- Notificações de novos agendamentos (Web Push, padrão dos navegadores).
--
-- Cada aparelho em que a dona do estúdio ativa as notificações guarda aqui
-- a sua "inscrição". Quando uma cliente agenda pelo link público, o site
-- pega (uma única vez) as inscrições do estúdio dono daquele agendamento
-- e envia o aviso. Nenhum outro estúdio recebe nem enxerga essas inscrições.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists push_subscriptions_endpoint_unique on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_professional_idx on public.push_subscriptions (professional_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Dona lê as próprias inscrições" on public.push_subscriptions;
create policy "Dona lê as próprias inscrições" on public.push_subscriptions
  for select to authenticated using (professional_id = public.current_professional_id());
drop policy if exists "Dona remove as próprias inscrições" on public.push_subscriptions;
create policy "Dona remove as próprias inscrições" on public.push_subscriptions
  for delete to authenticated using (professional_id = public.current_professional_id());
-- Gravação só pela função abaixo (garante o estúdio certo).
revoke insert, update on public.push_subscriptions from anon, authenticated;
revoke all on public.push_subscriptions from anon;

-- Marca se o aviso de uma reserva online já foi enviado (evita repetir).
alter table public.appointments add column if not exists notified_at timestamptz;

-- ---------------------------------------------------------------------
-- Painel: ativar / desativar neste aparelho
-- ---------------------------------------------------------------------
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_professional uuid := public.require_professional();
begin
  -- O mesmo navegador pode trocar de conta: a inscrição passa para a conta atual.
  insert into public.push_subscriptions (professional_id, user_id, endpoint, p256dh, auth, user_agent)
  values (v_professional, auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set professional_id = excluded.professional_id,
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions s
  where s.endpoint = p_endpoint and s.professional_id = public.require_professional();
$$;

-- ---------------------------------------------------------------------
-- Site público: depois de gravar a reserva, o servidor pede (uma única vez)
-- para onde avisar. Só funciona para reservas online recém-criadas e ainda
-- não avisadas; uma segunda chamada não devolve nada.
-- ---------------------------------------------------------------------
create or replace function public.claim_booking_notification(p_appointment_id uuid)
returns table (
  endpoint text,
  p256dh text,
  auth text,
  client_name text,
  service_name text,
  starts_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
begin
  update public.appointments a
     set notified_at = now()
   where a.id = p_appointment_id
     and a.notified_at is null
     and a.source = 'online'
     and a.created_at > now() - interval '5 minutes'
  returning * into v_appt;

  if v_appt.id is null then
    return;
  end if;

  return query
    select s.endpoint, s.p256dh, s.auth, v_appt.client_name, v_appt.service_name, v_appt.starts_at
    from public.push_subscriptions s
    where s.professional_id = v_appt.professional_id;
end;
$$;

-- Remove inscrições que o navegador avisou que não existem mais (aparelho
-- trocado, permissão retirada). Limitado ao estúdio daquela reserva e aos
-- minutos seguintes ao aviso.
create or replace function public.prune_push_subscriptions(p_appointment_id uuid, p_endpoints text[])
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions s
  using public.appointments a
  where a.id = p_appointment_id
    and a.notified_at > now() - interval '10 minutes'
    and s.professional_id = a.professional_id
    and s.endpoint = any (p_endpoints);
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.delete_push_subscription(text) from public;
revoke all on function public.claim_booking_notification(uuid) from public;
revoke all on function public.prune_push_subscriptions(uuid, text[]) from public;
revoke all on function public.save_push_subscription(text, text, text, text) from anon;
revoke all on function public.delete_push_subscription(text) from anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.claim_booking_notification(uuid) to anon, authenticated;
grant execute on function public.prune_push_subscriptions(uuid, text[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Painel aberto: recebe novas reservas na hora (Supabase Realtime).
-- O Realtime respeita o RLS: cada conta só recebe os próprios agendamentos.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
     ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;
