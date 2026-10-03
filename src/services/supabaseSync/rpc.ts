import { getSupabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { normalizeSemanticText } from '../../utils/textUtils';
import { 
  Product, Category, Branch, InventoryLevel, User, 
  BankCard, Customer, Currency, Transaction, CashRegisterSession,
  Warranty, ReturnItem, InventoryTransfer, IDNSettlementPrice,
  TimeShift, Quote, BankTransaction, SupplierOrder, InventoryAudit, SalarySettlement, Supplier,
  ReceiptConfig, StoreConfig
} from '../../types';
import { fetchAllRows, safeUpsert, safeUpsertMany, SyncResult } from './core';

function assertRpcSuccess(data: any, operation: string) {
  if (data && data.success === false) {
    const e: any = new Error(data.message || data.error || data.reason || `La operación ${operation} fue rechazada por Supabase`);
    e.code = data.code || data.error_code;
    throw e;
  }
  if (data == null) throw new Error(`Supabase no devolvió confirmación para ${operation}`);
}

function formatSupabaseError(e: any): string {
  if (!e) return 'Error desconocido';
  const parts = [e.message || String(e)];
  if (e.code) parts.push(`code=${e.code}`);
  if (e.status) parts.push(`status=${e.status}`);
  if (e.details) parts.push(`details=${e.details}`);
  if (e.hint) parts.push(`hint=${e.hint}`);
  return parts.join(' | ');
}

export async function logAuditEvent(entry: {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  meta?: any;
}) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('audit_log').insert({
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      old_data: entry.oldData,
      new_data: entry.newData,
      meta: entry.meta
    });
  } catch (e) {
    console.warn("Audit log failed:", e);
  }
}

export async function callOpenSessionRPC(session: CashRegisterSession): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  // Compatibilidad para callers antiguos: toda apertura usa el flujo estable
  // con ID de sesión y numeración atómica del servidor. Nunca volver a v2.
  return callOpenSessionRPCWithId(session);
}

