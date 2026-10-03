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

export async function pullBranchInventoryFromSupabase(branchId?: string): Promise<{ success: boolean; inventory: InventoryLevel[]; message?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, inventory: [], message: 'Supabase no configurado' };
  try {
    let query = supabase.from('inventory').select('*');
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) throw error;
    const inventory: InventoryLevel[] = (data || []).map((i: any) => ({
      id: i.id,
      productId: i.product_id,
      branchId: i.branch_id,
      variantLabel: i.variant_label || undefined,
      quantity: Number(i.quantity) || 0,
      minQuantity: Number(i.min_quantity) || 0
    }));
    return { success: true, inventory };
  } catch (e: any) {
    return { success: false, inventory: [], message: e?.message || 'No se pudo actualizar el inventario' };
  }
}


export async function pullPosBootstrapFromSupabase(branchId?: string): Promise<{ success: boolean; data: any; message?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, data: null, message: 'Supabase no configurado' };
  try {
    const [branchesRes, categoriesRes, productsRes, inventoryRes, usersRes, customersRes, currenciesRes, idnRes, txRes, sessionsRes, settingsRes] = await Promise.all([
      supabase.from('branches').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('products').select('*').eq('status', 'active'),
      branchId ? supabase.from('inventory').select('*').eq('branch_id', branchId) : supabase.from('inventory').select('*'),
      supabase.from('users').select('*').eq('is_active', true),
      supabase.from('customers').select('*').order('name').limit(5000),
      supabase.from('currencies').select('*'),
      supabase.from('idn_settlement_prices').select('*'),
      branchId ? supabase.from('transactions').select('*').eq('branch_id', branchId).order('date', { ascending: false }).limit(200) : supabase.from('transactions').select('*').order('date', { ascending: false }).limit(200),
      branchId ? supabase.from('cash_sessions').select('*').eq('branch_id', branchId).order('opened_at', { ascending: false }).limit(20) : supabase.from('cash_sessions').select('*').order('opened_at', { ascending: false }).limit(20),
      supabase.from('settings').select('*').eq('id', 'global').maybeSingle()
    ]);
    const firstError = [branchesRes,categoriesRes,productsRes,inventoryRes,usersRes,customersRes,currenciesRes,idnRes,txRes,sessionsRes].find(r => r.error)?.error;
    if (firstError) throw firstError;
    const mapProduct = (p:any): Product => ({ id:p.id,name:p.name,sku:p.sku||'',barcode:p.barcode||'',costPrice:Number(p.cost_price)||0,price:Number(p.price)||0,margin:Number(p.margin)||0,categoryId:p.category_id||'',color:p.color||'bg-slate-100 text-slate-700',commissionType:p.commission_type||'percentage',commissionValue:Number(p.commission_value)||0,unit:p.unit||'unidad',status:p.status||'active',minStockAlert:Number(p.min_stock_alert)||5,hasSerial:Boolean(p.has_serial),warrantyDays:Number(p.warranty_days)||0,isKit:Boolean(p.is_kit),kitItems:Array.isArray(p.kit_items)?p.kit_items:[],kitComponents:Array.isArray(p.kit_components)?p.kit_components:(Array.isArray(p.kit_items)?p.kit_items:[]),deviceColor:p.device_color||'',availableSizes:Array.isArray(p.available_sizes)?p.available_sizes:[],availableColors:Array.isArray(p.available_colors)?p.available_colors:[] });
    const mapInventory = (i:any): InventoryLevel => ({ id:i.id,productId:i.product_id,branchId:i.branch_id,variantLabel:i.variant_label||undefined,quantity:Number(i.quantity)||0,minQuantity:Number(i.min_quantity)||0 });
    const mapUser = (u:any): User => ({ id:u.id,name:u.name,email:u.email||'',password:u.password||'',role:u.role||'employee',commissionRate:Number(u.commission_rate)||0,baseSalary:Number(u.base_salary)||0,salesGoal:Number(u.sales_goal)||0,branchId:u.branch_id||undefined,allowedBranches:Array.isArray(u.allowed_branches)?u.allowed_branches:undefined,permissions:Array.isArray(u.permissions)?u.permissions:undefined,isActive:u.is_active!==false,isIndependent:u.is_independent===true,assignedBranchId:u.assigned_branch_id||undefined });
    const mapCustomer = (c:any): Customer => ({ id:c.id,name:c.name,email:c.email||'',phone:c.phone||'',taxId:c.tax_id||'' });
    const mapTx = (t:any): Transaction => ({ id:t.id,date:t.date,total:Number(t.total)||0,tax:Number(t.tax)||0,discount:Number(t.discount)||0,branchId:t.branch_id,customerId:t.customer_id,userId:t.user_id,status:t.status||'completed',notes:t.notes||'',paymentMethod:t.payment_method||'cash',sessionId:t.session_id,changeGiven:Number(t.change_given)||0,items:Array.isArray(t.items)?t.items:[],payments:Array.isArray(t.payments)?t.payments:[],changePayments:Array.isArray(t.change_payments)?t.change_payments:[],sellerEmployeeIds:Array.isArray(t.seller_employee_ids)?t.seller_employee_ids:[],deletedAt:t.deleted_at||undefined,deletedBy:t.deleted_by||undefined,deleteReason:t.delete_reason||undefined });
    const mapSession = (s:any): CashRegisterSession => ({ id:s.id,userId:s.user_id,workerName:s.worker_name,branchId:s.branch_id,openedAt:s.opened_at,closedAt:s.closed_at,openingBalance:Number(s.opening_balance??s.opening_amount)||0,openingAmount:Number(s.opening_amount??s.opening_balance)||0,closingBalances:Array.isArray(s.closing_balances)?s.closing_balances:[],status:s.status||'open',notes:s.notes||'',closingDate:s.closing_date||undefined,workingEmployeeIds:Array.isArray(s.working_employee_ids)?s.working_employee_ids:[],movements:Array.isArray(s.movements)?s.movements:[] });
    return { success:true, data:{
      branches:(branchesRes.data||[]).map((b:any)=>({id:b.id,name:b.name,address:b.address,phone:b.phone,isMain:b.is_main})),
      categories:(categoriesRes.data||[]).map((c:any)=>({id:c.id,name:c.name,department:c.department||'',color:c.color})),
      products:(productsRes.data||[]).map(mapProduct), inventory:(inventoryRes.data||[]).map(mapInventory), users:(usersRes.data||[]).map(mapUser),
      customers:(customersRes.data||[]).map(mapCustomer), currencies:(currenciesRes.data||[]).map((c:any)=>({code:c.code,name:c.name||c.code,symbol:c.symbol||c.code,rateToBase:Number(c.rate_to_base)||1,isBase:Boolean(c.is_base)})),
      idnSettlementPrices:(idnRes.data||[]).map((p:any)=>({id:p.id,userId:p.user_id,productId:p.product_id,settlementPrice:Number(p.settlement_price)||0})),
      transactions:(txRes.data||[]).map(mapTx), cashSessions:(sessionsRes.data||[]).map(mapSession), settings:settingsRes.data||null
    }};
  } catch (e:any) { return { success:false, data:null, message:e?.message||'No se pudo cargar el caché POS' }; }
}

