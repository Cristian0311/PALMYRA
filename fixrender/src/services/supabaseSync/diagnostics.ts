import { getSupabase, getSupabaseCredentials } from '../../lib/supabase';
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
import { pushProductToSupabase, applyInventoryAdjustmentToSupabase, reconcileInventoryToSupabase, pushInventoryToSupabase, pushTransactionToSupabase, pushCashSessionToSupabase, pushBranchToSupabase, deleteBranchFromSupabase, pushCategoryToSupabase, deleteCategoryFromSupabase, deleteProductFromSupabase, clearSupabaseData, clearHistoryFromSupabase, pushUserToSupabase, pushIDNSettlementPriceToSupabase, deleteIDNSettlementPriceFromSupabase, deleteUserFromSupabase, pushCustomerToSupabase, deleteCustomerFromSupabase, pushInventoryTransferToSupabase, pushWarrantyToSupabase, pushCurrencyToSupabase, pushReturnToSupabase, pushTimeShiftToSupabase, pushQuoteToSupabase, pushBankTransactionToSupabase, deleteBankTransactionFromSupabase, pushBankCardToSupabase, deleteBankCardFromSupabase, pushSupplierToSupabase, deleteSupplierFromSupabase, pushSupplierOrderToSupabase, pushInventoryAuditToSupabase, pushSalarySettlementToSupabase, pushReceiptConfigToSupabase, pushStoreConfigToSupabase } from './mutations';


export interface TableTestResult {
  table: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  count: number;
  canRead: boolean;
  canWrite: boolean;
}

export interface SupabaseDiagnosticReport {
  connected: boolean;
  url: string;
  tables: TableTestResult[];
  summary: string;
  timestamp: string;
}

export async function testSupabaseTables(): Promise<SupabaseDiagnosticReport> {
  const supabase = getSupabase();
  const { url } = getSupabaseCredentials();
  if (!supabase) return { connected:false, url, tables:[], summary:'No se pudo inicializar el cliente de Supabase. Revisa las credenciales.', timestamp:new Date().toISOString() };

  const tablesToTest = [
    { table:'branches', label:'Sucursales / Almacenes' }, { table:'users', label:'Usuarios y Empleados' },
    { table:'categories', label:'Categorías de Productos' }, { table:'products', label:'Productos del Inventario' },
    { table:'inventory', label:'Stock por Sucursal' }, { table:'idn_settlement_prices', label:'Precios Liquidación IDN' },
    { table:'transactions', label:'Ventas y Facturas' }, { table:'cash_sessions', label:'Sesiones de Caja' },
    { table:'customers', label:'Clientes' }, { table:'currencies', label:'Monedas y Tasas' },
    { table:'suppliers', label:'Proveedores' }, { table:'bank_cards', label:'Cuentas Bancarias' }
  ];
  const results: TableTestResult[] = [];
  for (const {table,label} of tablesToTest) {
    try {
      const { data, count, error } = await supabase.from(table).select('*',{count:'exact',head:false}).limit(5);
      if (error) { results.push({table,label,status:'error',message:`Fallo de lectura: ${error.message}`,count:0,canRead:false,canWrite:false}); continue; }
      const totalCount=count ?? data?.length ?? 0;
      results.push({table,label,status:'ok',message:`Lectura correcta (${totalCount} registros). Diagnóstico no destructivo.`,count:totalCount,canRead:true,canWrite:false});
    } catch (err:any) {
      results.push({table,label,status:'error',message:`Excepción: ${err?.message || 'Desconocido'}`,count:0,canRead:false,canWrite:false});
    }
  }
  const okCount=results.filter(r=>r.status==='ok').length;
  return { connected:true, url, tables:results, summary:`${okCount} de ${results.length} tablas accesibles en lectura.`, timestamp:new Date().toISOString() };
}

