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
import { enqueueOfflineItem } from '../offlineQueue';

export async function pushProductToSupabase(product: Product) {
  const supabase = getSupabase();
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    enqueueOfflineItem('product', product, product.id);
    return;
  }

  try {
    let validCategoryId = product.categoryId || null;
    if (validCategoryId) {
      const { data: catRow, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', validCategoryId)
        .maybeSingle();
      // Un fallo de red no debe convertirse en una relación nula. Si la
      // dependencia no pudo validarse, la operación completa se reintenta
      // desde la cola durable en lugar de guardar un producto degradado.
      if (categoryError) throw categoryError;
      if (!catRow) {
        validCategoryId = null;
      }
    }

    const row: Record<string, any> = {
      id: product.id,
      name: product.name,
      sku: product.sku || null,
      barcode: product.barcode || null,
      cost_price: product.costPrice,
      price: product.price,
      margin: product.margin,
      category_id: validCategoryId,
      color: product.color || null,
      commission_value: product.commissionValue || 0,
      unit: product.unit || 'unidad',
      status: product.status || 'active',
      min_stock_alert: product.minStockAlert || 5,
      has_serial: product.hasSerial || false,
      warranty_days: product.warrantyDays || 0,
      is_kit: product.isKit || false,
      kit_items: product.kitItems || [],
      kit_components: product.kitComponents || product.kitItems || [],
      device_color: product.deviceColor || null,
      available_sizes: product.availableSizes || [],
      available_colors: product.availableColors || []
    };

    const { error } = await safeUpsert(supabase, 'products', row);
    if (error) {
      const msg = String(error.message || '');
      if (String(error.code || '') === 'P0001' || msg.includes('PRODUCT_DELETED')) {
        console.info('[pushProductToSupabase] Producto ya eliminado; se descarta una edición obsoleta.');
        return;
      }
      console.warn("Supabase push product warning:", error);
      enqueueOfflineItem('product', product, product.id);
    }
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    if (String(e?.code || '') === 'P0001' || msg.includes('PRODUCT_DELETED')) {
      console.info('[pushProductToSupabase] Producto ya eliminado; se descarta una edición obsoleta.');
      return;
    }
    console.warn("Supabase push product failed:", e);
    enqueueOfflineItem('product', product, product.id);
  }
}


export async function applyInventoryAdjustmentToSupabase(params: {
  operationId: string;
  productId: string;
  branchId: string;
  variantLabel?: string;
  delta: number;
  minQuantity?: number;
  userId?: string;
  movementType?: string;
}): Promise<{ success: boolean; data?: any; error?: string; conflict?: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('apply_inventory_adjustment_v2', {
      p_operation_id: params.operationId,
      p_product_id: params.productId,
      p_branch_id: params.branchId,
      p_variant_label: params.variantLabel || '',
      p_delta: Number(params.delta) || 0,
      p_min_quantity: Number(params.minQuantity) || 0,
      p_user_id: params.userId || null,
      p_movement_type: params.movementType || 'ADJUSTMENT'
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data, conflict: Boolean(data?.conflict) };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error de inventario' };
  }
}

export async function reconcileInventoryToSupabase(params: {
  operationId: string;
  productId: string;
  branchId: string;
  variantLabel?: string;
  expectedQuantity: number;
  newQuantity: number;
  minQuantity?: number;
  userId?: string;
}): Promise<{ success: boolean; data?: any; error?: string; conflict?: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('reconcile_inventory_v2', {
      p_operation_id: params.operationId,
      p_product_id: params.productId,
      p_branch_id: params.branchId,
      p_variant_label: params.variantLabel || '',
      p_expected_quantity: Number(params.expectedQuantity),
      p_new_quantity: Math.max(0, Number(params.newQuantity) || 0),
      p_min_quantity: Number(params.minQuantity) || 0,
      p_user_id: params.userId || null
    });
    if (error) return {
      success: false,
      error: [error.message, error.code && `code=${error.code}`, (error as any).status && `HTTP ${(error as any).status}`, error.details, error.hint].filter(Boolean).join(' · ')
    };
    return { success: !data?.conflict, data, conflict: Boolean(data?.conflict), error: data?.message };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error de reconciliación' };
  }
}

