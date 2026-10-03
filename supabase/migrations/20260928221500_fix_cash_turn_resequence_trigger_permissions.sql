-- The trigger must be able to run the internal resequencing routine
-- when a cash session is deleted/soft-deleted through the browser.
-- Keep direct execution of the resequencer unavailable to public clients.

create or replace function public.resequence_cash_session_turns_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.resequence_cash_session_turns();
  return null;
end;
$function$;

revoke execute on function public.resequence_cash_session_turns() from public, anon, authenticated;
revoke execute on function public.resequence_cash_session_turns_trigger() from public, anon, authenticated;
