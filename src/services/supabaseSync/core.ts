import { getSupabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { enqueueOfflineItem } from '../offlineSync';
import { normalizeSemanticText } from '../../utils/textUtils';
import { 
  Product, Category, Branch, InventoryLevel, User, 
  BankCard, Customer, Currency, Transaction, CashRegisterSession,
  Warranty, ReturnItem, InventoryTransfer,
  TimeShift, Quote, BankTransaction, SupplierOrder, InventoryAudit, SalarySettlement, Supplier,
  ReceiptConfig, StoreConfig
} from '../../types';
export interface SyncResult {
  success: boolean;
  message: string;
  counts?: {
    products: number;
    categories: number;
    inventory: number;
    branches: number;
    users: number;
    bankCards: number;
    customers: number;
    currencies: number;
    transactions: number;
    cashSessions: number;
  };
  errors?: string[];
}
export async function fetchAllRows(supabase: any, table: string, orderColumn: string): Promise<any[]> {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select('*').order(orderColumn, { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

export async function safeUpsert(
  supabase: any,
  table: string,
  row: Record<string, any>,
  options?: any
): Promise<{ data: any; error: any }> {
  let currentRow = { ...row };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase.from(table).upsert(currentRow, options);
    if (!error) return { data, error: null };

    // 1. Error de columna faltante en caché de esquema Supabase (PGRST204)
    if (
      error.code === 'PGRST204' ||
      (error.message && (error.message.includes('in the schema cache') || error.message.includes('Could not find the')))
    ) {
      const match = error.message.match(/Could not find the ['"]([^'"]+)['"] column/i) ||
                    error.message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
      if (match && match[1]) {
        const missingCol = match[1];
        console.debug(`[safeUpsert] Columna '${missingCol}' no existe en '${table}'. Omitiendo y reintentando.`);
        delete currentRow[missingCol];
        continue;
      }
    }

    // 2. Error de clave foránea (error 23503)
    if (error.code === '23503') {
      let fkCol: string | null = null;
      if (error.details) {
        const fkMatch = error.details.match(/Key \(([^)]+)\)=/i);
        if (fkMatch && fkMatch[1]) fkCol = fkMatch[1];
      }
      if (!fkCol && error.message) {
        const mMatch = error.message.match(/violates foreign key constraint ".*?_([a-zA-Z0-9_]+)_fkey"/i) ||
                       error.message.match(/constraint "[a-zA-Z0-9_]+_([a-zA-Z0-9_]+)_fkey"/i);
        if (mMatch && mMatch[1]) fkCol = mMatch[1];
      }
      if (!fkCol) {
        if (table === 'products' && (error.details?.includes('categories') || error.message?.includes('category'))) {
          fkCol = 'category_id';
        } else if (table === 'inventory_transfers' && (error.details?.includes('products') || error.message?.includes('product'))) {
          fkCol = 'product_id';
        } else if (table === 'users' && (error.details?.includes('branches') || error.message?.includes('branch'))) {
          fkCol = 'branch_id';
        } else if (table === 'inventory' && (error.details?.includes('branches') || error.message?.includes('branch') || error.message?.includes('branches'))) {
          fkCol = 'branch_id';
        } else if (table === 'inventory' && (error.details?.includes('products') || error.message?.includes('product') || error.message?.includes('products'))) {
          fkCol = 'product_id';
        }
      }
      if (fkCol && currentRow[fkCol] !== undefined && currentRow[fkCol] !== null) {
        const fkVal = currentRow[fkCol];
        console.debug(`[safeUpsert] Llave foránea '${fkCol}' con valor '${fkVal}' falta en la tabla padre.`);
        
        try {
          if (fkCol === 'branch_id') {
            const storeBranch = useStore.getState().branches.find(b => b.id === fkVal);
            if (storeBranch) {
              await supabase.from('branches').upsert({
                id: storeBranch.id,
                name: storeBranch.name,
                address: storeBranch.address || null,
                phone: storeBranch.phone || null
              });
            } else {
              console.error(`[safeUpsert] Sucursal inexistente '${fkVal}'. Operación rechazada para preservar integridad.`);
              return { data: null, error };
            }
          } else if (fkCol === 'product_id') {
            const storeProduct = useStore.getState().products.find(p => p.id === fkVal);
            if (storeProduct) {
              await supabase.from('products').upsert({
                id: storeProduct.id,
                name: storeProduct.name,
                sku: storeProduct.sku,
                cost_price: storeProduct.costPrice || 0,
                price: storeProduct.price || 0
              });
            } else {
              // Si el producto no existe en absoluto, no podemos inventarlo sin ensuciar
              console.warn(`[safeUpsert] Registro huérfano detectado para producto '${fkVal}'. Abortando push.`);
              return { data: null, error };
            }
          } else if (fkCol === 'category_id') {
            const storeCategory = useStore.getState().categories.find(c => c.id === fkVal);
            if (storeCategory) {
              await supabase.from('categories').upsert({
                id: storeCategory.id,
                name: storeCategory.name
              });
            } else {
              console.error(`[safeUpsert] Categoría inexistente '${fkVal}'. Operación rechazada para preservar integridad.`);
              return { data: null, error };
            }
          }
        } catch (autoErr) {
          console.warn('[safeUpsert] Falló la recuperación de integridad:', autoErr);
          return { data: null, error };
        }
        continue;
      }
    }

    // 2b. Error de Clave Única Duplicada (error 23505)
    if (error.code === '23505') {
      // Si hay un conflicto de clave única genérico, podemos intentar ignorarlo o continuar
      return { data: null, error };
    }

    // 3. ID inválido / NOT NULL: nunca sustituir identificadores; eso rompe referencias
    // históricas. El error debe llegar al llamador y activar rollback/reintento explícito.
    if (error.code === '22P02' || error.code === '23502') {
      return { data: null, error };
    }

    // 4. Fallo en restricción ON CONFLICT
    if (error.message && error.message.includes('ON CONFLICT specification')) {
      console.debug(`[safeUpsert] Restricción ON CONFLICT no encontrada en '${table}'. Reintentando insert.`);
      return await supabase.from(table).insert(currentRow);
    }

    return { data, error };
  }
  return { data: null, error: new Error('safeUpsert: Máximo número de reintentos alcanzado') };
}

export async function safeUpsertMany(
  supabase: any,
  table: string,
  rows: Record<string, any>[],
  options?: any
): Promise<{ success: boolean; error?: any; errors?: string[]; processed?: number; failed?: number }> {
  if (!rows || rows.length === 0) return { success: true, processed: 0, failed: 0 };

  // First try one bulk upsert. It is faster and, when it succeeds, preserves
  // the atomic semantics expected by callers. If PostgREST rejects the batch
  // because of one bad row/schema mismatch, fall back to row-level recovery.
  try {
    const { error } = await supabase.from(table).upsert(rows, options);
    if (!error) return { success: true, processed: rows.length, failed: 0 };
    console.debug(`[safeUpsertMany] Upsert por lote en '${table}' falló (${error.message}). Reintentando por filas.`);
  } catch (e) {
    console.debug(`[safeUpsertMany] Excepción en lote '${table}'. Reintentando por filas.`, e);
  }

  const errors: string[] = [];
  let processed = 0;
  const chunkSize = 10;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(row => safeUpsert(supabase, table, row, options)));
    for (const result of results) {
      if (result.error) errors.push(result.error.message || String(result.error));
      else processed++;
    }
  }

  return {
    success: errors.length === 0,
    processed,
    failed: errors.length,
    ...(errors.length ? { error: new Error(`Fallaron ${errors.length} de ${rows.length} filas en '${table}'`), errors } : {})
  };
}

// Shared low-level helpers only. Domain operations live in dedicated modules.
