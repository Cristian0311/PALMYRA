-- Durable NCF range allocation for multi-device offline POS.
-- Ranges are reserved atomically in Supabase and consumed locally per device.
create table if not exists public.fiscal_ncf_sequences (
  fiscal_type text primary key,
  prefix text not null,
  next_number bigint not null,
  limit_number bigint not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_ncf_ranges (
  id text primary key,
  fiscal_type text not null references public.fiscal_ncf_sequences(fiscal_type),
  prefix text not null,
  device_id text not null,
  start_number bigint not null,
  end_number bigint not null,
  next_number bigint not null,
  reserved_at timestamptz not null default now(),
  exhausted_at timestamptz,
  status text not null default 'active',
  constraint fiscal_ncf_ranges_bounds_chk check (start_number > 0 and end_number >= start_number and next_number >= start_number and next_number <= end_number + 1)
);

create index if not exists fiscal_ncf_ranges_device_idx
  on public.fiscal_ncf_ranges(fiscal_type, device_id, status);

alter table public.fiscal_ncf_sequences enable row level security;
alter table public.fiscal_ncf_ranges enable row level security;

update public.settings
set store_config = jsonb_set(
  coalesce(store_config,'{}'::jsonb),
  '{fiscalConfigs}',
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'type','B01','name','Crédito Fiscal','prefix','B01','current',1,'limit',1000,'active',true),
    jsonb_build_object('id', gen_random_uuid()::text, 'type','B02','name','Consumo','prefix','B02','current',1,'limit',10000,'active',true)
  ),
  true
)
where id='global' and (store_config is null or store_config->'fiscalConfigs' is null);

create or replace function public.reserve_ncf_range_v2(
  p_fiscal_type text,
  p_device_id text,
  p_block_size integer default 100,
  p_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s record;
  cfg jsonb;
  v_start bigint;
  v_end bigint;
  v_block integer := greatest(1, least(coalesce(p_block_size,100),1000));
  v_range_id text := gen_random_uuid()::text;
  v_user_active boolean;
begin
  if nullif(btrim(p_fiscal_type),'') is null then raise exception 'Tipo fiscal requerido' using errcode='P0001'; end if;
  if nullif(btrim(p_device_id),'') is null or length(btrim(p_device_id)) > 128 then raise exception 'Dispositivo requerido' using errcode='P0001'; end if;
  if nullif(btrim(p_user_id),'') is null then raise exception 'Usuario requerido' using errcode='42501'; end if;

  select exists(select 1 from public.users u where u.id=p_user_id and u.is_active is true) into v_user_active;
  if not v_user_active then raise exception 'El trabajador no está activo o no existe' using errcode='42501'; end if;

  select elem into cfg
  from public.settings st, jsonb_array_elements(coalesce(st.store_config->'fiscalConfigs','[]'::jsonb)) elem
  where st.id='global' and elem->>'type'=p_fiscal_type
  limit 1;
  if cfg is null or coalesce((cfg->>'active')::boolean,false) is not true then raise exception 'El tipo fiscal % no está activo',p_fiscal_type using errcode='P0001'; end if;

  insert into public.fiscal_ncf_sequences(fiscal_type,prefix,next_number,limit_number,active,updated_at)
  values(p_fiscal_type,coalesce(cfg->>'prefix',''),greatest(1,coalesce((cfg->>'current')::bigint,1)),greatest(1,coalesce((cfg->>'limit')::bigint,1)),true,now())
  on conflict(fiscal_type) do update set
    prefix=excluded.prefix,
    limit_number=greatest(public.fiscal_ncf_sequences.limit_number,excluded.limit_number),
    active=true,
    next_number=greatest(public.fiscal_ncf_sequences.next_number,excluded.next_number),
    updated_at=now();

  select * into s from public.fiscal_ncf_sequences where fiscal_type=p_fiscal_type for update;
  if s.prefix is null or s.prefix='' then raise exception 'El prefijo fiscal no está configurado' using errcode='P0001'; end if;
  if s.next_number > s.limit_number then raise exception 'Se agotaron los folios fiscales para %',p_fiscal_type using errcode='P0001'; end if;

  v_start:=s.next_number;
  v_end:=least(s.limit_number,v_start+v_block-1);

  update public.fiscal_ncf_sequences set next_number=v_end+1,updated_at=now() where fiscal_type=p_fiscal_type;

  insert into public.fiscal_ncf_ranges(id,fiscal_type,prefix,device_id,start_number,end_number,next_number)
  values(v_range_id,p_fiscal_type,s.prefix,btrim(p_device_id),v_start,v_end,v_start);

  return jsonb_build_object('success',true,'range_id',v_range_id,'fiscal_type',p_fiscal_type,'prefix',s.prefix,'start_number',v_start,'end_number',v_end,'next_number',v_start);
end;
$function$;

revoke execute on function public.reserve_ncf_range(text,text,integer) from public, anon, authenticated;
revoke execute on function public.reserve_ncf_range_v2(text,text,integer,text) from public, anon, authenticated;
grant execute on function public.reserve_ncf_range_v2(text,text,integer,text) to anon, authenticated;