export async function pushInventoryToSupabase(level: InventoryLevel) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
    return;
  }

  try {
    const vLabel = level.variantLabel || '';

    // 0. Verificar y asegurar dependencias (sucursal y producto en Supabase)
    if (level.branchId) {
      const { data: bData } = await supabase.from('branches').select('id').eq('id', level.branchId).maybeSingle();
      if (!bData) {
        const storeBranch = useStore.getState().branches.find(b => b.id === level.branchId);
        if (storeBranch) {
          await pushBranchToSupabase(storeBranch);
        }
      }
    }

    if (level.productId) {
      const { data: pData } = await supabase.from('products').select('id').eq('id', level.productId).maybeSingle();
      if (!pData) {
        const storeProduct = useStore.getState().products.find(p => p.id === level.productId);
        if (storeProduct) {
          await pushProductToSupabase(storeProduct);
        }
      }
    }

    // 1. Buscar si ya existe el registro en la base de datos para la combinación producto/sucursal
    const { data: existingRows } = await supabase
      .from('inventory')
      .select('id, variant_label')
      .eq('product_id', level.productId)
      .eq('branch_id', level.branchId);

    const matchingRow = existingRows?.find(r => (r.variant_label || '') === vLabel);

    if (matchingRow) {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          quantity: Number(level.quantity) || 0,
          min_quantity: Number(level.minQuantity) || 0,
          variant_label: vLabel
        })
        .eq('id', matchingRow.id);

      if (!updateError) return;
    }

    // 2. Si no existe registro previo, insertar nuevo
    const isValidUUID = typeof level.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(level.id);
    const insertRow: Record<string, any> = {
      id: isValidUUID ? level.id : crypto.randomUUID(),
      product_id: level.productId,
      branch_id: level.branchId,
      variant_label: vLabel,
      quantity: Number(level.quantity) || 0,
      min_quantity: Number(level.minQuantity) || 0
    };

    const res = await safeUpsert(supabase, 'inventory', insertRow);
    if (res?.error) {
      enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
    }
  } catch (e) {
    console.warn("Supabase push inventory failed, encolando offline:", e);
    enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
  }
}

export async function pushTransactionToSupabase(tx: Transaction): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineItem('transaction', tx, tx.id);
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) {
    await enqueueOfflineItem('transaction', tx, tx.id);
    return false;
  }

  try {
    // La venta NO modifica el estado del turno. Apertura, cierre y cancelación
    // tienen sus propias operaciones atómicas; empujar aquí la sesión local
    // podría sobrescribir un estado remoto más reciente durante una reconexión.
    const row = {
      id: tx.id,
      date: tx.date,
      total: tx.total,
      tax: tx.tax || 0,
      discount: tx.discount || 0,
      branch_id: tx.branchId,
      customer_id: tx.customerId || null,
      user_id: tx.userId || null,
      status: tx.status || 'completed',
      ncf: tx.ncf || null,
      ncf_type: tx.ncfType || null,
      notes: tx.notes || '',
      payment_method: tx.paymentMethod || 'cash',
      session_id: tx.sessionId || null,
      change_given: tx.changeGiven || 0,
      items: tx.items || [],
      payments: tx.payments || [],
      change_payments: tx.changePayments || [],
      seller_employee_ids: tx.sellerEmployeeIds || [],
      deleted_at: tx.deletedAt || null,
      deleted_by: tx.deletedBy || null,
      delete_reason: tx.deleteReason || null
    };

    const res = await safeUpsert(supabase, 'transactions', row);
    if (res?.error) throw res.error;

    // Verificación física del registro. Para liquidaciones IDN esto evita el
    // antiguo "fire-and-forget": el cierre no avanza hasta saber que la fila existe.
    const { data: persisted, error: verifyError } = await supabase
      .from('transactions')
      .select('id,status,total,session_id')
      .eq('id', tx.id)
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (!persisted || persisted.id !== tx.id) {
      throw new Error('Supabase no confirmó la venta/liquidación en transactions.');
    }
    return true;
  } catch (e) {
    console.warn("Supabase push transaction failed, guardando en cola offline:", e);
    await enqueueOfflineItem('transaction', tx, tx.id);
    return false;
  }
}

