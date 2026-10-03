import { getSupabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { enqueueOfflineItem } from '../offlineSync';
import { normalizeSemanticText } from '../../utils/textUtils';
import { 
  Product, Category, Branch, InventoryLevel, User, 
  BankCard, Customer, Currency, Transaction, CashRegisterSession,
  Warranty, ReturnItem, InventoryTransfer, IDNSettlementPrice,
  TimeShift, Quote, BankTransaction, SupplierOrder, InventoryAudit, SalarySettlement, Supplier,
  ReceiptConfig, StoreConfig
} from '../../types';
import { fetchAllRows, safeUpsert, safeUpsertMany, SyncResult } from './core';

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

export async function callOpenSessionRPC(session: CashRegisterSession): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('open_cash_session_v2', {
      p_user_id: session.userId,
      p_worker_name: session.workerName,
      p_branch_id: session.branchId,
      p_opening_amount: session.openingAmount,
      p_opened_at: session.openedAt,
      p_working_employee_ids: session.workingEmployeeIds || [],
      p_notes: session.notes || ''
    });

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    console.error("[RPC] open_cash_session_v2 failed:", e);
    return { success: false, error: e.message };
  }
}

export async function callOpenSessionRPCWithId(session: CashRegisterSession): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('open_cash_session_v3', {
      p_session_id: session.id, p_user_id: session.userId, p_worker_name: session.workerName,
      p_branch_id: session.branchId, p_opening_amount: session.openingAmount, p_opened_at: session.openedAt,
      p_working_employee_ids: session.workingEmployeeIds || [], p_notes: session.notes || ''
    });
    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] open_cash_session_v3 failed:', e);
    return { success: false, error: e.message, errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callProcessTransactionRPC(tx: Transaction): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('process_pos_transaction_v2', {
      p_id: tx.id,
      p_branch_id: tx.branchId,
      p_user_id: tx.userId,
      p_date: tx.date,
      p_total: tx.total,
      p_tax: tx.tax || 0,
      p_discount: tx.discount || 0,
      p_items: (tx.items || []).map(item => {
        if (!item) return null;
        const prod = item.product;
        return {
          product_id: typeof prod === 'string' ? prod : prod?.id,
          quantity: item.quantity || 0,
          variant_label: item.variantLabel || null,
          is_kit: (prod && typeof prod === 'object' && 'isKit' in prod) ? (prod as any).isKit === true : false,
          kit_components: (prod && typeof prod === 'object' && 'kitComponents' in prod) ? (prod as any).kitComponents || [] : []
        };
      }).filter(Boolean),
      p_payments: tx.payments || [],
      p_payment_method: tx.paymentMethod || 'cash',
      p_session_id: tx.sessionId,
      p_customer_id: tx.customerId || null,
      p_notes: tx.notes || ''
    });

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    console.error("[RPC] process_pos_transaction_v2 failed:", e);
    return { success: false, error: e.message, errorCode: e.code || e.statusCode || undefined };
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
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] complete_inventory_audit_v2 failed:', e);
    return { success: false, error: e.message, errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callReceiveSupplierOrderRPC(orderId: string, userId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('receive_supplier_order_v2', { p_order_id: orderId, p_user_id: userId });
    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] receive_supplier_order_v2 failed:', e);
    return { success: false, error: e.message, errorCode: e.code || e.statusCode || undefined };
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
      p_variants: params.variants, p_user_id: params.userId
    });
    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] process_inventory_transfer_v2 failed:', e);
    return { success: false, error: e.message, errorCode: e.code || e.statusCode || undefined };
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
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] complete_return_v2 failed:', e);
    return { success: false, error: e.message, errorCode: e.code || e.statusCode || undefined };
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
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] void_pos_transaction_v2 failed:', e);
    return { success: false, error: e.message, errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callCancelSessionRPC(
  sessionId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('cancel_cash_session_v2', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_reason: reason || 'Cancelación de turno'
    });

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    console.warn("[RPC] cancel_cash_session_v2 falló (" + (e?.message || e?.code || 'error') + "), ejecutando fallback resiliente en cliente:", e);

    try {
      // 1. Verificar estado actual del turno en la base de datos
      const { data: s } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (s?.status === 'cancelled') {
        return { success: true, data: { already_cancelled: true, session_id: sessionId, fallback: true } };
      }

      // 2. Anular ventas activas vinculadas a este turno
      const { data: txs } = await supabase
        .from('transactions')
        .select('id')
        .eq('session_id', sessionId)
        .is('deleted_at', null);

      let voidedCount = 0;
      if (txs && txs.length > 0) {
        for (const tx of txs) {
          try {
            const vRes = await callVoidTransactionRPC(tx.id, userId || 'system', reason || 'Cancelación de turno');
            if (vRes.success) {
              voidedCount++;
            } else {
              // Si el RPC de anulación falla, actualizar la transacción directamente
              await supabase
                .from('transactions')
                .update({
                  status: 'refunded',
                  deleted_at: new Date().toISOString(),
                  deleted_by: userId || 'system',
                  delete_reason: reason || 'Cancelación de turno'
                })
                .eq('id', tx.id);
              voidedCount++;
            }
          } catch (txErr) {
            console.warn('[RPC Fallback] Error anulando venta individual ' + tx.id + ':', txErr);
          }
        }
      }

      // 3. Actualizar cash_sessions sin referenciar updated_at ni closing_date para compatibilidad total
      const notesBase = s?.notes || '';
      const notesClean = notesBase.includes('__CANCELLED__')
        ? notesBase
        : (notesBase ? notesBase + ' ' : '') + '__CANCELLED__:turno_cancelado';

      const updateData: Record<string, any> = {
        status: 'cancelled',
        closed_at: s?.closed_at || new Date().toISOString(),
        delete_reason: reason || 'Cancelación de turno',
        deleted_at: null,
        deleted_by: null,
        notes: notesClean
      };

      const { error: updErr } = await supabase
        .from('cash_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (updErr) {
        console.error('[RPC Fallback] Error actualizando tabla cash_sessions:', updErr);
        return { success: false, error: updErr.message };
      }

      // 4. Registrar auditoría inmutable
      try {
        await supabase.from('audit_log').insert({
          user_id: userId || 'system',
          action: 'CANCEL_SESSION',
          entity_type: 'cash_session',
          entity_id: sessionId,
          meta: {
            reason: reason || 'Cancelación de turno',
            transactions_voided: voidedCount,
            fallback: true
          }
        });
      } catch (auditErr) {
        console.warn('[RPC Fallback] No se pudo guardar audit_log:', auditErr);
      }

      return { success: true, data: { session_id: sessionId, transactions_voided: voidedCount, fallback: true } };
    } catch (fallbackErr: any) {
      console.error('[RPC Fallback] Error crítico en fallback de cancelación:', fallbackErr);
      return { success: false, error: fallbackErr?.message || e.message };
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
        discrepancyDeduction: settlement.discrepancyDeduction || 0
      }
    });

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    console.warn("[RPC] close_cash_session_v2 falló (" + (e?.message || e?.code || 'error') + "), ejecutando fallback directo:", e);
    try {
      const { data: s } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (s?.status === 'closed') {
        return { success: true, data: { already_closed: true, session_id: sessionId, fallback: true } };
      }

      // Empaquetar balances en notes para compatibilidad sin updated_at
      let extendedNotes = notes || s?.notes || '';
      const meta = {
        closing_balances: closingBalances || [],
        closing_date: closedAt || new Date().toISOString()
      };
      if (extendedNotes.includes('__META__:')) {
        extendedNotes = extendedNotes.split('__META__:')[0].trim();
      }
      extendedNotes = (extendedNotes ? extendedNotes + ' ' : '') + '__META__:' + JSON.stringify(meta);

      const { error: updErr } = await supabase
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: closedAt || new Date().toISOString(),
          notes: extendedNotes
        })
        .eq('id', sessionId);

      if (updErr) {
        return { success: false, error: updErr.message };
      }

      // Crear o actualizar liquidación salarial
      if (settlement) {
        const settlementId = settlement.id || `settle-${sessionId}`;
        try {
          await supabase.from('salary_settlements').upsert({
            id: settlementId,
            user_id: settlement.userId || null,
            user_name: settlement.userName || '',
            session_id: sessionId,
            base_salary: settlement.baseSalary || 0,
            sales_goal: settlement.salesGoal || 0,
            commissions: settlement.commissions || 0,
            total: settlement.total || 0,
            date: closedAt || new Date().toISOString(),
            status: 'pending'
          });
        } catch (setErr) {
          console.warn('[RPC Fallback] No se pudo guardar liquidación salarial:', setErr);
        }
      }

      try {
        await supabase.from('audit_log').insert({
          user_id: settlement?.userId || 'system',
          action: 'CLOSE_SESSION',
          entity_type: 'cash_session',
          entity_id: sessionId,
          meta: {
            closing_balances: closingBalances,
            closed_at: closedAt,
            fallback: true
          }
        });
      } catch (auditErr) {
        console.warn('[RPC Fallback] No se pudo guardar audit_log en cierre:', auditErr);
      }

      return { success: true, data: { session_id: sessionId, fallback: true } };
    } catch (fbErr: any) {
      console.error("[RPC Fallback] Error cerrando sesión:", fbErr);
      return { success: false, error: fbErr?.message || e.message };
    }
  }
}

