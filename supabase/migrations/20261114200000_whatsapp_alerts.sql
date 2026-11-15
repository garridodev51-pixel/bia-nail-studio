-- =====================================================================
-- Aviso de novos agendamentos no WhatsApp da dona do estúdio (CallMeBot).
--
-- Cada estúdio guarda o próprio número e a chave do CallMeBot. Só a dona
-- lê esses dados; o site público recebe o destino uma única vez, no mesmo
-- pedido que grava a reserva (função claim_new_booking_alerts).
-- =====================================================================

create table if not exists public.whatsapp_alerts (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{12,15}$'),
  api_key text not null check (char_length(api_key) between 1 and 64),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_alerts enable row level security;

drop policy if exists "Dona lê o próprio WhatsApp" on public.whatsapp_alerts;
create policy "Dona lê o próprio WhatsApp" on public.whatsapp_alerts
  for select to authenticated using (professional_id = public.current_professional_id());
-- Gravação só pelas funções abaixo (garantem o estúdio certo).
revoke insert, update, delete on public.whatsapp_alerts from anon, authenticated;
revoke all on public.whatsapp_alerts from anon;

-- ---------------------------------------------------------------------
-- Painel: salvar / remover
-- ---------------------------------------------------------------------
create or replace function public.save_whatsapp_alert(p_phone text, p_api_key text, p_enabled boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_professional uuid := public.require_professional();
begin
  insert into public.whatsapp_alerts (professional_id, phone, api_key, enabled)
  values (v_professional, p_phone, trim(p_api_key), coalesce(p_enabled, true))
  on conflict (professional_id) do update
    set phone = excluded.phone,
        api_key = excluded.api_key,
        enabled = excluded.enabled,
        updated_at = now();
end;
$$;

create or replace function public.delete_whatsapp_alert()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.whatsapp_alerts w where w.professional_id = public.require_professional();
$$;

-- ---------------------------------------------------------------------
-- Site público: depois de gravar a reserva, pede (uma única vez) todos os
-- destinos de aviso: aparelhos com push e o WhatsApp, se ativado.
-- Substitui claim_booking_notification, que continua existindo para o
-- código antigo.
-- ---------------------------------------------------------------------
create or replace function public.claim_new_booking_alerts(p_appointment_id uuid)
returns jsonb
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
    return null;
  end if;

  return jsonb_build_object(
    'client_name', v_appt.client_name,
    'client_phone', v_appt.client_phone,
    'service_name', v_appt.service_name,
    'starts_at', v_appt.starts_at,
    'push', coalesce(
      (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
         from public.push_subscriptions s
        where s.professional_id = v_appt.professional_id),
      '[]'::jsonb),
    'whatsapp', (
      select jsonb_build_object('phone', w.phone, 'api_key', w.api_key)
        from public.whatsapp_alerts w
       where w.professional_id = v_appt.professional_id and w.enabled)
  );
end;
$$;

revoke all on function public.save_whatsapp_alert(text, text, boolean) from public, anon;
revoke all on function public.delete_whatsapp_alert() from public, anon;
revoke all on function public.claim_new_booking_alerts(uuid) from public;
grant execute on function public.save_whatsapp_alert(text, text, boolean) to authenticated;
grant execute on function public.delete_whatsapp_alert() to authenticated;
grant execute on function public.claim_new_booking_alerts(uuid) to anon, authenticated;