export async function pushCashSessionToSupabase(session: CashRegisterSession): Promise<boolean> {
  const queue = () => enqueueOfflineItem('cash_session', session, session.id);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queue();
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) {
    await queue();
    return false;
  }

  try {
    // Los snapshots de caja pueden provenir de varias tablets. Primero leemos
    // el registro canónico y mezclamos los movimientos/empleados por ID para que
    // una actualización en Tablet A no borre lo que agregó Tablet B.
    const { data: remoteSession, error: remoteReadError } = await supabase
      .from('cash_sessions')
      .select('id,status,opened_at,closed_at,opening_balance,opening_amount,notes,deleted_at,deleted_by,delete_reason,branch_id,user_id,worker_name,working_employee_ids')
      .eq('id', session.id)
      .maybeSingle();
    if (remoteReadError) throw remoteReadError;

    const extractMeta = (notes: string | null | undefined) => {
      if (!notes || !notes.includes('__META__:')) {
        return {
          baseNotes: notes || '',
          movements: [] as any[],
          removedMovementIds: [] as string[],
          auditStatus: undefined as CashRegisterSession['auditStatus'],
          auditNotes: undefined as string | undefined
        };
      }
      const parts = notes.split('__META__:');
      const base = parts.shift() || '';
      try {
        const parsed = JSON.parse(parts.join('__META__:'));
        return {
          baseNotes: base.trim(),
          movements: Array.isArray(parsed?.movements) ? parsed.movements : [],
          removedMovementIds: Array.isArray(parsed?.removed_movement_ids)
            ? parsed.removed_movement_ids.map(String)
            : [],
          auditStatus: parsed?.audit_status as CashRegisterSession['auditStatus'] | undefined,
          auditNotes: typeof parsed?.audit_notes === 'string' ? parsed.audit_notes : undefined
        };
      } catch {
        return {
          baseNotes: base.trim(),
          movements: [] as any[],
          removedMovementIds: [] as string[],
          auditStatus: undefined as CashRegisterSession['auditStatus'],
          auditNotes: undefined as string | undefined
        };
      }
    };

    const localMeta = extractMeta(session.notes);
    const remoteMeta = extractMeta(remoteSession?.notes);
    const removedMovementIds = Array.from(new Set([
      ...remoteMeta.removedMovementIds,
      ...localMeta.removedMovementIds
    ]));
    const removedSet = new Set(removedMovementIds);
    const movementMap = new Map<string, any>();
    for (const movement of remoteMeta.movements) {
      if (movement?.id && !removedSet.has(String(movement.id))) movementMap.set(String(movement.id), movement);
    }
    for (const movement of localMeta.movements) {
      if (movement?.id && !removedSet.has(String(movement.id))) movementMap.set(String(movement.id), movement);
    }
    const mergedMovements = Array.from(movementMap.values())
      .sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')) || String(a?.id || '').localeCompare(String(b?.id || '')));

    const mergedEmployees = Array.from(new Set([
      ...(Array.isArray(remoteSession?.working_employee_ids) ? remoteSession.working_employee_ids : []),
      ...(session.workingEmployeeIds || [])
    ].filter(Boolean).map(String)));

    const effectiveStatus = remoteSession?.status || session.status;
    if (remoteSession && remoteSession.status !== 'open' && session.status === 'open') {
      console.warn('[CashSession] Snapshot local rechazado: el turno remoto ya está cerrado/cancelado.');
      return false;
    }

    let extendedNotes = localMeta.baseNotes || remoteMeta.baseNotes || '';
    const effectiveAuditStatus = session.auditStatus || localMeta.auditStatus || remoteMeta.auditStatus;
    const effectiveAuditNotes = session.auditNotes !== undefined
      ? session.auditNotes
      : (localMeta.auditNotes !== undefined ? localMeta.auditNotes : (remoteMeta.auditNotes || ''));
    const meta = {
      closing_balances: session.closingBalances?.length ? session.closingBalances : (() => {
        try {
          const remoteRaw = remoteSession?.notes?.includes('__META__:') ? JSON.parse(remoteSession.notes.split('__META__:')[1]) : null;
          return Array.isArray(remoteRaw?.closing_balances) ? remoteRaw.closing_balances : [];
        } catch { return []; }
      })(),
      closing_date: session.closingDate || remoteSession?.closed_at || null,
      movements: mergedMovements,
      removed_movement_ids: removedMovementIds,
      audit_status: effectiveAuditStatus || null,
      audit_notes: effectiveAuditNotes
    };
    extendedNotes = (extendedNotes ? extendedNotes + ' ' : '') + '__META__:' + JSON.stringify(meta);

    const row = {
      id: session.id,
      user_id: remoteSession?.user_id || session.userId || null,
      worker_name: remoteSession?.worker_name || session.workerName || null,
      branch_id: remoteSession?.branch_id || session.branchId,
      opened_at: remoteSession?.opened_at || session.openedAt,
      closed_at: effectiveStatus === 'open' ? null : (remoteSession?.closed_at || session.closedAt || null),
      opening_balance: remoteSession?.opening_balance ?? session.openingAmount ?? session.openingBalance ?? 0,
      opening_amount: remoteSession?.opening_amount ?? session.openingAmount ?? session.openingBalance ?? 0,
      status: effectiveStatus,
      notes: extendedNotes,
      working_employee_ids: mergedEmployees,
      deleted_at: remoteSession?.deleted_at || session.deletedAt || null,
      deleted_by: remoteSession?.deleted_by || session.deletedBy || null,
      delete_reason: remoteSession?.delete_reason || session.deleteReason || null
    };

    const res = await safeUpsert(supabase, 'cash_sessions', row);
    if (res?.error) {
      await queue();
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase push cash session failed, guardando en cola offline:", e);
    await queue();
    return false;
  }
}

export async function pushBranchToSupabase(branch: Branch) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('branch', branch, branch.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('branch', branch, branch.id);
    return;
  }

  try {
    // Verificar si ya existe una sucursal con el mismo nombre normalizado bajo otro ID
    const normName = normalizeSemanticText(branch.name);
    const { data: existingBranches } = await supabase.from('branches').select('id, name');
    const duplicate = existingBranches?.find(b => b.id !== branch.id && normalizeSemanticText(b.name) === normName);
    if (duplicate) {
      console.warn(`[MARÉ] Bloqueado push de sucursal duplicada a Supabase: "${branch.name}" ya existe como "${duplicate.name}" (${duplicate.id})`);
      return;
    }

    const row = {
      id: branch.id,
      name: branch.name,
      address: branch.address || null,
      phone: branch.phone || null,
      is_active: branch.isActive !== false,
      is_main: branch.isMain === true
    };

    const res = await safeUpsert(supabase, 'branches', row);
    if (res?.error) {
      console.warn("Supabase push branch warning:", res.error);
      enqueueOfflineItem('branch', branch, branch.id);
    }
  } catch (e) {
    console.warn("Supabase push branch failed, guardando en cola offline:", e);
    enqueueOfflineItem('branch', branch, branch.id);
  }
}

