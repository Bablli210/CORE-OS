-- GymOS plain-wording tests (0015, owner request 2026-10-01): the first-contact deadline is described in plain
-- language. A missed deadline notifies "Contact overdue: <name>"; a newly assigned lead says how many hours the rep has.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

-- W1: an owned lead past its first-contact deadline, never contacted (seed: Rania Helal)
select fn_hourly_notifications();
select ok((select count(distinct n.recipient_profile_id) from notifications n join leads l on l.id::text = n.data->>'lead_id'
           where l.full_name = 'Rania Helal' and n.type = 'lead.sla_breach'
             and n.title = 'Contact overdue: Rania Helal' and n.body = 'Nobody has contacted this lead yet') >= 2
          and not exists (select 1 from notifications n join leads l on l.id::text = n.data->>'lead_id'
                          where l.full_name = 'Rania Helal' and n.type = 'lead.sla_breach' and n.title <> 'Contact overdue: Rania Helal'),
          'W1 overdue lead notifies the rep and the sales manager as "Contact overdue: <name>"');

-- W2: assigning an inbound lead tells the rep how many hours they have (setting sales.first_contact_sla_hours)
select fn_assign_lead((select id from leads where full_name = 'Inbound Lead A'), 'a0000000-0000-0000-0000-000000000011');
select ok((select body from notifications n join leads l on l.id::text = n.data->>'lead_id'
           where l.full_name = 'Inbound Lead A' and n.type = 'lead.assigned' order by n.created_at desc limit 1)
          = 'Contact them within ' || fn_setting_int('sales.first_contact_sla_hours', 2) || ' hours',
          'W2 a new assignment says "Contact them within <N> hours"');

-- W3: no first-contact notification uses the term "SLA" any more
select ok(not exists (select 1 from notifications where type in ('lead.sla_breach', 'lead.assigned')
                      and (title like '%SLA%' or coalesce(body, '') like '%SLA%')),
          'W3 no lead notification says "SLA"');

drop function ok(boolean, text);
select 'ALL PLAIN-WORDING TESTS PASSED' as result;