export async function pushAllToSupabase(isFull: boolean = false): Promise<{ success: boolean; pushed: Record<string, number>; errors: string[] }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, pushed: {}, errors: ["Supabase no configurado"] };

  const store = useStore.getState();
  const errors: string[] = [];
  
  // Persistir estado global primero
  try {
    await supabase.from('settings').upsert({
      id: 'global',
      last_turn_number: store.lastTurnNumber
    });
  } catch (e) {}

  const pushed: Record<string, number> = {
    branches: store.branches.length,
    categories: store.categories.length,
    users: store.users.length,
    bankCards: (store.bankCards || []).length,
    products: store.products.length,
    inventory: 0, // El stock nunca se sobrescribe por snapshot; usa RPC de movimientos.
    idnPrices: store.idnSettlementPrices.length,
    customers: store.customers.length,
    suppliers: (store.suppliers || []).length,
    supplierOrders: (store.supplierOrders || []).length,
    transactions: 0 // Las ventas solo se persisten mediante RPC idempotente.
  };

  try {
    // 1. Branches
    const branchRows = store.branches.map(b => ({
      id: b.id, name: b.name, address: b.address || '', phone: b.phone || ''
    }));
    { const r = await safeUpsertMany(supabase, 'branches', branchRows); if (!r.success) errors.push(`Sucursales: ${r.error?.message || 'fallo de guardado'}`); }

    // 2. Categories
    const categoryRows = store.categories.map(c => ({
      id: c.id, name: c.name, department: c.department || '', color: c.color || '#6366f1'
    }));
    { const r = await safeUpsertMany(supabase, 'categories', categoryRows); if (!r.success) errors.push(`Categorías: ${r.error?.message || 'fallo de guardado'}`); }

    // 3. Users
    const userRows = store.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email || `${String(u.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}_${u.id.slice(0, 6)}@system.local`,
      password: u.password || null,
      role: u.role || 'employee',
      base_salary: u.baseSalary || 0,
      sales_goal: u.salesGoal || 0,
      branch_id: u.branchId || null,
      allowed_branches: u.allowedBranches || [],
      permissions: u.permissions || [],
      is_active: u.isActive !== false,
      is_independent: u.isIndependent === true,
      assigned_branch_id: u.assignedBranchId || u.branchId || null
    }));
    { const r = await safeUpsertMany(supabase, 'users', userRows); if (!r.success) errors.push(`Usuarios: ${r.error?.message || 'fallo de guardado'}`); }

    // 4. Bank Cards
    const cardRows = (store.bankCards || []).map(bc => ({
      id: bc.id,
      name: bc.name || bc.bankName || 'Tarjeta',
      bank: bc.bank || bc.bankName || 'Banco',
      bank_name: bc.bankName || bc.bank || 'Banco',
      card_holder: bc.cardHolder || 'Titular',
      account_number: bc.accountNumber || bc.lastFourDigits || '',
      balance: Number(bc.balance) || 0,
      currency: bc.currency || 'CUP'
    }));
    { const r = await safeUpsertMany(supabase, 'bank_cards', cardRows); if (!r.success) errors.push(`Tarjetas: ${r.error?.message || 'fallo de guardado'}`); }

    // 5. Products
    const productRows = store.products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku || null,
      barcode: p.barcode || null,
      cost_price: p.costPrice || 0,
      price: p.price || 0,
      margin: p.margin || 0,
      category_id: p.categoryId || null,
      color: p.color || null,
      commission_value: p.commissionValue || 0,
      unit: p.unit || 'unidad',
      status: p.status || 'active',
      min_stock_alert: p.minStockAlert || 5,
      has_serial: p.hasSerial || false,
      warranty_days: p.warrantyDays || 0,
      is_kit: p.isKit || false,
      kit_items: p.kitItems || [],
      kit_components: p.kitComponents || p.kitItems || [],
      device_color: p.deviceColor || null,
      available_sizes: p.availableSizes || [],
      available_colors: p.availableColors || []
    }));
    { const r = await safeUpsertMany(supabase, 'products', productRows); if (!r.success) errors.push(`Productos: ${r.error?.message || 'fallo de guardado'}`); }

    // Set of valid IDs for foreign key reference safety
    const validProdIds = new Set(store.products.map(p => p.id));
    const validBranchIds = new Set(store.branches.map(b => b.id));

    // 6. Inventory
    // Deliberadamente no hacemos upsert del stock local. En un entorno multi-POS
    // offline eso convertiría un snapshot antiguo en una sobrescritura de cambios
    // remotos. Los cambios pasan por apply_inventory_adjustment_v2/reconcile_inventory_v2.

    // 7. IDN Prices
    const idnRows = store.idnSettlementPrices
      .filter(price => validProdIds.has(price.productId))
      .map(price => ({
        id: price.id,
        user_id: price.userId,
        product_id: price.productId,
        settlement_price: price.settlementPrice
      }));
    { const r = await safeUpsertMany(supabase, 'idn_settlement_prices', idnRows); if (!r.success) errors.push(`Precios IDN: ${r.error?.message || 'fallo de guardado'}`); }

    // 8. Customers
    const custRows = store.customers.map(cust => ({
      id: cust.id,
      name: cust.name,
      phone: cust.phone || null,
      email: cust.email || null,
      tax_id: cust.taxId || null
    }));
    { const r = await safeUpsertMany(supabase, 'customers', custRows); if (!r.success) errors.push(`Clientes: ${r.error?.message || 'fallo de guardado'}`); }

    // 9. Suppliers
    const supRows = (store.suppliers || []).map(sup => ({
      id: sup.id,
      name: sup.name,
      phone: sup.phone || '',
      address: sup.address || '',
      email: sup.email || '',
      rating: Number(sup.rating) || 5,
      type_of_merchandise: sup.typeOfMerchandise || ''
    }));
    { const r = await safeUpsertMany(supabase, 'suppliers', supRows); if (!r.success) errors.push(`Proveedores: ${r.error?.message || 'fallo de guardado'}`); }

    // 10. Supplier Orders
    const validSupIds = new Set((store.suppliers || []).map(s => s.id));
    const orderRows = (store.supplierOrders || [])
      .filter(o => !o.supplierId || validSupIds.has(o.supplierId))
      .map(o => ({
        id: o.id,
        supplier_id: o.supplierId || null,
        date: o.date,
        expected_delivery_date: o.expectedDeliveryDate || null,
        items: o.items || [],
        total: Number(o.total) || 0,
        status: o.status || 'pending',
        branch_id: o.branchId || null,
        transport_details: o.transportDetails || '',
        transport_cost: Number(o.transportCost) || 0
      }));
    { const r = await safeUpsertMany(supabase, 'supplier_orders', orderRows); if (!r.success) errors.push(`Órdenes de compra: ${r.error?.message || 'fallo de guardado'}`); }

    // 11. Transactions
    // Deliberadamente no insertamos ventas con upsert: una venta debe pasar por
    // process_pos_transaction_v2 para mantener inventario y movimientos coherentes.

    // 12. Returns: las devoluciones completadas también deben pasar por RPC.

    // 13. Warranties se conservan mediante sus operaciones propias.

    // 14. Bank transactions: no se reconstruyen desde un snapshot global.

    // 15. Cash sessions: se gestionan mediante RPC de apertura/cierre.

    // 16. Salary Settlements
    if ((store.salarySettlements || []).length > 0) {
      const settlementRows = store.salarySettlements.map(ss => ({
        id: ss.id,
        user_id: ss.userId,
        user_name: ss.userName,
        session_id: ss.sessionId || null,
        base_salary: Number(ss.baseSalary) || 0,
        commissions: Number(ss.commissions) || 0,
        sales_goal: Number(ss.salesGoal) || 0,
        total: Number(ss.total) || 0,
        date: ss.date,
        status: ss.status || 'pending'
      }));
      { const r = await safeUpsertMany(supabase, 'salary_settlements', settlementRows); if (!r.success) errors.push(`Liquidaciones: ${r.error?.message || 'fallo de guardado'}`); }
    }

    // 17. Inventory transfers: se procesan por RPC para mover stock atómicamente.


    return { success: errors.length === 0, pushed, errors };
  } catch (err: any) {
    errors.push(`Error en push total: ${err.message}`);
    return { success: false, pushed, errors };
  }
}

/**
 * Busca y elimina duplicados semánticos directamente en Supabase.
 * Útil para limpiar la base de datos de registros redundantes creados por múltiples dispositivos offline.
 */
