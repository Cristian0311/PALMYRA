-- Atomic multi-product inventory transfer.
-- Reuses the single-product invariant checks inside one outer transaction,
-- so any failed item rolls back the whole batch.
create or replace function public.process_inventory_transfer_bulk_v2(
  p_batch_id text,
  p_from_branch_id text,
  p_to_branch_id text,
  p_items jsonb,
  p_user_id text
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  item jsonb;
  result jsonb;
  results jsonb := '[]'::jsonb;
  op_id text;
  product_id text;
  variants jsonb;
  seen_ops jsonb := '{}'::jsonb;
  item_count integer;
begin
  if nullif(btrim(p_batch_id), '') is null then
    raise exception 'Batch de traslado requerido' using errcode='P0001';
  end if;
  if nullif(btrim(p_from_branch_id), '') is null
     or nullif(btrim(p_to_branch_id), '') is null
     or p_from_branch_id = p_to_branch_id then
    raise exception 'Sucursales de traslado inválidas' using errcode='P0001';
  end if;
  if nullif(btrim(p_user_id), '') is null then
    raise exception 'Usuario de traslado requerido' using errcode='42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los artículos del batch deben ser un arreglo JSON' using errcode='P0001';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 100 then
    raise exception 'El batch debe contener entre 1 y 100 artículos' using errcode='P0001';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    op_id := nullif(btrim(item->>'operationId'), '');
    product_id := nullif(btrim(item->>'productId'), '');
    variants := item->'variants';

    if op_id is null or product_id is null or jsonb_typeof(variants) <> 'array' then
      raise exception 'Artículo de batch inválido' using errcode='P0001';
    end if;

    if seen_ops ? op_id then
      raise exception 'Operation ID duplicado en el batch: %', op_id using errcode='P0001';
    end if;
    seen_ops := seen_ops || jsonb_build_object(op_id, true);

    select public.process_inventory_transfer_v2(
      op_id,
      p_batch_id,
      product_id,
      p_from_branch_id,
      p_to_branch_id,
      variants,
      p_user_id
    ) into result;

    results := results || jsonb_build_array(result);
  end loop;

  return jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'items', results
  );
end;
$function$;

revoke execute on function public.process_inventory_transfer_bulk_v2(text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.process_inventory_transfer_bulk_v2(text,text,text,jsonb,text) to anon, authenticated;