export async function pullAllFromSupabase(): Promise<{ data: any; result: SyncResult }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: null,
      result: {
        success: false,
        message: "Supabase no está configurado. Ingresa la URL y Clave Anon en Configuración."
      }
    };
  }

  const errors: string[] = [];
  const fetchedData: any = {};

  try {
    // 1. Categories
    try {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.categories = data.map((c: any): Category => ({
          id: c.id,
          name: c.name,
          department: c.department || '',
          color: c.color
        }));
      }
    } catch (e: any) {
      errors.push(`Categorías: ${e.message}`);
    }

    // 2. Branches
    try {
      const { data, error } = await supabase.from('branches').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.branches = data.map((b: any): Branch => ({
          id: b.id,
          name: b.name,
          address: b.address,
          phone: b.phone,
          isMain: b.is_main
        }));
      }
    } catch (e: any) {
      errors.push(`Sucursales: ${e.message}`);
    }

    // 3. Products
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.products = data.map((p: any): Product => ({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          barcode: p.barcode || '',
          costPrice: Number(p.cost_price) || 0,
          price: Number(p.price) || 0,
          margin: Number(p.margin) || (Number(p.price) - Number(p.cost_price)),
          categoryId: p.category_id || '',
          color: p.color || 'bg-slate-100 text-slate-700',
          commissionType: p.commission_type || 'percentage',
          commissionValue: Number(p.commission_value) || 0,
          unit: p.unit || 'unidad',
          status: p.status || 'active',
          minStockAlert: p.min_stock_alert || 5,
          hasSerial: Boolean(p.has_serial),
          warrantyDays: p.warranty_days || 0,
          isKit: Boolean(p.is_kit),
          kitItems: Array.isArray(p.kit_items) ? p.kit_items : [],
          kitComponents: Array.isArray(p.kit_components) ? p.kit_components : (Array.isArray(p.kit_items) ? p.kit_items : []),
          deviceColor: p.device_color || '',
          availableSizes: Array.isArray(p.available_sizes) ? p.available_sizes : [],
          availableColors: Array.isArray(p.available_colors) ? p.available_colors : []
        }));
      }
    } catch (e: any) {
      errors.push(`Productos: ${e.message}`);
    }

    // 4. Inventory
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.inventory = data.map((i: any): InventoryLevel => ({
          id: i.id,
          productId: i.product_id,
          branchId: i.branch_id,
          variantLabel: i.variant_label || undefined,
          quantity: Number(i.quantity) || 0,
          minQuantity: Number(i.min_quantity) || 0
        }));
      }
    } catch (e: any) {
      errors.push(`Inventario: ${e.message}`);
    }

    // 5. Users
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.users = data.map((u: any): User => ({
          id: u.id,
          name: u.name,
          email: u.email || '',
          password: u.password || '',
          role: u.role || 'employee',
          commissionRate: Number(u.commission_rate) || 0,
          baseSalary: Number(u.base_salary) || 0,
          salesGoal: Number(u.sales_goal) || 0,
          branchId: u.branch_id || undefined,
          allowedBranches: Array.isArray(u.allowed_branches) ? u.allowed_branches : undefined,
          permissions: Array.isArray(u.permissions) ? u.permissions : undefined,
          isActive: u.is_active !== false,
          isIndependent: u.is_independent === true,
          assignedBranchId: u.assigned_branch_id || undefined
        }));
      }
    } catch (e: any) {
      errors.push(`Usuarios: ${e.message}`);
    }

    // 6. IDN Settlement Prices
    try {
      const { data, error } = await supabase.from('idn_settlement_prices').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.idnSettlementPrices = data.map((p: any): IDNSettlementPrice => ({
          id: p.id,
          userId: p.user_id,
          productId: p.product_id,
          settlementPrice: Number(p.settlement_price) || 0
        }));
      }
    } catch (e: any) {
      errors.push(`Precios de Liquidación IDN: ${e.message}`);
    }

    // 6. Bank Cards
    try {
      const { data, error } = await supabase.from('bank_cards').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.bankCards = data.map((bc: any): BankCard => ({
          id: bc.id,
          name: bc.name || bc.card_holder || bc.bank_name || 'Tarjeta Bancaria',
          bank: bc.bank || bc.bank_name || 'Banco',
          bankName: bc.bank_name || bc.bank || 'Banco',
          cardHolder: bc.card_holder || bc.name || 'Titular',
          accountNumber: bc.account_number || bc.accountNumber || bc.last_four_digits || bc.last_four || '',
          lastFour: bc.last_four || bc.last_four_digits || (bc.account_number ? String(bc.account_number).slice(-4) : ''),
          lastFourDigits: bc.last_four_digits || bc.last_four || (bc.account_number ? String(bc.account_number).slice(-4) : ''),
          phone: bc.phone || '',
          currency: bc.currency || 'CUP',
          balance: Number(bc.balance) || 0,
          color: bc.color || 'from-blue-600 to-indigo-800',
          isActive: bc.is_active !== false
        }));
      }
    } catch (e: any) {
      errors.push(`Tarjetas Bancarias: ${e.message}`);
    }

    // 6b. Bank Transactions
    try {
      const data = await fetchAllRows(supabase, 'bank_transactions', 'date'); const error = null;
      if (!error && data && Array.isArray(data)) {
        fetchedData.bankTransactions = data.map((bt: any): BankTransaction => ({
          id: bt.id,
          cardId: bt.card_id || bt.cardId,
          type: bt.type,
          amount: Number(bt.amount) || 0,
          date: bt.date,
          reference: bt.reference || '',
          description: bt.description || '',
          transactionId: bt.transaction_id || bt.transactionId
        }));
      }
    } catch (e: any) {
      // Non-fatal
    }

    // 7. Customers
    try {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.customers = data.map((c: any): Customer => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          taxId: c.tax_id || ''
        }));
      }
    } catch (e: any) {
      errors.push(`Clientes: ${e.message}`);
    }

    // 8. Currencies (Strictly CUP, USD, EUR)
    try {
      const { data, error } = await supabase.from('currencies').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        const allowedCodes = ['CUP', 'USD', 'EUR'];
        fetchedData.currencies = data
          .filter((c: any) => allowedCodes.includes(c.code))
          .map((c: any): Currency => ({
            code: c.code,
            name: c.name || (c.code === 'CUP' ? 'Peso Cubano' : c.code === 'USD' ? 'Dólar Estadounidense' : 'Euro'),
            symbol: c.symbol || (c.code === 'EUR' ? '€' : '$'),
            rateToBase: Number(c.rate_to_base) || (c.code === 'CUP' ? 1 : c.code === 'USD' ? 320 : 350),
            isBase: c.code === 'CUP' ? true : Boolean(c.is_base)
          }));
      }
    } catch (e: any) {
      errors.push(`Monedas: ${e.message}`);
    }

    // 9. Transactions
    try {
      const data = await fetchAllRows(supabase, 'transactions', 'date'); const error = null;
      if (!error && data && Array.isArray(data)) {
        fetchedData.transactions = data.map((t: any): Transaction => ({
          id: t.id,
          date: t.date,
          total: Number(t.total) || 0,
          tax: Number(t.tax) || 0,
          discount: Number(t.discount) || 0,
          branchId: t.branch_id,
          customerId: t.customer_id,
          userId: t.user_id,
          status: t.status || 'completed',
          notes: t.notes || '',
          paymentMethod: t.payment_method || 'cash',
          sessionId: t.session_id,
          changeGiven: Number(t.change_given) || 0,
          items: Array.isArray(t.items) ? t.items : [],
          payments: Array.isArray(t.payments) ? t.payments : [],
          changePayments: Array.isArray(t.change_payments) ? t.change_payments : [],
          sellerEmployeeIds: Array.isArray(t.seller_employee_ids) ? t.seller_employee_ids : [],
          deletedAt: t.deleted_at || undefined,
          deletedBy: t.deleted_by || undefined,
          deleteReason: t.delete_reason || undefined
        }));
      }
    } catch (e: any) {
      // Non-fatal
    }

    // 10. Cash Sessions
    try {
      const data = await fetchAllRows(supabase, 'cash_sessions', 'opened_at'); const error = null;
      if (!error && data && Array.isArray(data)) {
        fetchedData.cashSessions = data.map((s: any): CashRegisterSession => {
          let notes = s.notes || '';
          let closingBalances = Array.isArray(s.closing_balances) ? s.closing_balances : [];
          let closingDate = s.closing_date || undefined;
          let movements = Array.isArray(s.movements) ? s.movements : [];

          if (notes && notes.includes('__META__:')) {
            const parts = notes.split('__META__:');
            notes = parts[0].trim();
            try {
              const meta = JSON.parse(parts[1]);
              if (meta.closing_balances && meta.closing_balances.length > 0) closingBalances = meta.closing_balances;
              if (meta.closing_date) closingDate = meta.closing_date;
              if (meta.movements && meta.movements.length > 0) movements = meta.movements;
            } catch (e) {
              // ignore
            }
          }

          return {
            id: s.id,
            userId: s.user_id,
            workerName: s.worker_name,
            branchId: s.branch_id,
            openedAt: s.opened_at,
            closedAt: s.closed_at,
            openingBalance: Number(s.opening_balance ?? s.opening_amount) || 0,
            openingAmount: Number(s.opening_amount ?? s.opening_balance) || 0,
            closingBalances,
            status: s.status || 'open',
            notes,
            closingDate,
            workingEmployeeIds: Array.isArray(s.working_employee_ids) ? s.working_employee_ids : [],
            movements,
            deletedAt: s.deleted_at || undefined,
            deletedBy: s.deleted_by || undefined,
            deleteReason: s.delete_reason || undefined
          };
        });
      }
    } catch (e: any) {
      // Non-fatal
    }

    // 11. Inventory Transfers
    try {
      const { data, error } = await supabase.from('inventory_transfers').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.transfers = data.map((t: any): InventoryTransfer => ({
          id: t.id,
          productId: t.product_id,
          productName: t.product_name,
          fromBranchId: t.from_branch_id,
          fromBranchName: t.from_branch_name,
          toBranchId: t.to_branch_id,
          toBranchName: t.to_branch_name,
          variantLabel: t.variant_label,
          quantity: Number(t.quantity) || 0,
          variants: Array.isArray(t.variants) ? t.variants : [],
          date: t.date,
          userId: t.user_id,
          status: t.status || 'completed',
          batchId: t.batch_id || undefined,
          operationId: t.operation_id || t.id
        }));
      }
    } catch (e) { /* ignore */ }

    // 12. Warranties
    try {
      const { data, error } = await supabase.from('warranties').select('*');
      if (!error && data && Array.isArray(data)) {
        fetchedData.warranties = data.map((w: any): Warranty => ({
          id: w.id,
          productId: w.product_id,
          productName: w.product_name,
          transactionId: w.transaction_id,
          customerId: w.customer_id,
          customerName: w.customer_name,
          purchaseDate: w.purchase_date,
          expiryDate: w.expiry_date,
          serialNumber: w.serial_number,
          status: w.status || 'active'
        }));
      }
    } catch (e) { /* ignore */ }

    // 13. Returns
    try {
      const { data, error } = await supabase.from('returns').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.returns = data.map((r: any): ReturnItem => ({
          id: r.id,
          transactionId: r.transaction_id,
          productId: r.product_id,
          quantity: Number(r.quantity) || 1,
          reason: r.reason,
          date: r.date,
          status: r.status || 'pending',
          type: r.type || 'refund',
          notes: r.notes,
          variantLabel: r.variant_label
        }));
      }
    } catch (e) { /* ignore */ }

    // 14. Quotes
    try {
      const { data, error } = await supabase.from('quotes').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.quotes = data.map((q: any): Quote => ({
          id: q.id,
          branchId: q.branch_id,
          userId: q.user_id,
          customerId: q.customer_id,
          date: q.date,
          subtotal: Number(q.subtotal) || 0,
          tax: Number(q.tax) || 0,
          total: Number(q.total) || 0,
          items: Array.isArray(q.items) ? q.items : [],
          status: q.status || 'pending',
          notes: q.notes
        }));
      }
    } catch (e) { /* ignore */ }

    // 15. Time Shifts
    try {
      const { data, error } = await supabase.from('time_shifts').select('*').order('clock_in', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.timeShifts = data.map((s: any): TimeShift => ({
          id: s.id,
          userId: s.user_id,
          clockIn: s.clock_in,
          clockOut: s.clock_out,
          notes: s.notes
        }));
      }
    } catch (e) { /* ignore */ }

    // 16. Salary Settlements
    try {
      const { data, error } = await supabase.from('salary_settlements').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.salarySettlements = data.map((s: any): SalarySettlement => ({
          id: s.id,
          userId: s.user_id,
          userName: s.user_name,
          sessionId: s.session_id,
          baseSalary: Number(s.base_salary) || 0,
          salesGoal: Number(s.sales_goal) || 0,
          commissions: Number(s.commissions) || 0,
          total: Number(s.total) || 0,
          date: s.date,
          status: s.status || 'pending'
        }));
      }
    } catch (e) { /* ignore */ }

    // 17. Suppliers
    try {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (!error && data && Array.isArray(data)) {
        fetchedData.suppliers = data.map((s: any): Supplier => ({
          id: s.id,
          name: s.name,
          phone: s.phone || '',
          address: s.address || '',
          email: s.email || '',
          rating: Number(s.rating) || 5,
          products: Array.isArray(s.products) ? s.products : [],
          typeOfMerchandise: s.type_of_merchandise || s.typeOfMerchandise || ''
        }));
      }
    } catch (e) { /* ignore */ }

    // 18. Supplier Orders
    try {
      const { data, error } = await supabase.from('supplier_orders').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.supplierOrders = data.map((o: any): SupplierOrder => ({
          id: o.id,
          supplierId: o.supplier_id || o.supplierId,
          date: o.date,
          expectedDeliveryDate: o.expected_delivery_date || o.expectedDeliveryDate,
          items: Array.isArray(o.items) ? o.items : [],
          total: Number(o.total) || 0,
          status: o.status || 'pending',
          branchId: o.branch_id || o.branchId,
          transportDetails: o.transport_details || o.transportDetails,
          transportCost: Number(o.transport_cost || o.transportCost) || 0
        }));
      }
    } catch (e) { /* ignore */ }

    // 19. Global Settings (Receipt, Store, Catalog Configs, and State)
    try {
      const { data: setRes, error: setErr } = await supabase.from('settings').select('*').eq('id', 'global').maybeSingle();
      if (!setErr && setRes) {
        if (setRes.receipt_config) fetchedData.receiptConfig = setRes.receipt_config;
        if (setRes.store_config) fetchedData.storeConfig = setRes.store_config;
        if (setRes.catalog_config) fetchedData.catalogConfig = setRes.catalog_config;
        if (setRes.last_turn_number !== undefined) fetchedData.lastTurnNumber = Number(setRes.last_turn_number);
      }
    } catch (e: any) {
      errors.push(`Configuración de Tickets: ${e.message}`);
    }

    const counts = {
      products: fetchedData.products?.length || 0,
      categories: fetchedData.categories?.length || 0,
      inventory: fetchedData.inventory?.length || 0,
      branches: fetchedData.branches?.length || 0,
      users: fetchedData.users?.length || 0,
      bankCards: fetchedData.bankCards?.length || 0,
      customers: fetchedData.customers?.length || 0,
      currencies: fetchedData.currencies?.length || 0,
      transactions: fetchedData.transactions?.length || 0,
      cashSessions: fetchedData.cashSessions?.length || 0,
      idnSettlementPrices: fetchedData.idnSettlementPrices?.length || 0,
      suppliers: fetchedData.suppliers?.length || 0,
      supplierOrders: fetchedData.supplierOrders?.length || 0
    };

    return {
      data: fetchedData,
      result: {
        success: true,
        message: `Sincronización exitosa: ${counts.products} productos, ${counts.inventory} registros de stock y ${counts.categories} categorías descargados de Supabase.`,
        counts,
        errors: errors.length > 0 ? errors : undefined
      }
    };
  } catch (err: any) {
    return {
      data: null,
      result: {
        success: false,
        message: `Error durante la sincronización: ${err?.message || 'Error desconocido'}`
      }
    };
  }
}


/**
 * Realiza un upsert seguro en Supabase. Si una columna no existe en el esquema remoto
 * (error PGRST204), si hay un error de clave foránea (23503), o si un ID no es UUID válido (22P02),
 * lo corrige y reintenta la operación para garantizar persistencia continua sin fallos.
 */