export async function deleteBranchFromSupabase(id: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineItem('branch_delete', { id }, id);
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) {
    await enqueueOfflineItem('branch_delete', { id }, id);
    return false;
  }
  try {
    const { count: invCount, error: invError } = await supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    const { count: txCount, error: txError } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    const { count: csCount, error: csError } = await supabase.from('cash_sessions').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    if (invError || txError || csError) throw invError || txError || csError;

    if ((invCount || 0) > 0 || (txCount || 0) > 0 || (csCount || 0) > 0) {
      const { error } = await supabase.from('branches').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      return true;
    }

    const { error: usersError } = await supabase.from('users').update({ branch_id: null, assigned_branch_id: null }).eq('branch_id', id);
    if (usersError) throw usersError;
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Supabase delete branch failed, guardando operación durable:", e);
    await enqueueOfflineItem('branch_delete', { id }, id);
    return false;
  }
}

export async function pushCategoryToSupabase(category: Category) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('category', category, category.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('category', category, category.id);
    return;
  }

  try {
    const row = {
      id: category.id,
      name: category.name,
      department: category.department || 'General',
      description: category.description || null,
      color: category.color || null,
      image: category.image || null
    };

    const result = await safeUpsert(supabase, 'categories', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('category', category, category.id);
    console.warn("Supabase push category failed:", e);
  }
}

export async function deleteCategoryFromSupabase(id: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineItem('category_delete', { id }, id);
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) {
    await enqueueOfflineItem('category_delete', { id }, id);
    return false;
  }
  try {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Supabase delete category failed, guardando operación durable:", e);
    await enqueueOfflineItem('category_delete', { id }, id);
    return false;
  }
}

export async function deleteProductFromSupabase(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const productId = String(id || '').trim();
  if (!productId) return false;

  try {
    const { data, error } = await supabase.rpc('delete_product_v2', { p_product_id: productId });
    if (error) throw error;
    if (data && data.success !== true) throw new Error('Supabase no confirmó el borrado del producto');

    const { data: remaining, error: verifyError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (remaining) throw new Error('El producto todavía existe en Supabase después del borrado');
    return true;
  } catch (e) {
    console.warn("Supabase delete product failed:", e);
    return false;
  }
}

export async function clearSupabaseData(confirmToken?: string): Promise<{ success: boolean; failed: string[] }> {
  if (confirmToken !== 'ELIMINAR') {
    throw new Error('Limpieza total bloqueada: requiere confirmación explícita ELIMINAR.');
  }
  const supabase = getSupabase();
  if (!supabase) return { success: false, failed: ['Supabase no configurado'] };

  console.debug("[clearSupabaseData] Iniciando limpieza total de Supabase...");

  // Dependencias primero. Incluimos tablas de movimientos que antes podían
  // quedar intactas aunque se borrara el historial principal.
  const tables = [
    'inventory_movements',
    'cash_movements',
    'inventory',
    'transactions',
    'cash_sessions',
    'idn_settlement_prices',
    'inventory_transfers',
    'inventory_audits',
    'supplier_orders',
    'returns',
    'warranties',
    'salary_settlements',
    'quotes',
    'time_shifts',
    'bank_transactions',
    'products',
    'categories',
    'users',
    'branches',
    'bank_cards',
    'customers',
    'suppliers'
  ];

  const failed: string[] = [];

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'error desconocido';
      failed.push(`${table}: ${message}`);
      console.error(`[clearSupabaseData] No se pudo limpiar ${table}:`, e);
    }
  }

  if (failed.length > 0) {
    return { success: false, failed };
  }

  console.debug("[clearSupabaseData] Limpieza total confirmada.");
  return { success: true, failed: [] };
}



export type ResetSection =
  | 'inventory' | 'reports' | 'catalog' | 'customers' | 'suppliers' | 'purchases'
  | 'cash' | 'bank' | 'users' | 'branches' | 'quotes' | 'settings';