export async function callOpenSessionRPCWithId(session: CashRegisterSession): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };

  // Use a stable-ID table insert for the browser path. The database trigger
  // assigns the authoritative global turn_number atomically, while the stable
  // session ID makes retries idempotent if the response is lost.
  //
  // The cash_sessions table also has a unique partial index enforcing one open
  // session per branch, so concurrent openings cannot create two active shifts.
  try {
    const openingAmount = Number(session.openingAmount ?? session.openingBalance ?? 0);
    const row = {
      id: session.id,
      user_id: session.userId || null,
      worker_name: session.workerName || null,
      branch_id: session.branchId,
      opened_at: session.openedAt,
      opening_balance: openingAmount,
      opening_amount: openingAmount,
      status: 'open',
      working_employee_ids: session.workingEmployeeIds || [],
      notes: session.notes || '',
    };

    const { data, error } = await supabase
      .from('cash_sessions')
      .insert(row)
      .select()
      .single();

    if (!error) return { success: true, data };

    // The insert can reach PostgreSQL and commit successfully while the HTTP
    // response is lost on a mobile/unstable connection. Before treating that
    // attempt as offline, query the stable session ID and recover the official
    // row so the terminal does not falsely report "cannot confirm".
    const existingById = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', session.id)
      .maybeSingle();

    if (existingById.data) {
      if (
        existingById.data.status === 'open' &&
        existingById.data.branch_id === session.branchId &&
        (
          existingById.data.user_id === session.userId ||
          (Array.isArray(existingById.data.working_employee_ids) &&
            existingById.data.working_employee_ids.includes(session.userId))
        )
      ) {
        return { success: true, data: existingById.data };
      }

      if (existingById.data.status !== 'open') {
        return {
          success: false,
          error: 'El turno ya existe y no está abierto; no se puede reabrir automáticamente.',
          errorCode: 'CASH_SESSION_REOPEN_BLOCKED'
        };
      }
    }

    // A retry must never reopen a session that was already closed/cancelled.
    // The previous upsert could overwrite its status back to "open".
    if (error.code === '23505') {
      const existing = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('id', session.id)
        .maybeSingle();

      if (existing.data) {
        if (existing.data.status === 'open' && existing.data.branch_id === session.branchId) {
          return { success: true, data: existing.data };
        }
        return {
          success: false,
          error: 'El turno ya existe y no está abierto; no se puede reabrir automáticamente.',
          errorCode: 'CASH_SESSION_REOPEN_BLOCKED'
        };
      }

      // Another device already owns the only open shift for this branch.
      // Do not create a local "phantom" shift that could later accept sales.
      const branchOpen = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('branch_id', session.branchId)
        .eq('status', 'open')
        .is('deleted_at', null)
        .maybeSingle();
      if (branchOpen.data) {
        const sameWorker =
          branchOpen.data.user_id === session.userId ||
          Array.isArray(branchOpen.data.working_employee_ids) &&
          branchOpen.data.working_employee_ids.includes(session.userId);

        if (sameWorker) {
          // Idempotencia a nivel de sucursal: otro intento/dispositivo del
          // mismo trabajador debe continuar el turno oficial ya existente.
          return { success: true, data: branchOpen.data };
        }

        return {
          success: false,
          data: branchOpen.data,
          error: `La sucursal ya tiene un turno abierto: ${branchOpen.data.worker_name || 'otro trabajador'}.`,
          errorCode: 'CASH_BRANCH_ALREADY_OPEN'
        };
      }
    }

    console.error('[CashSession] No se pudo crear el turno estable:', error);
    return { success: false, error: formatSupabaseError(error), errorCode: error.code || undefined };
  } catch (e: any) {
    console.error('[CashSession] Error creando turno estable:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callProcessTransactionRPC(tx: Transaction): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const rpcItems = (tx.items || []).map(item => {
      if (!item) return null;
      const prod = item.product;
      return {
        id: item.id,
        product_id: typeof prod === 'string' ? prod : prod?.id,
        product_name: typeof prod === 'object' ? prod?.name || null : null,
        product_sku: typeof prod === 'object' ? prod?.sku || null : null,
        product_snapshot: typeof prod === 'object' ? prod : null,
        quantity: item.quantity || 0,
        price: item.price ?? (typeof prod === 'object' ? prod?.price : null),
        total: item.total ?? ((item.price ?? (typeof prod === 'object' ? prod?.price : 0)) * (item.quantity || 0)),
        variant_label: item.variantLabel || null,
        selected_size: item.selectedSize || null,
        selected_color: item.selectedColor || null,
        serial_number: item.serialNumber || null,
        warranty_code: item.warrantyCode || null,
        is_kit: (prod && typeof prod === 'object' && 'isKit' in prod) ? (prod as any).isKit === true : false,
        kit_components: (prod && typeof prod === 'object' && 'kitComponents' in prod) ? (prod as any).kitComponents || [] : []
      };
    }).filter(Boolean);

    const { data, error } = await supabase.rpc('process_pos_transaction_v2', {
      p_id: tx.id,
      p_branch_id: tx.branchId,
      p_user_id: tx.userId,
      p_date: tx.date,
      p_total: tx.total,
      p_tax: tx.tax || 0,
      p_discount: tx.discount || 0,
      p_items: rpcItems,
      p_payments: tx.payments || [],
      p_payment_method: tx.paymentMethod || 'cash',
      p_session_id: tx.sessionId,
      p_customer_id: tx.customerId || null,
      p_notes: tx.notes || ''
    });

    if (error) throw error;
    assertRpcSuccess(data, 'process_pos_transaction_v2');

    // Idempotency is only valid when the existing row is the SAME operation.
    // Two terminals must never be allowed to reuse a locally generated ticket
    // and accidentally turn a second sale into a false success.
    const { data: persisted, error: verifyError } = await supabase
      .from('transactions')
      .select('id,branch_id,user_id,total,tax,discount,session_id,payment_method,status,items,payments,ncf,ncf_type')
      .eq('id', tx.id)
      .maybeSingle();

    if (verifyError) throw verifyError;
    if (!persisted) {
      const e: any = new Error('Supabase no confirmó la venta en la tabla transactions.');
      e.code = 'TRANSACTION_NOT_PERSISTED';
      throw e;
    }

    // NCF se asigna en el POS antes de la venta. La RPC de inventario/venta
    // existente no recibe esos campos, por compatibilidad con clientes anteriores,
    // así que los persistimos inmediatamente después de confirmar la fila.
    if (tx.ncf || tx.ncfType) {
      if (
        (persisted.ncf || null) !== null &&
        (tx.ncf || null) !== persisted.ncf
      ) {
        const e: any = new Error('Conflicto de NCF: el ticket ya tiene un comprobante fiscal diferente.');
        e.code = 'IDEMPOTENCY_CONFLICT';
        throw e;
      }
      if (
        (persisted.ncf_type || null) !== null &&
        (tx.ncfType || null) !== persisted.ncf_type
      ) {
        const e: any = new Error('Conflicto de tipo NCF: el ticket ya tiene otro tipo de comprobante fiscal.');
        e.code = 'IDEMPOTENCY_CONFLICT';
        throw e;
      }

      const { data: ncfRow, error: ncfError } = await supabase
        .from('transactions')
        .update({ ncf: tx.ncf || null, ncf_type: tx.ncfType || null })
        .eq('id', tx.id)
        .select('ncf,ncf_type')
        .maybeSingle();
      if (ncfError) throw ncfError;
      if (!ncfRow || (tx.ncf && ncfRow.ncf !== tx.ncf) || (tx.ncfType && ncfRow.ncf_type !== tx.ncfType)) {
        throw new Error('Supabase no confirmó el NCF después de guardarlo.');
      }
      (persisted as any).ncf = ncfRow.ncf;
      (persisted as any).ncf_type = ncfRow.ncf_type;
    }

    const persistedItems = Array.isArray(persisted.items) ? persisted.items : [];
    const persistedPayments = Array.isArray(persisted.payments) ? persisted.payments : [];
    // La columna transactions.items conserva el objeto completo del carrito,
    // mientras la RPC recibe una representación compacta. Comparar JSON crudo
    // provocaba falsos conflictos incluso cuando la venta acababa de insertarse
    // correctamente. Normalizamos ambas representaciones al mismo fingerprint.
    const normalizeItems = (items: any[]) => items.map((item: any) => {
      const prod = item?.product;
      const productId = typeof prod === 'string' ? prod : prod?.id || item?.product_id;
      const isKit = typeof prod === 'object' ? prod?.isKit === true : item?.is_kit === true;
      const components = typeof prod === 'object' ? (prod?.kitComponents || prod?.kitItems || []) : (item?.kit_components || []);
      return {
        product_id: productId || null,
        quantity: Number(item?.quantity) || 0,
        variant_label: item?.variantLabel || item?.variant_label || null,
        is_kit: isKit,
        kit_components: isKit ? components : []
      };
    });
    const sameItems = JSON.stringify(normalizeItems(persistedItems)) === JSON.stringify(normalizeItems(rpcItems));
    const normalizePayments = (payments: any[]) => payments.map((p:any) => ({
      method: p?.method || 'cash',
      amount: Number(p?.amount) || 0,
      currencyCode: p?.currencyCode || p?.currency_code || null,
      exchangeRate: Number(p?.exchangeRate ?? p?.exchange_rate ?? 0) || 0,
      bankCardId: p?.bankCardId || p?.bank_card_id || null
    }));
    const samePayments = JSON.stringify(normalizePayments(persistedPayments)) === JSON.stringify(normalizePayments(tx.payments || []));
    const sameCore =
      persisted.branch_id === tx.branchId &&
      persisted.user_id === tx.userId &&
      Number(persisted.total) === Number(tx.total) &&
      Number(persisted.tax || 0) === Number(tx.tax || 0) &&
      Number(persisted.discount || 0) === Number(tx.discount || 0) &&
      (persisted.session_id || null) === (tx.sessionId || null) &&
      (persisted.payment_method || 'cash') === (tx.paymentMethod || 'cash') &&
      persisted.status === 'completed';

    if (!sameCore || !sameItems || !samePayments) {
      const e: any = new Error('Conflicto de idempotencia: el ID del ticket ya pertenece a otra venta.');
      e.code = 'IDEMPOTENCY_CONFLICT';
      throw e;
    }

    // La RPC garantiza el stock y la creación atómica, pero no recibe algunos
    // metadatos del ticket por compatibilidad con su firma actual. Guardarlos
    // aquí evita que vendedor/cajero/subtotal/vuelto desaparezcan al sincronizar.
    const { data: metadataRow, error: metadataError } = await supabase
      .from('transactions')
      .update({
        subtotal: Number(tx.subtotal || 0),
        cashier_name: tx.cashierName || null,
        seller_employee_ids: tx.sellerEmployeeIds || [],
        change_given: Number(tx.changeGiven || 0),
        change_payments: tx.changePayments || [],
        ncf: tx.ncf || persisted.ncf || null,
        ncf_type: tx.ncfType || persisted.ncf_type || null
      })
      .eq('id', tx.id)
      .select('id,subtotal,cashier_name,seller_employee_ids,change_given,change_payments,ncf,ncf_type')
      .maybeSingle();

    if (metadataError) throw metadataError;
    if (!metadataRow) {
      const e: any = new Error('La venta existe, pero sus metadatos no pudieron persistirse.');
      e.code = 'TRANSACTION_METADATA_NOT_PERSISTED';
      throw e;
    }

    return { success: true, data: { ...(data || {}), persisted: { ...persisted, ...metadataRow }, already_existed: Boolean(data?.already_existed) } };
  } catch (e: any) {
    console.error("[RPC] process_pos_transaction_v2 failed:", e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callStartInventoryAuditRPC(
  auditId: string, branchId: string, userId: string, mode: 'physical' | 'cycle_count',
  blindCount: boolean, notes?: string
): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('start_inventory_audit_v2', {
      p_audit_id: auditId, p_branch_id: branchId, p_user_id: userId,
      p_mode: mode, p_blind_count: blindCount, p_notes: notes || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'start_inventory_audit_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] start_inventory_audit_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callSaveInventoryAuditCountRPC(
  auditId: string, userId: string, items: any[], notes?: string
): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('save_inventory_audit_count_v2', {
      p_audit_id: auditId, p_user_id: userId, p_items: items, p_notes: notes || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'save_inventory_audit_count_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] save_inventory_audit_count_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callRequestInventoryAuditRecountRPC(
  auditId: string, userId: string, notes?: string
): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('request_inventory_audit_recount_v2', {
      p_audit_id: auditId, p_user_id: userId, p_notes: notes || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'request_inventory_audit_recount_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] request_inventory_audit_recount_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callApproveInventoryAuditRPC(
  auditId: string, userId: string, notes?: string
): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('approve_inventory_audit_v2', {
      p_audit_id: auditId, p_user_id: userId, p_notes: notes || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'approve_inventory_audit_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] approve_inventory_audit_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callCompleteInventoryAuditRPC(auditId: string, branchId: string, userId: string, items: any[], notes?: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('complete_inventory_audit_v2', {
      p_audit_id: auditId, p_branch_id: branchId, p_user_id: userId, p_items: items, p_notes: notes || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'complete_inventory_audit_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] complete_inventory_audit_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callReceiveSupplierOrderRPC(orderId: string, userId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('receive_supplier_order_v2', { p_order_id: orderId, p_user_id: userId });
    if (error) throw error;
    assertRpcSuccess(data, 'receive_supplier_order_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] receive_supplier_order_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callReserveNCFRangeRPC(params: {
  fiscalType: string;
  deviceId: string;
  blockSize?: number;
  userId: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('reserve_ncf_range_v2', {
      p_fiscal_type: params.fiscalType,
      p_device_id: params.deviceId,
      p_block_size: params.blockSize || 100,
      p_user_id: params.userId
    });
    if (error) throw error;
    assertRpcSuccess(data, 'reserve_ncf_range_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] reserve_ncf_range_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callTransferInventoryBulkRPC(params: {
  batchId: string;
  fromBranchId: string;
  toBranchId: string;
  items: { operationId: string; productId: string; variants: { variantLabel: string; quantity: number }[] }[];
  userId: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('process_inventory_transfer_bulk_v2', {
      p_batch_id: params.batchId,
      p_from_branch_id: params.fromBranchId,
      p_to_branch_id: params.toBranchId,
      p_items: (params.items || []).map((item: any) => ({
        operationId: item.operationId,
        productId: item.productId,
        variants: Array.isArray(item.variants) ? item.variants.map((v: any) => ({
          variant_label: String(v?.variantLabel ?? v?.variant_label ?? '').trim(),
          quantity: Number(v?.quantity)
        })) : []
      })),
      p_user_id: params.userId
    });
    if (error) throw error;
    assertRpcSuccess(data, 'process_inventory_transfer_bulk_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] process_inventory_transfer_bulk_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callTransferInventoryRPC(params: {
  operationId: string; batchId?: string; productId: string; fromBranchId: string; toBranchId: string;
  variants: { variantLabel: string; quantity: number }[]; userId: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('process_inventory_transfer_v2', {
      p_operation_id: params.operationId, p_batch_id: params.batchId || null, p_product_id: params.productId,
      p_from_branch_id: params.fromBranchId, p_to_branch_id: params.toBranchId,
      p_variants: (params.variants || []).map((v: any) => ({
        variant_label: String(v?.variantLabel ?? v?.variant_label ?? '').trim(),
        quantity: Number(v?.quantity)
      })),
      p_user_id: params.userId
    });
    if (error) throw error;
    assertRpcSuccess(data, 'process_inventory_transfer_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] process_inventory_transfer_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callDeleteBankInternalTransferRPC(operationId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('delete_bank_internal_transfer_v2', { p_operation_id: operationId });
    if (error) throw error;
    assertRpcSuccess(data, 'delete_bank_internal_transfer_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] delete_bank_internal_transfer_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callDeleteBankTransactionRPC(transactionId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('delete_bank_transaction_v2', { p_transaction_id: transactionId });
    if (error) throw error;
    assertRpcSuccess(data, 'delete_bank_transaction_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] delete_bank_transaction_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callDeleteBankCardRPC(cardId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('delete_bank_card_safe_v2', { p_card_id: cardId });
    if (error) throw error;
    assertRpcSuccess(data, 'delete_bank_card_safe_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] delete_bank_card_safe_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callCompleteReturnRPC(returnId: string, userId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('complete_return_v2', { p_return_id: returnId, p_user_id: userId });
    if (error) throw error;
    assertRpcSuccess(data, 'complete_return_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] complete_return_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callVoidTransactionRPC(id: string, userId: string, reason: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('void_pos_transaction_v2', {
      p_id: id, p_user_id: userId, p_reason: reason
    });
    if (error) throw error;
    assertRpcSuccess(data, 'void_pos_transaction_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] void_pos_transaction_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callCancelSessionRPC(
  sessionId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  const verifyCancelled = async () => {
    const { data: persisted, error: verifyError } = await supabase
      .from('cash_sessions')
      .select('id,status,closed_at,delete_reason')
      .eq('id', sessionId)
      .maybeSingle();

    if (verifyError) throw verifyError;
    if (!persisted || persisted.status !== 'cancelled') {
      throw new Error('Supabase no confirmó el turno como cancelado');
    }
    return persisted;
  };

  try {
    const { data, error } = await supabase.rpc('cancel_cash_session_v2', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_reason: reason || 'Cancelación de turno'
    });

    if (error) throw error;
    assertRpcSuccess(data, 'cancel_cash_session_v2');
    const persisted = await verifyCancelled();
    return { success: true, data: { ...(data || {}), persisted } };
  } catch (e: any) {
    try {
      const persisted = await verifyCancelled();
      console.warn('[RPC] cancel_cash_session_v2 respondió con error, pero el turno ya consta como cancelado; reconciliando.');
      return {
        success: true,
        data: { success: true, already_cancelled: true, persisted }
      };
    } catch (verifyError: any) {
      console.warn('[RPC] cancel_cash_session_v2 failed; leaving operation for queue replay:', e);
      return {
        success: false,
        error: formatSupabaseError(e) || formatSupabaseError(verifyError)
      };
    }
  }
}

export async function callCloseSessionRPC(
  sessionId: string, 
  closingBalances: any[], 
  closedAt: string, 
  notes: string, 
  settlement: SalarySettlement
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('close_cash_session_v2', {
      p_session_id: sessionId,
      p_closing_balances: closingBalances,
      p_closed_at: closedAt,
      p_notes: notes,
      p_settlement_data: {
        userId: settlement.userId,
        userName: settlement.userName,
        baseSalary: settlement.baseSalary,
        commissions: settlement.commissions,
        total: settlement.total,
        salesGoal: settlement.salesGoal || 0
      }
    });

    if (error) throw error;
    assertRpcSuccess(data, 'close_cash_session_v2');
    return { success: true, data };
  } catch (e: any) {
    // No hacemos fallback directo: cerrar el turno y guardar la liquidación
    // deben permanecer atómicos. Si el RPC falló después de commit, el replay
    // de close_cash_session_v2 es idempotente y recupera el resultado.
    console.warn('[RPC] close_cash_session_v2 failed; leaving operation for queue replay:', e);
    return { success: false, error: formatSupabaseError(e) };
  }
}



export async function callProcessBankTransactionRPC(params: {
  id: string; cardId: string; type: string; amount: number; date?: string;
  reference?: string; description?: string; transactionId?: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('process_bank_transaction_v2', {
      p_id: params.id,
      p_card_id: params.cardId,
      p_type: params.type,
      p_amount: Number(params.amount) || 0,
      p_date: params.date || new Date().toISOString(),
      p_reference: params.reference || null,
      p_description: params.description || '',
      p_transaction_id: params.transactionId || null
    });
    if (error) throw error;
    assertRpcSuccess(data, 'process_bank_transaction_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] process_bank_transaction_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callBankInternalTransferRPC(params: {
  operationId: string;
  fromCardId: string;
  toCardId: string;
  amount: number;
  targetAmount: number;
  date: string;
  reason?: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('process_bank_internal_transfer_v2', {
      p_operation_id: params.operationId,
      p_from_card_id: params.fromCardId,
      p_to_card_id: params.toCardId,
      p_amount: params.amount,
      p_target_amount: params.targetAmount,
      p_date: params.date,
      p_reason: params.reason || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'process_bank_internal_transfer_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] process_bank_internal_transfer_v2 failed:', e);
    return {
      success: false,
      error: formatSupabaseError(e),
      errorCode: e.code || e.statusCode || undefined
    };
  }
}
