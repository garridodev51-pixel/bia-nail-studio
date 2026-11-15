-- =====================================================================
-- WhatsApp pelo WAHA: o sistema tem um único WhatsApp remetente, então
-- cada estúdio só informa o número que recebe os avisos (sem chave).
-- =====================================================================

drop function if exists public.save_whatsapp_alert(text, text, boolean);

alter table public.whatsapp_alerts drop column if exists api_key;

create or replace function public.save_whatsapp_alert(p_phone text, p_enabled boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_professional uuid := public.require_professional();
begin
  insert into public.whatsapp_alerts (professional_id, phone, enabled)
  values (v_professional, p_phone, coalesce(p_enabled, true))
  on conflict (professional_id) do update
    set phone = excluded.phone,
        enabled = excluded.enabled,
        updated_at = now();
end;
$$;

-- Mesma função de antes, agora sem a chave no destino do WhatsApp.
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
      select jsonb_build_object('phone', w.phone)
        from public.whatsapp_alerts w
       where w.professional_id = v_appt.professional_id and w.enabled)
  );
end;
$$;

revoke all on function public.save_whatsapp_alert(text, boolean) from public, anon;
grant execute on function public.save_whatsapp_alert(text, boolean) to authenticated;
revoke all on function public.claim_new_booking_alerts(uuid) from public;
grant execute on function public.claim_new_booking_alerts(uuid) to anon, authenticated;