/** Limpieza selectiva. Nunca debe interpretarse como "borrar todo". */
export async function clearSelectedDataFromSupabase(sections: ResetSection[]): Promise<{ success: boolean; failed: string[] }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, failed: ['Supabase no configurado'] };
  const selected = new Set(sections);
  const failed: string[] = [];
  const groups: Record<ResetSection, string[]> = {
    inventory: ['inventory_movements', 'inventory_transfers', 'inventory'],
    reports: ['transactions', 'cash_sessions', 'cash_movements', 'bank_transactions', 'inventory_audits', 'salary_settlements', 'returns', 'warranties'],
    catalog: ['idn_settlement_prices', 'products', 'categories'],
    customers: ['customers'],
    suppliers: ['supplier_orders', 'suppliers'],
    purchases: ['supplier_orders'],
    cash: ['cash_movements', 'cash_sessions', 'salary_settlements'],
    bank: ['bank_transactions', 'bank_cards'],
    users: ['users'],
    branches: ['branches'],
    quotes: ['quotes'],
    settings: ['currencies']
  };
  const tables = Array.from(new Set(Array.from(selected).flatMap(section => groups[section] || [])));
  for (const table of tables) {
    try {
      const query = table === 'currencies'
        ? supabase.from(table).delete().not('code', 'is', null)
        : supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await query;
      if (error) throw error;
    } catch (e) {
      failed.push(`${table}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }
  return { success: failed.length === 0, failed };
}

export async function clearHistoryFromSupabase(): Promise<{ success: boolean; failed: string[] }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, failed: ['Supabase no configurado'] };

  console.debug("[clearHistoryFromSupabase] Iniciando limpieza selectiva de Historial (Ventas/Turnos/Movimientos)...");

  // Only tables related to history/reports - PERSIST MASTER DATA (products, branches, users)
  const historyTables = [
    'transactions',
    'cash_sessions',
    'cash_movements',
    'bank_transactions',
    'inventory_transfers',
    'inventory_audits',
    'salary_settlements',
    'returns',
    'warranties'
  ];
  const failed: string[] = [];

  for (const table of historyTables) {
    try {
      console.debug(`[clearHistoryFromSupabase] Limpiando ${table}...`);
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error desconocido';
      failed.push(`${table}: ${message}`);
      console.warn(`[clearHistoryFromSupabase] Error en tabla ${table}:`, err);
    }
  }

  return { success: failed.length === 0, failed };
}

export async function pushUserToSupabase(user: User) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('user', user, user.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('user', user, user.id);
    return;
  }

  try {
    const email = user.email && user.email.trim().length > 0
      ? user.email
      : `${String(user.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}_${user.id.slice(0, 6)}@system.local`;

    const row: Record<string, any> = {
      id: user.id,
      name: user.name,
      email: email,
      password: user.password || null,
      role: user.role || 'employee',
      base_salary: user.baseSalary || 0,
      sales_goal: user.salesGoal || 0,
      branch_id: user.branchId || null,
      allowed_branches: user.allowedBranches || [],
      permissions: user.permissions || [],
      is_active: user.isActive !== false,
      is_independent: user.isIndependent === true,
      assigned_branch_id: user.assignedBranchId || user.branchId || null
    };

    const { error } = await safeUpsert(supabase, 'users', row);
    if (error) {
      console.warn("Supabase push user warning:", error);
    }
  } catch (e) {
    enqueueOfflineItem('user', user, user.id);
    console.warn("Supabase push user failed:", e);
  }
}

export async function pushIDNSettlementPriceToSupabase(price: IDNSettlementPrice) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('idn_settlement_price', price, price.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('idn_settlement_price', price, price.id);
    return;
  }

  try {
    const row = {
      id: price.id,
      user_id: price.userId,
      product_id: price.productId,
      settlement_price: price.settlementPrice
    };

    const result = await safeUpsert(supabase, 'idn_settlement_prices', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('idn_settlement_price', price, price.id);
    console.warn("Supabase push settlement price failed:", e);
  }
}

export async function deleteIDNSettlementPriceFromSupabase(id: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineItem('idn_settlement_price_delete', { id }, id);
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) {
    await enqueueOfflineItem('idn_settlement_price_delete', { id }, id);
    return false;
  }
  try {
    const { error } = await supabase.from('idn_settlement_prices').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Supabase delete settlement price failed, guardando operación durable:", e);
    await enqueueOfflineItem('idn_settlement_price_delete', { id }, id);
    return false;
  }
}

export async function deleteUserFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('users').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete user failed:", e);
  }
}

export async function pushCustomerToSupabase(customer: Customer) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('customer', customer, customer.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('customer', customer, customer.id);
    return;
  }

  try {
    const row = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || null,
      email: customer.email || null,
      tax_id: customer.taxId || null
    };

    const res = await safeUpsert(supabase, 'customers', row);
    if (res?.error) {
      enqueueOfflineItem('customer', customer, customer.id);
    }
  } catch (e) {
    console.warn("Supabase push customer failed, encolando offline:", e);
    enqueueOfflineItem('customer', customer, customer.id);
  }
}

export async function deleteCustomerFromSupabase(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Supabase delete customer failed:", e);
    return false;
  }
}

export async function pushInventoryTransferToSupabase(transfer: InventoryTransfer) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    // Verificar si el producto existe en Supabase; si no, empujarlo primero
    try {
      const { data: prodExists } = await supabase.from('products').select('id').eq('id', transfer.productId).maybeSingle();
      if (!prodExists) {
        const localProduct = useStore.getState().products.find(p => p.id === transfer.productId);
        if (localProduct) {
          await pushProductToSupabase(localProduct);
        }
      }
    } catch {
      // Continuar normalmente
    }

    const validUserId = transfer.userId && transfer.userId !== 'system' ? transfer.userId : null;
    const row = {
      id: transfer.id,
      product_id: transfer.productId,
      product_name: transfer.productName,
      from_branch_id: transfer.fromBranchId,
      from_branch_name: transfer.fromBranchName,
      to_branch_id: transfer.toBranchId,
      to_branch_name: transfer.toBranchName,
      variant_label: transfer.variantLabel || 'Estándar',
      quantity: transfer.quantity,
      variants: transfer.variants || [],
      date: transfer.date,
      user_id: validUserId,
      status: transfer.status || 'completed',
      batch_id: transfer.batchId || null,
      operation_id: transfer.operationId || transfer.id
    };
    const { error } = await safeUpsert(supabase, 'inventory_transfers', row);
    if (error) {
      console.warn("Supabase push transfer warning:", error);
    }
  } catch (e) {
    console.warn("Supabase push transfer failed:", e);
  }
}

export async function pushWarrantyToSupabase(warranty: Warranty) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('warranty', warranty, warranty.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('warranty', warranty, warranty.id);
    return;
  }
  try {
    const row = {
      id: warranty.id,
      product_id: warranty.productId,
      product_name: warranty.productName,
      transaction_id: warranty.transactionId,
      customer_id: warranty.customerId,
      customer_name: warranty.customerName,
      purchase_date: warranty.purchaseDate,
      expiry_date: warranty.expiryDate,
      serial_number: warranty.serialNumber,
      status: warranty.status
    };
    const result = await safeUpsert(supabase, 'warranties', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('warranty', warranty, warranty.id);
    console.warn("Supabase push warranty failed:", e);
  }
}

export async function pushCurrencyToSupabase(currency: Currency) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('currency', currency, currency.code);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('currency', currency, currency.code);
    return;
  }
  try {
    const row = {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      rate_to_base: currency.rateToBase,
      is_base: currency.isBase
    };
    const result = await safeUpsert(supabase, 'currencies', row, { onConflict: 'code' });
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('currency', currency, currency.code);
    console.warn("Supabase push currency failed:", e);
  }
}

export async function pushReturnToSupabase(returnItem: ReturnItem): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('return', returnItem, returnItem.id);
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('return', returnItem, returnItem.id);
    return false;
  }
  try {
    const row = {
      id: returnItem.id,
      transaction_id: returnItem.transactionId,
      product_id: returnItem.productId,
      quantity: returnItem.quantity,
      reason: returnItem.reason,
      date: returnItem.date,
      status: returnItem.status,
      type: returnItem.type,
      notes: returnItem.notes,
      variant_label: returnItem.variantLabel || '',
      branch_id: returnItem.branchId || null,
      replacement_product_id: returnItem.replacementProductId || null,
      replacement_quantity: returnItem.replacementQuantity || null,
      processed_by: returnItem.processedBy || null,
      refund_status: returnItem.refundStatus || (returnItem.type === 'refund' ? 'pending' : 'not_required'),
      refund_amount: returnItem.refundAmount ?? null,
      refund_currency_code: returnItem.refundCurrencyCode || null,
      refund_method: returnItem.refundMethod || null,
      refund_bank_card_id: returnItem.refundBankCardId || null,
      refund_transaction_id: returnItem.refundTransactionId || null,
      received_at: returnItem.receivedAt || null,
      refunded_at: returnItem.refundedAt || null
    };
    const result = await safeUpsert(supabase, 'returns', row);
    if (result?.error) throw result.error;
    const { data: persisted, error: verifyError } = await supabase
      .from('returns')
      .select('id,status,transaction_id,product_id,quantity')
      .eq('id', returnItem.id)
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (!persisted) throw new Error('Supabase no confirmó la devolución.');
    return true;
  } catch (e) {
    enqueueOfflineItem('return', returnItem, returnItem.id);
    console.warn("Supabase push return failed:", e);
    return false;
  }
}

export async function pushTimeShiftToSupabase(shift: TimeShift) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('time_shift', shift, shift.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('time_shift', shift, shift.id);
    return;
  }
  try {
    const row = {
      id: shift.id,
      user_id: shift.userId,
      clock_in: shift.clockIn,
      clock_out: shift.clockOut,
      notes: shift.notes
    };
    const result = await safeUpsert(supabase, 'time_shifts', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('time_shift', shift, shift.id);
    console.warn("Supabase push time shift failed:", e);
  }
}

export async function pushQuoteToSupabase(quote: Quote) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('quote', quote, quote.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('quote', quote, quote.id);
    return;
  }
  try {
    const row = {
      id: quote.id,
      branch_id: quote.branchId,
      user_id: quote.userId,
      customer_id: quote.customerId,
      date: quote.date,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      items: quote.items || [],
      status: quote.status,
      notes: quote.notes
    };
    const result = await safeUpsert(supabase, 'quotes', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('quote', quote, quote.id);
    console.warn("Supabase push quote failed:", e);
  }
}

export async function pushBankTransactionToSupabase(tx: BankTransaction) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('bank_transaction', tx, tx.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('bank_transaction', tx, tx.id);
    return;
  }
  try {
    const row = {
      id: tx.id,
      card_id: tx.cardId,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      reference: tx.reference,
      description: tx.description,
      transaction_id: tx.transactionId
    };
    const result = await safeUpsert(supabase, 'bank_transactions', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('bank_transaction', tx, tx.id);
    console.warn("Supabase push bank tx failed:", e);
  }
}

export async function deleteBankTransactionFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('bank_transactions').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete bank tx failed:", e);
  }
}

export async function pushBankCardToSupabase(card: BankCard) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('bank_card', card, card.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('bank_card', card, card.id);
    return;
  }
  try {
    const row = {
      id: card.id,
      name: card.name || card.bankName || 'Tarjeta Bancaria',
      bank: card.bank || card.bankName || 'Banco',
      bank_name: card.bankName || card.bank || 'Banco',
      card_holder: card.cardHolder || 'Titular',
      account_number: card.accountNumber || card.lastFourDigits || card.lastFour || '',
      phone: card.phone || '',
      last_four_digits: card.lastFourDigits || card.lastFour || (card.accountNumber ? String(card.accountNumber).slice(-4) : '0000'),
      balance: card.balance || 0,
      currency: card.currency || 'CUP',
      color: card.color || 'from-indigo-600 to-purple-800',
      is_active: card.isActive !== false
    };
    const result = await safeUpsert(supabase, 'bank_cards', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('bank_card', card, card.id);
    console.warn("Supabase push bank card failed:", e);
  }
}

export async function setBankCardBalanceToSupabase(cardId: string, expectedBalance: number, newBalance: number): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;
  const expected = Number(expectedBalance) || 0;
  const next = Math.max(0, Number(newBalance) || 0);
  const { data, error } = await supabase
    .from('bank_cards')
    .update({ balance: next })
    .eq('id', cardId)
    .eq('balance', expected)
    .select('id,balance');
  if (error) throw error;
  // false significa conflicto real: el saldo ya no coincide con el esperado.
  return Boolean(data?.length && Number(data[0]?.balance) === next);
}
export async function updateBankCardMetadataToSupabase(card: BankCard): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;

  const payload = {
    name: card.name || card.bankName || 'Tarjeta Bancaria',
    bank: card.bank || card.bankName || 'Banco',
    bank_name: card.bankName || card.bank || 'Banco',
    card_holder: card.cardHolder || 'Titular',
    account_number: card.accountNumber || card.lastFourDigits || card.lastFour || '',
    phone: card.phone || '',
    last_four_digits: card.lastFourDigits || card.lastFour || (card.accountNumber ? String(card.accountNumber).slice(-4) : '0000'),
    currency: card.currency || 'CUP',
    color: card.color || 'from-indigo-600 to-purple-800',
    is_active: card.isActive !== false
  };

  try {
    const { data, error } = await supabase.from('bank_cards').update(payload).eq('id', card.id).select('id');
    if (error) throw error;
    return Boolean(data?.length);
  } catch (e) {
    console.warn('Supabase bank card metadata update failed:', e);
    return false;
  }
}

export async function deleteBankCardFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('bank_cards').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete bank card failed:", e);
  }
}

export async function pushSupplierToSupabase(supplier: Supplier) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('supplier', supplier, supplier.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('supplier', supplier, supplier.id);
    return;
  }
  try {
    const row = {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      email: supplier.email || '',
      rating: supplier.rating || 5,
      type_of_merchandise: supplier.typeOfMerchandise || ''
    };
    const result = await safeUpsert(supabase, 'suppliers', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('supplier', supplier, supplier.id);
    console.warn("Supabase push supplier failed:", e);
  }
}

export async function deleteSupplierFromSupabase(id: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineItem('supplier_delete', { id }, id);
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) {
    await enqueueOfflineItem('supplier_delete', { id }, id);
    return false;
  }
  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Supabase delete supplier failed, guardando operación durable:", e);
    await enqueueOfflineItem('supplier_delete', { id }, id);
    return false;
  }
}

export async function pushSupplierOrderToSupabase(order: SupplierOrder) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('supplier_order', order, order.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('supplier_order', order, order.id);
    return;
  }
  try {
    const row = {
      id: order.id,
      supplier_id: order.supplierId,
      date: order.date,
      expected_delivery_date: order.expectedDeliveryDate,
      items: order.items || [],
      total: order.total,
      status: order.status,
      branch_id: order.branchId,
      transport_details: order.transportDetails,
      transport_cost: order.transportCost
    };
    const result = await safeUpsert(supabase, 'supplier_orders', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('supplier_order', order, order.id);
    console.warn("Supabase push supplier order failed:", e);
  }
}

export async function pushInventoryAuditToSupabase(audit: InventoryAudit) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('inventory_audit', audit, audit.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('inventory_audit', audit, audit.id);
    return;
  }
  try {
    const row = {
      id: audit.id,
      date: audit.date,
      branch_id: audit.branchId,
      user_id: audit.userId,
      status: audit.status,
      items: audit.items || [],
      notes: audit.notes
    };
    const result = await safeUpsert(supabase, 'inventory_audits', row);
    if (result?.error) throw result.error;
  } catch (e) {
    enqueueOfflineItem('inventory_audit', audit, audit.id);
    console.warn("Supabase push audit failed:", e);
  }
}

export async function pushSalarySettlementToSupabase(settlement: SalarySettlement) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('salary_settlement', settlement, settlement.id);
    return null;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('salary_settlement', settlement, settlement.id);
    return null;
  }
  try {
    // El esquema actual no tiene discrepancy_deduction. La deducción ya queda
    // reflejada en total y no se envía como columna adicional.
    const row = {
      id: settlement.id,
      user_id: settlement.userId || null,
      user_name: settlement.userName || '',
      session_id: settlement.sessionId || null,
      base_salary: Number(settlement.baseSalary) || 0,
      sales_goal: Number(settlement.salesGoal) || 0,
      commissions: Number(settlement.commissions) || 0,
      total: Number(settlement.total) || 0,
      date: settlement.date,
      status: settlement.status || 'pending'
    };
    const result = await safeUpsert(supabase, 'salary_settlements', row);
    if (result?.error) throw result.error;

    const { data: persisted, error: verifyError } = await supabase
      .from('salary_settlements')
      .select('id,user_id,session_id,total,status')
      .eq('id', settlement.id)
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (!persisted) throw new Error('Liquidación salarial no confirmada en Supabase después del upsert.');
    return persisted;
  } catch (e) {
    enqueueOfflineItem('salary_settlement', settlement, settlement.id);
    console.warn("Supabase push salary settlement failed:", e);
    return null;
  }
}

export async function pushReceiptConfigToSupabase(config: ReceiptConfig) {
  const supabase = getSupabase();
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    enqueueOfflineItem('receipt_config', config, 'global');
    return;
  }
  try {
    const { error } = await supabase.from('settings').upsert({
      id: 'global',
      receipt_config: config
    });
    if (error) {
      console.warn("Supabase push receipt config failed:", error);
      enqueueOfflineItem('receipt_config', config, 'global');
    }
  } catch (e) {
    console.warn("Supabase push receipt config exception:", e);
    enqueueOfflineItem('receipt_config', config, 'global');
  }
}

export async function pushStoreConfigToSupabase(config: StoreConfig & Record<string, any>) {
  const supabase = getSupabase();
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    enqueueOfflineItem('store_config', config, 'global');
    return;
  }
  try {
    // No reemplazar el JSON global con un snapshot incompleto. Esto protege
    // campos agregados por versiones nuevas (por ejemplo fiscalConfigs) cuando
    // una tablet todavía conserva una configuración anterior.
    const { data: current, error: readError } = await supabase
      .from('settings')
      .select('store_config')
      .eq('id', 'global')
      .maybeSingle();
    if (readError) throw readError;

    const currentConfig = (current?.store_config && typeof current.store_config === 'object')
      ? current.store_config
      : {};
    const mergedConfig = { ...currentConfig, ...config };

    const { error } = await supabase.from('settings').upsert({
      id: 'global',
      store_config: mergedConfig
    });
    if (error) {
      console.warn("Supabase push store config failed:", error);
      enqueueOfflineItem('store_config', config, 'global');
    }
  } catch (e) {
    console.warn("Supabase push store config exception:", e);
    enqueueOfflineItem('store_config', config, 'global');
  }
}


export async function pushCatalogConfigToSupabase(config: Record<string, any>) {
  const supabase = getSupabase();
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    enqueueOfflineItem('catalog_config', config, 'global');
    return;
  }
  try {
    const { error } = await supabase.from('settings').upsert({
      id: 'global',
      catalog_config: config
    });
    if (error) {
      console.warn("Supabase push catalog config failed:", error);
      enqueueOfflineItem('catalog_config', config, 'global');
    }
  } catch (e) {
    console.warn("Supabase push catalog config exception:", e);
    enqueueOfflineItem('catalog_config', config, 'global');
  }
}

export async function deleteTransactionFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    // Transactions are historical records. Never physically delete them from the client.
    const { error } = await supabase.from('transactions').update({
      deleted_at: new Date().toISOString(),
      delete_reason: 'Anulación desde sincronización'
    }).eq('id', id).is('deleted_at', null);
    if (error) console.warn("Supabase soft-delete transaction failed:", error);
  } catch (e) {
    console.warn("Supabase soft-delete transaction exception:", e);
  }
}
