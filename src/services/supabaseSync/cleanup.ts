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

export async function cleanupCloudDuplicates() {
  const supabase = getSupabase();
  if (!supabase) return { success: false, message: "Supabase no configurado" };

  const report = { deletedBranches: 0, deletedCategories: 0, deletedProducts: 0 };

  try {
    // 1. Limpiar Sucursales (por nombre normalizado: sin acentos, minúsculas, espacios colapsados)
    const { data: branches } = await supabase.from('branches').select('id, name').order('created_at', { ascending: true });
    if (branches && branches.length > 1) {
      const seenNames = new Map<string, string>(); // normName -> primaryId
      for (const b of branches) {
        const normName = normalizeSemanticText(b.name);
        if (seenNames.has(normName)) {
          const primaryId = seenNames.get(normName)!;
          // Validar que el candidato a eliminar realmente esté vacío antes de borrarlo
          const { count: invCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('branch_id', b.id);
          const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('branch_id', b.id);
          const { count: csCount } = await supabase.from('cash_sessions').select('*', { count: 'exact', head: true }).eq('branch_id', b.id);

          if ((invCount || 0) === 0 && (txCount || 0) === 0 && (csCount || 0) === 0) {
            // Seguro de eliminar
            await supabase.from('branches').delete().eq('id', b.id);
            report.deletedBranches++;
            console.log(`[MARÉ] Duplicado vacío de sucursal eliminado de Supabase: "${b.name}" (${b.id})`);
          } else {
            console.warn(`[MARÉ] Conflicto de sucursal con datos en ambos registros ("${b.name}" - ${b.id} vs ${primaryId}). No se elimina automáticamente.`);
          }
        } else {
          seenNames.set(normName, b.id);
        }
      }
    }

    // 2. Limpiar Categorías (por nombre normalizado)
    const { data: categories } = await supabase.from('categories').select('id, name').order('created_at', { ascending: true });
    if (categories && categories.length > 1) {
      const seenNames = new Map<string, string>();
      for (const c of categories) {
        const normName = normalizeSemanticText(c.name);
        if (seenNames.has(normName)) {
          const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category_id', c.id);
          if ((prodCount || 0) === 0) {
            await supabase.from('categories').delete().eq('id', c.id);
            report.deletedCategories++;
          }
        } else {
          seenNames.set(normName, c.id);
        }
      }
    }

    // 3. Limpiar Productos (por SKU normalizado o Nombre normalizado)
    const { data: products } = await supabase.from('products').select('id, name, sku').order('created_at', { ascending: true });
    if (products && products.length > 1) {
      const seenSkus = new Map<string, string>();
      const seenNames = new Map<string, string>();
      for (const p of products) {
        const normSku = p.sku ? normalizeSemanticText(p.sku) : '';
        const normName = normalizeSemanticText(p.name);
        let isDup = false;
        if (normSku && seenSkus.has(normSku)) isDup = true;
        else if (seenNames.has(normName)) isDup = true;

        if (isDup) {
          // Validar que no tenga inventario o transacciones
          const { count: invCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('product_id', p.id);
          if ((invCount || 0) === 0) {
            await supabase.from('products').delete().eq('id', p.id);
            report.deletedProducts++;
          }
        } else {
          if (normSku) seenSkus.set(normSku, p.id);
          seenNames.set(normName, p.id);
        }
      }
    }

    return { success: true, report };
  } catch (err: any) {
    console.warn("[cleanupCloudDuplicates] Error:", err);
    return { success: false, error: err.message };
  }
}

