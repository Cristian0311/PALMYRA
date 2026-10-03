import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Branch, Category, Product, InventoryLevel, CartItem, Transaction, ReturnItem, Currency, Customer, CashRegisterSession, User, PendingOrder, SalarySettlement, InventoryTransfer, Warranty, CashMovement, Supplier, SupplierOrder, InventoryAudit, FiscalConfig, DemandForecast, BankCard, BankTransaction, IDNSettlementPrice } from '../types';
import { generateId, generateReadableId } from '../lib/utils';
import { 
  pullAllFromSupabase, pullPosBootstrapFromSupabase, pullBranchInventoryFromSupabase, pushProductToSupabase, 
  pushTransactionToSupabase, pushCashSessionToSupabase, pushWarrantyToSupabase, pushUserToSupabase, deleteUserFromSupabase, 
  pushIDNSettlementPriceToSupabase, deleteIDNSettlementPriceFromSupabase, SyncResult,
  pushBranchToSupabase, deleteBranchFromSupabase, pushCategoryToSupabase, deleteCategoryFromSupabase, deleteProductFromSupabase,
  pushCurrencyToSupabase, clearSupabaseData, pushBankCardToSupabase, deleteBankCardFromSupabase, pushBankTransactionToSupabase, pushAllToSupabase,
  pushSupplierToSupabase, deleteSupplierFromSupabase, pushSupplierOrderToSupabase, pushCustomerToSupabase,
  applyInventoryAdjustmentToSupabase, reconcileInventoryToSupabase,
  pushReceiptConfigToSupabase, pushStoreConfigToSupabase, pushCatalogConfigToSupabase, deleteTransactionFromSupabase, deleteCustomerFromSupabase,
  deleteBankTransactionFromSupabase, clearSelectedDataFromSupabase, callOpenSessionRPC, callProcessTransactionRPC, callVoidTransactionRPC, callCompleteReturnRPC, callTransferInventoryRPC, callReceiveSupplierOrderRPC, callCompleteInventoryAuditRPC, callCloseSessionRPC, callCancelSessionRPC
} from '../services/supabaseSync';
import { getSupabaseCredentials } from '../lib/supabase';
import { getOfflineQueue, enqueueOfflineItem } from '../services/offlineSync';
import { normalizeSemanticText, areSemanticallyEqual } from '../utils/textUtils';
import { localStateStorage, clearLocalStateStorage } from '../services/localStateStorage';
import type { AppState } from './storeTypes';

import {
  INITIAL_USERS, INITIAL_BRANCHES, INITIAL_CATEGORIES, INITIAL_PRODUCTS,
  INITIAL_INVENTORY, INITIAL_BANK_CARDS, INITIAL_FISCAL_CONFIGS,
  BASE_CURRENCY_CODE, INITIAL_CURRENCIES
} from './storeInitialData';

// --- Definición del Store ---
function applyLocalVoidTransaction(transaction: Transaction) {
  useStore.setState((state: any) => {
    const updatedInventory = [...state.inventory];
    const restore = (productId: string, qty: number, variantLabel?: string) => {
      if (!productId) return;
      const idx = updatedInventory.findIndex((i: any) => i.productId === productId && i.branchId === transaction.branchId && (i.variantLabel || '') === (variantLabel || ''));
      if (idx !== -1) {
        updatedInventory[idx] = { ...updatedInventory[idx], quantity: updatedInventory[idx].quantity + qty };
      }
    };
    
    (transaction.items || []).forEach((item: any) => {
      if (!item) return;
      const prod = item.product;
      if (!prod) return;
      if (typeof prod === 'object' && prod.isKit && Array.isArray(prod.kitComponents)) {
        prod.kitComponents.forEach((c: any) => restore(c.productId, c.quantity * (item.quantity || 1)));
      } else if (typeof prod === 'object') {
        restore(prod.id, item.quantity || 1, item.variantLabel);
      } else if (typeof prod === 'string') {
        restore(prod, item.quantity || 1, item.variantLabel);
      }
    });
    
    return { inventory: updatedInventory };
  });
}

function applyLocalCompletedSale(transaction: Transaction) {
  const generatedWarranties: any[] = [];
  useStore.setState((state: any) => {
    const newWarranties = generatedWarranties;
    const updatedInventory = [...state.inventory];
    const finalItems = (transaction.items || []).map((item: any) => {
      if (!item) return item;
      const finalItem = { ...item };
      const prod = item.product;
      if (prod && typeof prod === 'object' && prod.warrantyDays && prod.warrantyDays > 0) {
        const expiryDate = new Date(transaction.date);
        expiryDate.setDate(expiryDate.getDate() + prod.warrantyDays);
        const customer = state.customers.find((c: any) => c.id === transaction.customerId);
        const wrnId = generateReadableId('GDA', state.warranties.length + newWarranties.length);
        newWarranties.push({
          id: wrnId, productId: prod.id, productName: prod.name,
          transactionId: transaction.id, customerId: transaction.customerId,
          customerName: customer?.name || 'Cliente Genérico', purchaseDate: transaction.date,
          expiryDate: expiryDate.toISOString(), serialNumber: item.serialNumber, status: 'active'
        });
        finalItem.warrantyCode = wrnId;
      }
      return finalItem;
    });

    const consume = (productId: string, qty: number, variantLabel?: string) => {
      if (!productId) return;
      const idx = updatedInventory.findIndex((i: any) => i.productId === productId && i.branchId === transaction.branchId && (i.variantLabel || '') === (variantLabel || ''));
      if (idx !== -1) updatedInventory[idx] = { ...updatedInventory[idx], quantity: Math.max(0, updatedInventory[idx].quantity - qty) };
    };

    (transaction.items || []).forEach((item: any) => {
      if (!item) return;
      const prod = item.product;
      if (!prod) return;
      if (typeof prod === 'object' && prod.isKit && Array.isArray(prod.kitComponents)) {
        prod.kitComponents.forEach((c: any) => consume(c.productId, c.quantity * (item.quantity || 1)));
      } else if (typeof prod === 'object') {
        consume(prod.id, item.quantity || 1, item.variantLabel);
      } else if (typeof prod === 'string') {
        consume(prod, item.quantity || 1, item.variantLabel);
      }
    });

    return {
      transactions: [{ ...transaction, items: finalItems }, ...state.transactions.filter((t: any) => t.id !== transaction.id)],
      inventory: updatedInventory,
      warranties: [...newWarranties, ...state.warranties],
      cart: [], currentCustomerId: undefined
    };
  });
  // Warranty records generated by a POS sale must follow the same offline-first
  // contract as the sale itself. Previously they existed only in local state.
  for (const warranty of generatedWarranties) {
    void pushWarrantyToSupabase(warranty);
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      lastTurnNumber: 0,
      isSyncing: false,
      lastSyncTime: null,
      syncResult: null,
      users: INITIAL_USERS,
      idnSettlementPrices: [],
      currentUser: null,
  login: async (email, pass) => {
    const cleanIdentifier = (email || '').trim().toLowerCase();
    
    // 1. Intentar buscar en los usuarios locales (que vienen de Supabase sincronizados o INITIAL_USERS)
    let user = get().users.find(u => 
      ((u.email || '').trim().toLowerCase() === cleanIdentifier || (u.name || '').trim().toLowerCase() === cleanIdentifier) && 
      u.password === pass
    );
    
    // 2. Fallback de emergencia para cuentas administrativas críticas (siempre funcionan offline)
    if (!user) {
      if ((cleanIdentifier === 'cristianmarco2003@gmail.com' || cleanIdentifier === 'admin') && pass === '03111166702') {
        user = get().users.find(u => u.id === 'admin-1') || {
          id: 'admin-1',
          name: 'Administrador Cristian',
          email: 'cristianmarco2003@gmail.com',
          role: 'admin',
          baseSalary: 0,
          permissions: ['pos_access', 'reports_access', 'inventory_access', 'admin_access', 'cash_audit'],
          isActive: true
        };
      } else if ((cleanIdentifier === 'trabajador@gmail.com' || cleanIdentifier === 'trabajador') && pass === '03111166702') {
        user = get().users.find(u => u.id === 'employee-1') || {
          id: 'employee-1',
          name: 'Trabajador',
          email: 'trabajador@gmail.com',
          role: 'employee',
          baseSalary: 0,
          permissions: ['pos_access'],
          isActive: true
        };
      }
    }

    if (user) {
      set({ currentUser: user });
      
      // Auto-asignación de sucursal
      if (user.isIndependent && user.assignedBranchId) {
        set({ currentBranchId: user.assignedBranchId });
      } else if (user.branchId) {
        set({ currentBranchId: user.branchId });
      } else if (!get().currentBranchId && (get().branches || []).length > 0) {
        set({ currentBranchId: (get().branches || [])[0].id });
      }
      
      return true;
    }
    return false;
  },
  logout: () => set({ currentUser: null, cart: [] }), // LIMPIAR CARRITO AL SALIR
  clearAllData: async () => {
    // 1. Clear Supabase (with timeout/error handling to prevent blocking)
    try {
      // Give supabase 10 seconds max, but don't block the UI forever
      await Promise.race([
        clearSupabaseData('ELIMINAR'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Supabase')), 12000))
      ]).catch(err => console.warn("Supabase clear warning (continuing locally):", err));
    } catch (err) {
      console.warn("Supabase clear failed (continuing locally):", err);
    }

    // Clear local storage/IndexedDB cache.
    await clearLocalStateStorage().catch(() => {});
    try {
      const protectedKeys = new Set(['pos_offline_sync_queue', 'mare_sales_backup_v1', 'mare_supabase_url', 'mare_supabase_anon_key', 'omnisync_device_id']);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && !protectedKeys.has(key)) localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('[clearAllData] Error limpiando caché local:', e);
    }

    // 2. Reset local state to absolute minimal (only first admin)
    const minUsers = [INITIAL_USERS[0]];
    const minBranches: Branch[] = [];
    
    set({
      users: minUsers,
      idnSettlementPrices: [],
      currentUser: null,
      branches: minBranches,
      currentBranchId: '',
      categories: [],
      products: [],
      inventory: [],
      customers: [],
      transactions: [],
      returns: [],
      warranties: [],
      cashSessions: [],
      transfers: [],
      suppliers: [],
      supplierOrders: [],
      inventoryAudits: [],
      salarySettlements: [],
      fiscalConfigs: INITIAL_FISCAL_CONFIGS,
      bankCards: [],
      bankTransactions: [],
      demandForecasts: [],
      quotes: [],
      timeShifts: [],
      pendingOrders: [],
      cart: [],
      currentCustomerId: undefined,
      lastTurnNumber: 0
    });

    // 3. Re-push minimal data to Supabase to avoid lock-out
    await pushUserToSupabase(minUsers[0]);
  },
  resetSelectedData: async (sections) => {
    const selected = new Set(sections);
    const queueSensitive = ['inventory', 'reports', 'cash', 'purchases', 'suppliers', 'customers', 'bank'];
    const pendingQueue = getOfflineQueue();
    if (pendingQueue.length > 0 && sections.some(section => queueSensitive.includes(section))) {
      return { success: false, failed: [`Hay ${pendingQueue.length} operación(es) pendientes en la cola offline. Sincronízalas antes de restablecer datos operativos.`] };
    }
    const remote = await clearSelectedDataFromSupabase(sections);
    if (!remote.success) return remote;
    const patch: any = {};

    if (selected.has('inventory')) { patch.inventory = []; patch.transfers = []; }
    if (selected.has('reports')) {
      patch.transactions = []; patch.returns = []; patch.warranties = []; patch.cashSessions = [];
      patch.salarySettlements = []; patch.inventoryAudits = []; patch.bankTransactions = [];
      patch.timeShifts = []; patch.notifications = [];
    }
    if (selected.has('catalog')) { patch.products = []; patch.categories = []; patch.idnSettlementPrices = []; }
    if (selected.has('customers')) patch.customers = [];
    if (selected.has('suppliers') || selected.has('purchases')) {
      if (selected.has('suppliers')) patch.suppliers = [];
      if (selected.has('purchases')) patch.supplierOrders = [];
    }
    if (selected.has('cash')) { patch.cashSessions = []; patch.salarySettlements = []; }
    if (selected.has('bank')) { patch.bankCards = []; patch.bankTransactions = []; }
    if (selected.has('users')) { patch.users = [INITIAL_USERS[0]]; patch.currentUser = null; }
    if (selected.has('branches')) { patch.branches = []; patch.currentBranchId = ''; }
    if (selected.has('quotes')) { patch.quotes = []; patch.pendingOrders = []; }
    if (selected.has('settings')) {
      patch.currencies = INITIAL_CURRENCIES;
      patch.fiscalConfigs = INITIAL_FISCAL_CONFIGS;
      patch.storeConfig = { storeName: 'Mi Tienda POS', address: 'Calle Principal 123', phone: '+53 51234567', receiptNotes: '¡Gracias por su compra!', darkMode: false, manualOfflineSync: true };
      patch.catalogConfig = { pageSize: 20, showImages: true, compactMode: false };
    }

    patch.cart = []; patch.currentCustomerId = undefined;
    set(patch);

    // Persist the resulting selective state immediately.
    try { await localStateStorage.setItem('pos-store-storage', JSON.stringify({ state: get(), version: 0 })); } catch {}
    return remote;
  },
  clearReportsHistory: async () => {
    // 1. Clear Supabase History only (surgical)
    try {
      const { clearHistoryFromSupabase } = await import('../services/supabaseSync');
      await clearHistoryFromSupabase();
    } catch (err) {
      console.warn("Supabase history clear failed (continuing locally):", err);
    }

    // 2. Clear ONLY reporting/history states (KEEP products, categories, branches, users)
    set({ 
      transactions: [],
      returns: [],
      warranties: [],
      cashSessions: [],
      bankTransactions: [],
      inventoryAudits: [],
      salarySettlements: [],
      pendingOrders: [],
      cart: [],
      notifications: []
    });
  },
  exportData: () => {
    const state = get();
    const backupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: {
        categories: state.categories,
        products: state.products,
        inventory: state.inventory,
        branches: state.branches,
        currencies: state.currencies,
        customers: state.customers,
        users: state.users,
        transactions: state.transactions,
        returns: state.returns,
        warranties: state.warranties,
        cashSessions: state.cashSessions,
        transfers: state.transfers,
        suppliers: state.suppliers,
        supplierOrders: state.supplierOrders,
        inventoryAudits: state.inventoryAudits,
        salarySettlements: state.salarySettlements,
        fiscalConfigs: state.fiscalConfigs,
        bankCards: state.bankCards,
        bankTransactions: state.bankTransactions,
        demandForecasts: state.demandForecasts,
        quotes: state.quotes,
        timeShifts: state.timeShifts,
        pendingOrders: state.pendingOrders,
        idnSettlementPrices: state.idnSettlementPrices,
        receiptConfig: state.receiptConfig,
        catalogConfig: state.catalogConfig,
        storeConfig: state.storeConfig
      }
    };
    return JSON.stringify(backupData, null, 2);
  },
  importData: async (jsonData: string) => {
    try {
      const backup = JSON.parse(jsonData);
      if (!backup.data || !backup.version) {
        throw new Error("Formato de backup inválido");
      }

      const d = backup.data;
      
      // Update local state
      set({
        categories: d.categories || [],
        products: d.products || [],
        inventory: d.inventory || [],
        branches: d.branches || [],
        currencies: d.currencies || [],
        customers: d.customers || [],
        users: d.users || [],
        transactions: d.transactions || [],
        returns: d.returns || [],
        warranties: d.warranties || [],
        cashSessions: d.cashSessions || [],
        transfers: d.transfers || [],
        suppliers: d.suppliers || [],
        supplierOrders: d.supplierOrders || [],
        inventoryAudits: d.inventoryAudits || [],
        salarySettlements: d.salarySettlements || [],
        fiscalConfigs: d.fiscalConfigs || [],
        bankCards: d.bankCards || [],
        bankTransactions: d.bankTransactions || [],
        demandForecasts: d.demandForecasts || [],
        quotes: d.quotes || [],
        timeShifts: d.timeShifts || [],
        pendingOrders: d.pendingOrders || [],
        idnSettlementPrices: d.idnSettlementPrices || [],
        receiptConfig: d.receiptConfig || get().receiptConfig,
        catalogConfig: d.catalogConfig || get().catalogConfig,
        storeConfig: d.storeConfig || get().storeConfig
      });

      // After local update, sync everything to Supabase
      const { pushAllToSupabase } = await import('../services/supabaseSync');
      await pushAllToSupabase(true);

      return { success: true };
    } catch (err: any) {
      console.error("Error importing data:", err);
      return { success: false, error: err.message };
    }
  },
  addUser: (user) => {
    const exists = get().users.find(u => 
      (u.email && u.email.toLowerCase() === user.email?.toLowerCase()) || 
      ((u.name || '').toLowerCase() === (user.name || '').toLowerCase())
    );
    if (exists) {
      return get().updateUser(exists.id, user);
    }
    set((state) => ({ users: [...state.users, user] }));
    pushUserToSupabase(user);
  },
  registerEmployee: (name, password) => {
    const newUser: import('../types').User = {
      id: crypto.randomUUID(),
      name,
      email: `${String(name || 'user').toLowerCase().replace(/\s/g, '')}_${Math.floor(1000 + Math.random() * 9000)}@system.local`,
      password,
      role: 'employee',
      permissions: ['pos_access'],
      isActive: true,
      baseSalary: 0
    };
    set((state) => ({ users: [...state.users, newUser] }));
    pushUserToSupabase(newUser);
    return newUser;
  },
  updateUser: (id, user) => {
    set((state) => ({
      users: state.users.map(u => u.id === id ? { ...u, ...user } : u)
    }));
    const updatedUser = get().users.find(u => u.id === id);
    if (updatedUser) pushUserToSupabase(updatedUser);
  },
  deleteUser: (id) => {
    set((state) => ({
      users: state.users.map(u => u.id === id ? { ...u, isActive: false } : u)
    }));
    const updated = get().users.find(u => u.id === id);
    if (updated) pushUserToSupabase(updated);
  },

  addIDNSettlementPrice: (price) => {
    set((state) => ({
      idnSettlementPrices: [...state.idnSettlementPrices, price]
    }));
    pushIDNSettlementPriceToSupabase(price);
  },
  updateIDNSettlementPrice: (id, price) => {
    set((state) => ({
      idnSettlementPrices: state.idnSettlementPrices.map(p => p.id === id ? { ...p, ...price } : p)
    }));
    const updated = get().idnSettlementPrices.find(p => p.id === id);
    if (updated) pushIDNSettlementPriceToSupabase(updated);
  },
  deleteIDNSettlementPrice: (id) => {
    set((state) => ({
      idnSettlementPrices: state.idnSettlementPrices.filter(p => p.id !== id)
    }));
    deleteIDNSettlementPriceFromSupabase(id);
  },

  currencies: INITIAL_CURRENCIES,
  
  updateCurrencyRate: (code, newRate) => {
    set((state) => ({
      currencies: (state.currencies || INITIAL_CURRENCIES)
        .filter(c => ['CUP', 'USD', 'EUR'].includes(c.code))
        .map(c => c.code === code ? { ...c, rateToBase: newRate } : c)
    }));
    const updated = get().currencies.find(c => c.code === code);
    if (updated) {
      pushCurrencyToSupabase(updated);
    }
  },

  getBaseCurrency: () => {
    const list = (get().currencies || INITIAL_CURRENCIES).filter(c => ['CUP', 'USD', 'EUR'].includes(c.code));
    return list.find(c => c.isBase) || list.find(c => c.code === 'CUP') || INITIAL_CURRENCIES[0];
  },
  
  storeConfig: { storeName: 'Mi Tienda POS', address: 'Calle Principal 123', phone: '+53 51234567', receiptNotes: '¡Gracias por su compra!', darkMode: false, manualOfflineSync: true },
  
  updateStoreConfig: (config) => {
    set({ storeConfig: config });
    pushStoreConfigToSupabase(config).catch(() => {});
  },


  catalogConfig: { 
    themeColor: '#4f46e5', 
    bannerText: '¡Bienvenidos a nuestra tienda virtual!', 
    whatsappNumber: '+5351234567', 
    showPrices: true,
    visibleBranches: ['b1']
  },
  
  updateCatalogConfig: (config) => {
    set({ catalogConfig: config });
    pushCatalogConfigToSupabase(config).catch(() => {});
  },


  branches: INITIAL_BRANCHES,
  currentBranchId: '',
  setCurrentBranch: (id) => set({ currentBranchId: id, cart: [] }),
  addBranch: (branch) => {
    let shouldPush = false;
    set((state) => {
      // Deduplicación estricta insensible a mayúsculas, acentos y espaciado
      const normName = normalizeSemanticText(branch.name);
      const isDuplicate = state.branches.some(b => 
        b.id === branch.id || 
        normalizeSemanticText(b.name) === normName
      );
      if (isDuplicate) {
        console.warn(`[MARÉ] Intento de agregar sucursal duplicada bloqueado: "${branch.name}"`);
        return state;
      }
      
      shouldPush = true;
      return { 
        branches: [...state.branches, branch],
        currentBranchId: state.currentBranchId || branch.id
      };
    });
    if (shouldPush) {
      pushBranchToSupabase(branch);
    }
  },
  updateBranch: (id, branch) => {
    let shouldPush = false;
    set((state) => {
      if (branch.name) {
        const normName = normalizeSemanticText(branch.name);
        const nameCollision = state.branches.some(b => b.id !== id && normalizeSemanticText(b.name) === normName);
        if (nameCollision) {
          console.warn(`[MARÉ] No se puede renombrar: ya existe otra sucursal con el nombre "${branch.name}"`);
          return state;
        }
      }
      shouldPush = true;
      return {
        branches: state.branches.map(b => b.id === id ? { ...b, ...branch } : b)
      };
    });
    if (shouldPush) {
      const updated = get().branches.find(b => b.id === id);
      if (updated) pushBranchToSupabase(updated);
    }
  },
  deleteBranch: (id) => {
    // Validar integridad referencial antes de permitir eliminación
    const hasInventory = (get().inventory || []).some(l => l.branchId === id && l.quantity > 0);
    const hasTx = (get().transactions || []).some(t => t.branchId === id && !t.deletedAt);
    const hasSessions = (get().cashSessions || []).some(s => s.branchId === id && !s.deletedAt);
    if (hasInventory || hasTx || hasSessions) {
      console.warn(`[MARÉ] Bloqueada eliminación de sucursal ${id} porque tiene relaciones activas (inventario, ventas o turnos).`);
      return;
    }

    set((state) => {
      const newBranches = state.branches.filter(b => b.id !== id);
      return {
        branches: newBranches,
        currentBranchId: state.currentBranchId === id ? (newBranches[0]?.id || '') : state.currentBranchId
      };
    });
    deleteBranchFromSupabase(id);
  },
  
  categories: INITIAL_CATEGORIES,
  addCategory: (category) => {
    let shouldPush = false;
    set((state) => {
      // Deduplicación estricta por ID o Nombre normalizado
      const normName = normalizeSemanticText(category.name);
      const isDuplicate = state.categories.some(c => 
        c.id === category.id || 
        normalizeSemanticText(c.name) === normName
      );
      if (isDuplicate) return state;
      shouldPush = true;
      return { categories: [...state.categories, category] };
    });
    if (shouldPush) {
      pushCategoryToSupabase(category);
    }
  },
  updateCategory: (id, category) => {
    set((state) => ({
      categories: state.categories.map(c => c.id === id ? { ...c, ...category } : c)
    }));
    const updated = get().categories.find(c => c.id === id);
    if (updated) pushCategoryToSupabase(updated);
  },
  deleteCategory: (id) => {
    set((state) => ({ categories: state.categories.filter(c => c.id !== id) }));
    deleteCategoryFromSupabase(id);
  },
  
  products: INITIAL_PRODUCTS,
  inventory: INITIAL_INVENTORY,
  addProduct: (product, initialQuantity, branchId, variantLabel, initialVariantQuantities) => {
    const targetBranch = branchId || get().currentBranchId;
    let newInventoryEntries: InventoryLevel[] = [];
    
    if (initialVariantQuantities && Object.keys(initialVariantQuantities).length > 0) {
      Object.entries(initialVariantQuantities).forEach(([vLabel, qty]) => {
        if (Number(qty) > 0) {
          newInventoryEntries.push({ id: crypto.randomUUID(), productId: product.id, branchId: targetBranch, quantity: Number(qty), minQuantity: 5, variantLabel: vLabel });
        }
      });
    } else if (initialQuantity && initialQuantity > 0) {
      newInventoryEntries.push({ id: crypto.randomUUID(), productId: product.id, branchId: targetBranch, quantity: initialQuantity, minQuantity: 5, variantLabel });
    }

    let added = false;
    set((state) => {
      // Deduplicación por ID, SKU o Nombre (ignoring case)
      const isDuplicate = state.products.some(p => 
        p.id === product.id || 
        (p.sku && product.sku && p.sku.toLowerCase().trim() === product.sku.toLowerCase().trim()) ||
        (p.name.toLowerCase().trim() === product.name.toLowerCase().trim())
      );
      if (isDuplicate) return state;
      added = true;
      return {
        products: [product, ...state.products],
        inventory: [...state.inventory, ...newInventoryEntries]
      };
    });

    if (!added) return;

    // Producto y stock inicial se sincronizan como operaciones independientes.
    pushProductToSupabase(product).catch(() => {});
    for (const inv of newInventoryEntries) {
      const op = { operationId: `invrec:${crypto.randomUUID()}`, productId: inv.productId, branchId: inv.branchId, variantLabel: inv.variantLabel || '', expectedQuantity: 0, newQuantity: inv.quantity, quantity: inv.quantity, minQuantity: inv.minQuantity, userId: get().currentUser?.id || undefined };
      if (typeof navigator !== 'undefined' && !navigator.onLine) enqueueOfflineItem('inventory_reconcile', op, op.operationId);
      else reconcileInventoryToSupabase(op).then(res => { if (!res.success || res.conflict) enqueueOfflineItem('inventory_reconcile', op, op.operationId); }).catch(() => enqueueOfflineItem('inventory_reconcile', op, op.operationId));
    }
  },
  updateProduct: (id, product) => {
    set((state) => ({
      products: state.products.map(p => p.id === id ? { ...p, ...product } : p)
    }));
    const updated = get().products.find(p => p.id === id);
    if (updated) pushProductToSupabase(updated);
  },
  deleteProduct: (id) => {
    set((state) => ({
      products: state.products.map(p => p.id === id ? { ...p, status: 'discontinued' } : p)
    }));
    const updated = get().products.find(p => p.id === id);
    if (updated) pushProductToSupabase(updated);
  },
  transferInventory: async (productId, fromBranchId, toBranchId, quantity, variantLabel, transactionId) => {
    const res = await get().transferInventoryBatch(
      productId,
      fromBranchId,
      toBranchId,
      [{ variantLabel: variantLabel || '', quantity }],
      transactionId
    );
    return res.success;
  },

  transferInventoryBatch: async (productId, fromBranchId, toBranchId, variants, transactionId, batchId) => {
    if (!productId || !fromBranchId || !toBranchId) return { success: false, error: 'Información incompleta para realizar la transferencia.' };
    if (fromBranchId === toBranchId) return { success: false, error: 'La sucursal de origen y destino no pueden ser la misma.' };
    const activeVariants = variants.filter(v => v.quantity > 0).map(v => ({ variantLabel: v.variantLabel || '', quantity: v.quantity }));
    if (activeVariants.length === 0) return { success: false, error: 'Debes indicar una cantidad mayor a 0 para transferir.' };

    const operationId = batchId || transactionId || crypto.randomUUID();
    const userId = (get().currentUser?.id && get().users.some(u => u.id === get().currentUser?.id)) ? get().currentUser!.id : 'system';
    const serverPayload = { operationId, productId, fromBranchId, toBranchId, variants: activeVariants, userId };

    // Online: DB performs one atomic move and owns the inventory mutation.
    if (navigator.onLine) {
      const res = await callTransferInventoryRPC(serverPayload);
      if (!res.success) {
        if (!res.errorCode) enqueueOfflineItem('transfer', serverPayload, `transfer:${operationId}`);
        return { success: !res.errorCode, error: res.error };
      }
    } else {
      enqueueOfflineItem('transfer', serverPayload, `transfer:${operationId}`);
    }

    // Mirror the confirmed/offline operation locally exactly once.
    const newInventory = [...get().inventory];
    let totalQuantity = 0;
    for (const v of activeVariants) {
      totalQuantity += v.quantity;
      const sourceIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === fromBranchId && (i.variantLabel || '') === v.variantLabel);
      if (sourceIdx !== -1) newInventory[sourceIdx] = { ...newInventory[sourceIdx], quantity: Math.max(0, newInventory[sourceIdx].quantity - v.quantity) };
      const targetIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === toBranchId && (i.variantLabel || '') === v.variantLabel);
      if (targetIdx !== -1) newInventory[targetIdx] = { ...newInventory[targetIdx], quantity: newInventory[targetIdx].quantity + v.quantity };
      else newInventory.push({ id: crypto.randomUUID(), productId, branchId: toBranchId, variantLabel: v.variantLabel || undefined, quantity: v.quantity, minQuantity: 5 });
    }
    set({ inventory: newInventory });

    const product = get().products.find(p => p.id === productId);
    const fromBranch = get().branches.find(b => b.id === fromBranchId);
    const toBranch = get().branches.find(b => b.id === toBranchId);
    const transferRecord: import('../types').InventoryTransfer = {
      id: operationId, operationId, productId, productName: product?.name || 'Producto',
      fromBranchId, fromBranchName: fromBranch?.name || 'Sucursal Origen',
      toBranchId, toBranchName: toBranch?.name || 'Sucursal Destino',
      quantity: totalQuantity, variants: activeVariants, date: new Date().toISOString(),
      userId, status: 'completed', variantLabel: activeVariants.length === 1 ? (activeVariants[0].variantLabel || 'Producto Base') : activeVariants.map(v => `${v.variantLabel || 'Base'}: ${v.quantity}`).join(', '),
      transactionId, batchId
    };
    get().addTransfer(transferRecord);
    return { success: true };
  },

  reconcileProductStock: async (productId, corrections) => {
    const currentInventory = get().inventory;
    const newInventory = [...currentInventory];
    const operations: any[] = [];

    for (const item of corrections) {
      const vLabel = item.variantLabel || '';
      const existing = currentInventory.find(i => i.productId === productId && i.branchId === item.branchId && (i.variantLabel || '') === vLabel);
      const expectedQuantity = Number(existing?.quantity || 0);
      const nextQuantity = Math.max(0, item.quantity);
      const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === item.branchId && (i.variantLabel || '') === vLabel);
      const next = idx !== -1
        ? { ...newInventory[idx], quantity: nextQuantity, minQuantity: item.minQuantity ?? newInventory[idx].minQuantity ?? 5 }
        : { id: crypto.randomUUID(), productId, branchId: item.branchId, variantLabel: vLabel || undefined, quantity: nextQuantity, minQuantity: item.minQuantity ?? 5 };
      if (idx !== -1) newInventory[idx] = next as InventoryLevel; else newInventory.push(next as InventoryLevel);
      operations.push({ operationId: `invrec:${crypto.randomUUID()}`, productId, branchId: item.branchId, variantLabel: vLabel, expectedQuantity, newQuantity: nextQuantity, quantity: nextQuantity, minQuantity: next.minQuantity, userId: get().currentUser?.id || undefined });
    }

    set({ inventory: newInventory });
    for (const op of operations) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineItem('inventory_reconcile', op, op.operationId);
        continue;
      }
      const res = await reconcileInventoryToSupabase(op);
      if (!res.success || res.conflict) enqueueOfflineItem('inventory_reconcile', op, op.operationId);
    }
    return { success: true };
  },

  repairOrphanedInventoryLevels: async () => {
    const defaultBranchId = get().branches[0]?.id;
    if (!defaultBranchId) return { repaired: 0, message: 'No hay sucursales configuradas.' };

    let repairedCount = 0;
    set((state) => ({
      inventory: state.inventory.map(i => {
        if (!i.branchId) {
          repairedCount++;
          return { ...i, branchId: defaultBranchId };
        }
        return i;
      })
    }));

    return { repaired: repairedCount, message: `Se repararon ${repairedCount} registros huérfanos.` };
  },
  batchDeleteProducts: (ids) => {
    set((state) => ({
      products: state.products.map(p => ids.includes(p.id) ? { ...p, status: 'discontinued' } : p)
    }));
    ids.forEach(id => {
      const updated = get().products.find(p => p.id === id);
      if (updated) pushProductToSupabase(updated);
    });
  },
  batchUpdateProducts: (ids, updates) => {
    set((state) => ({
      products: state.products.map(p => ids.includes(p.id) ? { ...p, ...updates } : p)
    }));
  },
  adjustInventory: (productId, branchId, delta, variantLabel, minQuantity) => {
    const current = get().inventory.find(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
    const currentQty = Number(current?.quantity || 0);
    const nextQty = Math.max(0, currentQty + delta);
    const operationId = `invadj:${crypto.randomUUID()}`;
    const payload = {
      operationId, productId, branchId, variantLabel: variantLabel || '', delta,
      minQuantity: minQuantity ?? current?.minQuantity ?? 5,
      userId: get().currentUser?.id || undefined, movementType: delta >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'
    };
    set((state) => {
      const newInventory = [...state.inventory];
      const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
      if (idx !== -1) newInventory[idx] = { ...newInventory[idx], quantity: nextQty, minQuantity: payload.minQuantity };
      else if (nextQty > 0) newInventory.push({ id: crypto.randomUUID(), productId, branchId, quantity: nextQty, minQuantity: payload.minQuantity, variantLabel });
      return { inventory: newInventory };
    });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineItem('inventory_adjustment', payload, operationId);
      return;
    }
    applyInventoryAdjustmentToSupabase(payload).then(res => {
      if (!res.success || res.conflict) enqueueOfflineItem('inventory_adjustment', payload, operationId);
    }).catch(() => enqueueOfflineItem('inventory_adjustment', payload, operationId));
  },
  setInventoryQuantity: (productId, branchId, quantity, variantLabel, minQuantity) => {
    const current = get().inventory.find(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
    const expectedQuantity = Number(current?.quantity || 0);
    const newQuantity = Math.max(0, quantity);
    const operationId = `invrec:${crypto.randomUUID()}`;
    const payload = {
      operationId, productId, branchId, variantLabel: variantLabel || '', expectedQuantity,
      quantity: newQuantity, minQuantity: minQuantity ?? current?.minQuantity ?? 5,
      userId: get().currentUser?.id || undefined
    };
    set((state) => {
      const newInventory = [...state.inventory];
      const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
      if (idx !== -1) newInventory[idx] = { ...newInventory[idx], quantity: newQuantity, minQuantity: payload.minQuantity };
      else newInventory.push({ id: crypto.randomUUID(), productId, branchId, quantity: newQuantity, minQuantity: payload.minQuantity, variantLabel });
      return { inventory: newInventory };
    });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineItem('inventory_reconcile', payload, operationId);
      return;
    }
    reconcileInventoryToSupabase({ ...payload, newQuantity }).then(res => {
      if (!res.success || res.conflict) enqueueOfflineItem('inventory_reconcile', payload, operationId);
    }).catch(() => enqueueOfflineItem('inventory_reconcile', payload, operationId));
  },

  transferProductsBulk: async (fromBranchId, toBranchId, items) => {
    if (items.length === 0) return { success: true };
    const batchId = crypto.randomUUID();
    let successCount = 0;
    let lastError = "";

    for (const item of items) {
      const res = await get().transferInventoryBatch(
        item.productId,
        fromBranchId,
        toBranchId,
        [{ variantLabel: item.variant || '', quantity: item.quantity }],
        undefined,
        batchId
      );
      if (res.success) {
        successCount++;
      } else {
        lastError = res.error || "Error desconocido";
      }
    }

    if (successCount === items.length) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: `Se transfirieron ${successCount} de ${items.length} productos. ${lastError}` 
      };
    }
  },
  
  cart: [],
  currentCustomerId: undefined,
  setCartCustomer: (customerId) => set({ currentCustomerId: customerId }),
  addToCart: (product, serialNumber, attributes) => set((state) => {
    // Auto-generate serial if enabled and not provided
    let finalSerial = serialNumber;
    let updatedProducts = state.products;

    if (product.hasSerial && !finalSerial) {
      const currentProduct = state.products.find(p => p.id === product.id);
      const nextNum = currentProduct?.nextSerial || 1;
      finalSerial = `SN-${product.sku || product.id.slice(-4)}-${nextNum.toString().padStart(4, '0')}`;
      
      // Increment nextSerial in the products list
      updatedProducts = state.products.map(p => 
        p.id === product.id ? { ...p, nextSerial: nextNum + 1 } : p
      );
    }

    // Para productos con número de serie, siempre agregamos una fila nueva (qty=1)
    if (product.hasSerial || finalSerial) {
      const prod = updatedProducts.find(p => p.id === product.id) || product;
      return {
        products: updatedProducts,
        cart: [...state.cart, { 
          id: crypto.randomUUID(), 
          product: prod, 
          quantity: 1, 
          price: prod.price,
          total: prod.price,
          serialNumber: finalSerial,
          selectedSize: attributes?.size,
          selectedColor: attributes?.color,
          variantLabel: attributes?.variantLabel || attributes?.size || attributes?.color
        }]
      };
    }

    // Para productos normales, aumentamos cantidad si ya existe (considerando atributos)
    const existing = state.cart.find(item => 
      item.product.id === product.id && 
      !item.serialNumber &&
      item.selectedSize === attributes?.size &&
      item.selectedColor === attributes?.color &&
      (item.variantLabel || '') === ((attributes?.variantLabel || attributes?.size || attributes?.color) || '')
    );
    
    if (existing) {
      return {
        cart: state.cart.map(item => 
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } 
            : item
        )
      };
    }
    
    return {
      cart: [...state.cart, { 
        id: crypto.randomUUID(), 
        product, 
        quantity: 1,
        price: product.price,
        total: product.price,
        selectedSize: attributes?.size,
        selectedColor: attributes?.color,
        variantLabel: attributes?.variantLabel || attributes?.size || attributes?.color
      }]
    };
  }),
  
  updateCartQty: (cartItemId, delta) => set((state) => ({
    cart: state.cart.map(item => {
      if (item.id === cartItemId) {
        // Productos con serie no deben cambiar cantidad > 1 (o se divide, pero simplificamos así)
        if (item.product.hasSerial && delta > 0) return item; 
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }).filter(item => item.quantity > 0)
  })),

  updateCartSerial: (cartItemId, serialNumber) => set((state) => ({
    cart: state.cart.map(item => 
      item.id === cartItemId ? { ...item, serialNumber } : item
    )
  })),
  
  clearCart: () => set({ cart: [], currentCustomerId: undefined }),

  transactions: [],
  returns: [],
  quotes: [],
  addQuote: (quote) => {
    set((state) => ({ quotes: [...state.quotes, quote] }));
    import('../services/supabaseSync').then(({ pushQuoteToSupabase }) => {
      pushQuoteToSupabase(quote).catch(() => {});
    }).catch(() => {});
  },
  updateQuote: (id, updates) => {
    set((state) => ({ quotes: state.quotes.map(q => q.id === id ? { ...q, ...updates } : q) }));
    const updated = get().quotes.find(q => q.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushQuoteToSupabase }) => {
        pushQuoteToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },

  timeShifts: [],
  addTimeShift: (shift) => {
    set((state) => ({ timeShifts: [shift, ...state.timeShifts] }));
    import('../services/supabaseSync').then(({ pushTimeShiftToSupabase }) => {
      pushTimeShiftToSupabase(shift).catch(() => {});
    }).catch(() => {});
  },
  updateTimeShift: (id, updates) => {
    set((state) => ({ timeShifts: state.timeShifts.map(s => s.id === id ? { ...s, ...updates } : s) }));
    const updated = get().timeShifts.find(s => s.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushTimeShiftToSupabase }) => {
        pushTimeShiftToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },
  processTransaction: async (transaction) => {
    // IDN settlement is an accounting/reporting record, not a second physical sale.
    // The units were already consumed by the actual POS sales. Never send this
    // record through the stock-mutating POS RPC.
    if (transaction.notes === 'LIQUIDACION_IDN') {
      set((state) => ({
        transactions: [{ ...transaction }, ...state.transactions.filter(t => t.id !== transaction.id)],
        cart: [],
        currentCustomerId: undefined
      }));
      void pushTransactionToSupabase(transaction);
      return true;
    }

    // Online: Supabase is the single authority for stock mutation. Only after the
    // atomic RPC commits do we mirror the result locally. This prevents the old
    // double-decrement (local optimistic update + RPC update).
    if (navigator.onLine) {
      try {
        const res = await callProcessTransactionRPC(transaction);
        if (!res.success) {
          // PostgreSQL business errors (stock, closed shift, invalid data) are not
          // retryable. Only transport/configuration failures enter the offline queue.
          if (res.errorCode) {
            console.error('[processTransaction] Operación rechazada por servidor:', res.error);
            return false;
          }
          throw new Error(res.error || 'No se pudo procesar la venta');
        }
        applyLocalCompletedSale(transaction);
        return true;
      } catch (err) {
        console.warn('[processTransaction] Venta no confirmada online; se encola para reintento idempotente:', err);
        // Do not apply stock locally a second time here. Queue the exact operation.
        enqueueOfflineItem('transaction', transaction, transaction.id);
        return true;
      }
    }

    // Offline: apply once to the local model and persist the exact operation for
    // later RPC execution. The transaction id is the idempotency key.
    applyLocalCompletedSale(transaction);
    enqueueOfflineItem('transaction', transaction, transaction.id);
    return true;
  },

  deleteTransaction: async (id: string, reason?: string) => {
    const state = get();
    const tx = (state.transactions || []).find(t => t.id === id);
    if (!tx || tx.deletedAt) return;
    const userId = state.currentUser?.id || 'system';

    // Restore stock locally
    applyLocalVoidTransaction(tx);
    
    set((current) => {
      const deletedAt = new Date().toISOString();
      return {
        transactions: current.transactions.map(t => t.id === id ? {
          ...t, deletedAt, deletedBy: userId, deleteReason: reason || 'Anulación de venta'
        } : t)
      };
    });

    // Online: server reverses the exact original stock consumption atomically.
    if (navigator.onLine) {
      try {
        const res = await callVoidTransactionRPC(id, userId, reason || 'Anulación de venta');
        if (!res.success) throw new Error(res.error || 'No se pudo anular la venta');
      } catch (err) {
        console.warn('[deleteTransaction] No se pudo confirmar la anulación; se encola:', err);
        enqueueOfflineItem('void_transaction', { id, userId, reason }, `void:${id}`);
        return;
      }
    } else {
      enqueueOfflineItem('void_transaction', { id, userId, reason }, `void:${id}`);
    }
  },

  updateTransaction: (id: string, updates: Partial<Transaction>) => {
    const existing = get().transactions.find(t => t.id === id);
    if (!existing) return;
    // Completed sales are immutable. A post-sale correction must go through
    // the void/return workflow so inventory, cash and audit history stay aligned.
    if (existing.status === 'completed' || existing.status === 'refunded' || existing.deletedAt) {
      get().addNotification('La venta completada no se puede editar. Usa devolución/anulación para corregirla.', 'warning');
      return;
    }
    const updated = { ...existing, ...updates };
    set((state) => ({ transactions: (state.transactions || []).map(t => t.id === id ? updated : t) }));
    pushTransactionToSupabase(updated).catch(() => {});
  },

  cancelSession: async (sessionId: string, reason = 'Cancelación de turno') => {
    const state = get();
    const session = state.cashSessions.find(s => s.id === sessionId);
    if (!session) return false;
    if (session.status !== 'open') {
      state.addNotification('El turno ya no está abierto.', 'warning');
      return false;
    }

    const userId = state.currentUser?.id || 'system';
    const cancelledAt = new Date().toISOString();

    // Restore stock of all transactions in the session locally
    const sessionTxs = (state.transactions || []).filter(t => t.sessionId === sessionId && !t.deletedAt);
    sessionTxs.forEach(tx => applyLocalVoidTransaction(tx));

    set(current => {
      return {
        cashSessions: (current.cashSessions || []).map(s => s.id === sessionId ? {
          ...s,
          status: 'cancelled',
          closedAt: cancelledAt,
          closingDate: cancelledAt,
          deletedAt: undefined,
          deletedBy: undefined,
          deleteReason: reason
        } : s),
        transactions: (current.transactions || []).map(t =>
          t.sessionId === sessionId && !t.deletedAt
            ? { ...t, deletedAt: cancelledAt, deletedBy: userId, deleteReason: reason, status: 'refunded' as const }
            : t
        ),
        cart: []
      };
    });

    if (navigator.onLine) {
      try {
        const res = await callCancelSessionRPC(sessionId, userId, reason);
        if (!res.success) throw new Error(res.error || 'No se pudo cancelar el turno');
        return true;
      } catch (err) {
        console.warn('[cancelSession] No se pudo confirmar en Supabase; se encola:', err);
      }
    }

    enqueueOfflineItem('cash_session', { 
      id: sessionId, 
      branchId: session.branchId,
      userId,
      status: 'cancelled',
      closedAt: cancelledAt,
      closingDate: cancelledAt,
      deleteReason: reason,
      __operation: 'cancel' 
    }, `cash-cancel:${sessionId}`);
    return true;
  },



  createReturn: (returnItem) => {
    const newReturn = { ...returnItem, id: returnItem.id || generateReadableId('DEV', get().returns.length) };
    set((state) => ({
      returns: [newReturn, ...state.returns.filter(r => r.id !== newReturn.id)]
    }));
    import('../services/supabaseSync').then(({ pushReturnToSupabase }) => {
      pushReturnToSupabase(newReturn).catch(() => {});
    }).catch(() => {});
  },
  updateReturn: (id, returnItem) => {
    set((state) => ({
      returns: state.returns.map(r => r.id === id ? { ...r, ...returnItem } : r)
    }));
    const updated = get().returns.find(r => r.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushReturnToSupabase }) => {
        pushReturnToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },
  processReturn: async (id, action) => {
    const state = get();
    const returnReq = state.returns.find(r => r.id === id);
    if (!returnReq || returnReq.status !== 'pending') return false;
    const userId = state.currentUser?.id || 'system';

    if (action === 'complete') {
      if (navigator.onLine) {
        try {
          const res = await callCompleteReturnRPC(id, userId);
          if (!res.success) throw new Error(res.error || 'No se pudo completar la devolución');
        } catch (err) {
          console.warn('[processReturn] Devolución no confirmada; se encola:', err);
          enqueueOfflineItem('return_complete', { id, userId }, `return:${id}`);
          return true;
        }
      } else {
        enqueueOfflineItem('return_complete', { id, userId }, `return:${id}`);
      }
    }

    set((current) => {
      const req = current.returns.find(r => r.id === id);
      if (!req || req.status !== 'pending') return current;
      let updatedInventory = [...current.inventory];
      let updatedWarranties = [...current.warranties];
      const originalTx = current.transactions.find(t => t.id === req.transactionId);
      const branchId = req.branchId || originalTx?.branchId || current.currentBranchId;

      const adjustLocal = (productId: string, delta: number, variantLabel?: string) => {
        const idx = updatedInventory.findIndex(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
        if (idx !== -1) updatedInventory[idx] = { ...updatedInventory[idx], quantity: Math.max(0, updatedInventory[idx].quantity + delta) };
      };

      if (action === 'complete') {
        if (req.type === 'refund') adjustLocal(req.productId, req.quantity, req.variantLabel);
        if (req.type === 'warranty_exchange' && req.replacementProductId) {
          adjustLocal(req.replacementProductId, -(req.replacementQuantity || req.quantity));
        }
        const warrantyIdx = updatedWarranties.findIndex(w => w.transactionId === req.transactionId && w.productId === req.productId);
        if (warrantyIdx !== -1) updatedWarranties[warrantyIdx] = { ...updatedWarranties[warrantyIdx], status: req.type === 'warranty_exchange' ? 'exchanged' : 'refunded' };
      }
      return {
        returns: current.returns.map(r => r.id === id ? { ...r, status: action === 'complete' ? 'completed' : 'rejected', processedBy: userId } : r),
        inventory: updatedInventory,
        warranties: updatedWarranties
      };
    });
    return true;
  },

  customers: [],
  addCustomer: (customer) => {
    set((state) => {
      // Deduplicación por ID, Teléfono o Correo
      const isDuplicate = (state.customers || []).some(c => 
        c.id === customer.id || 
        (c.phone && customer.phone && c.phone === customer.phone) ||
        (c.email && customer.email && c.email.toLowerCase().trim() === customer.email.toLowerCase().trim())
      );
      if (isDuplicate) return state;
      return { customers: [...(state.customers || []), customer] };
    });
    pushCustomerToSupabase(customer).catch(() => {});
  },
  updateCustomer: (id, customer) => {
    set((state) => ({
      customers: state.customers.map(c => c.id === id ? { ...c, ...customer } : c)
    }));
    const updated = get().customers.find(c => c.id === id);
    if (updated) pushCustomerToSupabase(updated).catch(() => {});
  },
  deleteCustomer: (id) => {
    set((state) => ({
      customers: state.customers.filter(c => c.id !== id),
      currentCustomerId: state.currentCustomerId === id ? undefined : state.currentCustomerId
    }));
    if (navigator.onLine) {
      deleteCustomerFromSupabase(id).then((ok) => {
        if (!ok) enqueueOfflineItem('customer_delete', { id }, `customer-delete:${id}`);
      }).catch(() => enqueueOfflineItem('customer_delete', { id }, `customer-delete:${id}`));
    } else {
      enqueueOfflineItem('customer_delete', { id }, `customer-delete:${id}`);
    }
  },

  cashSessions: [],
  openSession: async (session) => {
    const existingSessions = get().cashSessions || [];
    let maxTurn = 0;
    existingSessions.forEach(s => {
      const match = s.id?.match(/^Turno-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxTurn) maxTurn = num;
      }
    });
    
    // Si hay red, usar RPC para garantizar integridad y turno único
    if (navigator.onLine) {
      try {
        const res = await callOpenSessionRPC(session);
        if (res.success && res.data) {
          const officialSession = {
            ...res.data,
            openingBalance: Number(res.data.opening_balance || res.data.opening_amount) || 0,
            openingAmount: Number(res.data.opening_amount || res.data.opening_balance) || 0,
            workingEmployeeIds: res.data.working_employee_ids || [],
            movements: res.data.movements || []
          };
          set((state) => ({
            cashSessions: [...(state.cashSessions || []), officialSession],
            lastTurnNumber: Math.max(state.lastTurnNumber, parseInt(officialSession.id.split('-')[1]) || 0),
            cart: []
          }));
          return;
        }
      } catch (err) {
        console.warn("[openSession] RPC callOpenSessionRPC failed/errored, falling back to local queue:", err);
      }
    }

    const nextTurn = Math.max(maxTurn, get().lastTurnNumber || 0, existingSessions.length) + 1;
    // El turno creado offline necesita un ID estable y único que también pueda
    // usar la venta offline como session_id cuando llegue a Supabase.
    const sessionWithSequentialId = {
      ...session,
      id: `Turno-${nextTurn}-${crypto.randomUUID().slice(0, 8)}`,
      workingEmployeeIds: session.workingEmployeeIds && session.workingEmployeeIds.length > 0 
        ? session.workingEmployeeIds 
        : [session.userId]
    };
    set((state) => ({ 
      cashSessions: [...(state.cashSessions || []), sessionWithSequentialId],
      lastTurnNumber: nextTurn,
      cart: [] // ASEGURAR QUE EL CARRITO ESTÉ VACÍO AL ABRIR NUEVO TURNO
    }));
    // Offline-first: never fire-and-forget a master write. The session must
    // survive a reload and be retried through the operation queue.
    enqueueOfflineItem('cash_session', sessionWithSequentialId, `cash-open:${sessionWithSequentialId.id}`);
  },
  closeSession: async (sessionId, closingBalances, workerName, closingDate, discrepancyDeduction, sessionMeta) => {
    const finalClosingDate = closingDate || new Date().toISOString();
    const session = get().cashSessions.find(s => s.id === sessionId);
    if (!session) return;

    const sessionTxs = get().transactions.filter(t => 
      t.sessionId 
        ? t.sessionId === session.id
        : (t.branchId === session.branchId && 
           new Date(t.date).getTime() >= new Date(session.openedAt).getTime() &&
           (!session.closedAt || new Date(t.date).getTime() <= new Date(session.closedAt).getTime()))
    );
    
    const user = get().users.find(u => u.id === session.userId || u.name?.toLowerCase() === (workerName || session.workerName)?.toLowerCase());
    const commissions = sessionTxs.reduce((sum, tx) => {
      return sum + (tx.items || []).reduce((itemSum, item) => {
        const prodObj = typeof item.product === 'object' ? item.product : get().products.find(p => p.id === (item.product as unknown as string));
        const commVal = prodObj?.commissionValue || 0;
        const comm = commVal * (item.quantity || 0);
        return itemSum + comm;
      }, 0);
    }, 0);

    const baseSalary = user?.baseSalary || 0;
    const deduction = discrepancyDeduction || 0;
    const totalSalary = (baseSalary + commissions) - deduction;

    const finalSellerName = workerName || session.workerName || user?.name || 'Vendedor';

    const settlement: SalarySettlement = {
      id: crypto.randomUUID(),
      userId: session.userId,
      userName: finalSellerName,
      sessionId: sessionId,
      baseSalary: baseSalary,
      commissions: commissions,
      discrepancyDeduction: deduction,
      total: totalSalary,
      date: finalClosingDate,
      status: 'pending'
    };

    const updatedSession = {
      ...session,
      closedAt: finalClosingDate,
      status: 'closed' as 'closed',
      closingBalances: closingBalances || [],
      workerName: finalSellerName,
      closingDate: finalClosingDate,
      ...(sessionMeta || {})
    };

    // Intentar RPC atómico
    if (navigator.onLine) {
      try {
        const res = await callCloseSessionRPC(sessionId, closingBalances, finalClosingDate, session.notes || '', settlement);
        if (res.success) {
          // Actualizar localmente
          set((state) => ({
            cashSessions: (state.cashSessions || []).map(s => s.id === sessionId ? updatedSession : s),
            salarySettlements: [...(state.salarySettlements || []), { ...settlement, id: res.data?.settlement_id || settlement.id }],
            cart: []
          }));
          return;
        }
      } catch (err) {
        console.warn("[closeSession] RPC callCloseSessionRPC failed/errored, falling back to offline push:", err);
      }
    }

    set((state) => ({
      cashSessions: (state.cashSessions || []).map(s => 
        s.id === sessionId ? updatedSession : s
      ),
      salarySettlements: [...(state.salarySettlements || []), settlement],
      cart: [] // ASEGURAR QUE EL CARRITO ESTÉ VACÍO AL CERRAR TURNO
    }));

    // Preserve the complete close operation offline. The queue replays the
    // atomic close RPC and the settlement, rather than fire-and-forget upserts.
    enqueueOfflineItem('cash_session', { ...updatedSession, __operation: 'close', settlement }, `cash-close:${sessionId}`);
    enqueueOfflineItem('salary_settlement', settlement, `salary:${settlement.id}`);
    if (navigator.onLine) {
      pushCashSessionToSupabase(updatedSession).catch(() => {});
      import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
        pushSalarySettlementToSupabase(settlement).catch(() => {});
      });
    }
  },
  updateCashSession: (id, updates) => {
    set((state) => ({
      cashSessions: (state.cashSessions || []).map(s => 
        s.id === id ? { ...s, ...updates } : s
      )
    }));
    const updated = get().cashSessions.find(s => s.id === id);
    if (updated) {
      pushCashSessionToSupabase(updated).catch(() => {});
    }
  },
  updateCashSessionDateCascade: async (sessionId, newDateYMD) => {
    const state = get();
    const session = (state.cashSessions || []).find(s => s.id === sessionId);
    if (!session || !newDateYMD) return false;

    // Helper to shift ISO string to target YYYY-MM-DD date
    const shiftDate = (isoStr: string | null | undefined): string => {
      if (!isoStr) return '';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return `${newDateYMD}T12:00:00.000Z`;
        const [year, month, day] = newDateYMD.split('-').map(Number);
        const updated = new Date(d);
        updated.setFullYear(year, month - 1, day);
        return updated.toISOString();
      } catch {
        return `${newDateYMD}T12:00:00.000Z`;
      }
    };

    const newOpenedAt = shiftDate(session.openedAt);
    const newClosedAt = session.closedAt ? shiftDate(session.closedAt) : undefined;
    const newClosingDate = session.closingDate ? shiftDate(session.closingDate) : undefined;

    // Shift movements date
    const updatedMovements = (session.movements || []).map(m => ({
      ...m,
      date: shiftDate(m.date)
    }));

    const updatedSession: CashRegisterSession = {
      ...session,
      openedAt: newOpenedAt,
      closedAt: newClosedAt,
      closingDate: newClosingDate,
      movements: updatedMovements
    };

    // Find affected transactions
    const oldOpenTime = new Date(session.openedAt).getTime();
    const oldCloseTime = session.closedAt ? new Date(session.closedAt).getTime() : Infinity;

    const affectedTxIds = new Set<string>();
    const updatedTransactions = (state.transactions || []).map(tx => {
      const isLinked = tx.sessionId === session.id || (
        tx.branchId === session.branchId &&
        new Date(tx.date).getTime() >= oldOpenTime &&
        new Date(tx.date).getTime() <= oldCloseTime
      );
      if (isLinked) {
        affectedTxIds.add(tx.id);
        return {
          ...tx,
          sessionId: session.id, // Enforce sessionId linkage
          date: shiftDate(tx.date)
        };
      }
      return tx;
    });

    // Update bank transactions linked to these transactions
    const updatedBankTransactions = (state.bankTransactions || []).map(bt => {
      if (bt.transactionId && affectedTxIds.has(bt.transactionId)) {
        return {
          ...bt,
          date: shiftDate(bt.date)
        };
      }
      return bt;
    });

    // Update salary settlements linked to this session
    const updatedSalarySettlements = (state.salarySettlements || []).map(st => {
      if (st.sessionId === session.id) {
        return {
          ...st,
          date: newClosingDate || newOpenedAt
        };
      }
      return st;
    });

    // Update warranties linked to these transactions
    const updatedWarranties = (state.warranties || []).map(w => {
      if (affectedTxIds.has(w.transactionId)) {
        return {
          ...w,
          purchaseDate: shiftDate(w.purchaseDate)
        };
      }
      return w;
    });

    // Update returns linked to these transactions
    const updatedReturns = (state.returns || []).map(ret => {
      if (affectedTxIds.has(ret.transactionId)) {
        return {
          ...ret,
          date: shiftDate(ret.date)
        };
      }
      return ret;
    });

    // Update local state atomically
    set({
      cashSessions: (state.cashSessions || []).map(s => s.id === sessionId ? updatedSession : s),
      transactions: updatedTransactions,
      bankTransactions: updatedBankTransactions,
      salarySettlements: updatedSalarySettlements,
      warranties: updatedWarranties,
      returns: updatedReturns
    });

    // Sync updates to Supabase in background
    try {
      await pushCashSessionToSupabase(updatedSession);
      for (const tx of updatedTransactions) {
        if (affectedTxIds.has(tx.id)) {
          await pushTransactionToSupabase(tx);
        }
      }
      for (const bt of updatedBankTransactions) {
        if (bt.transactionId && affectedTxIds.has(bt.transactionId)) {
          await pushBankTransactionToSupabase(bt);
        }
      }
    } catch (e) {
      console.warn("Cascaded date update Supabase sync error:", e);
    }

    return true;
  },
  joinOpenSession: (sessionId, userId, workerName) => {
    set((state) => {
      const session = (state.cashSessions || []).find(s => s.id === sessionId);
      if (!session) return state;

      const employeeIds = [...(session.workingEmployeeIds || [])];
      if (userId && !employeeIds.includes(userId)) {
        employeeIds.push(userId);
      }

      const updatedSession: CashRegisterSession = {
        ...session,
        workingEmployeeIds: employeeIds,
        workerName: workerName || session.workerName
      };

      // Push updated session to Supabase
      pushCashSessionToSupabase(updatedSession).catch(() => {});

      return {
        cashSessions: (state.cashSessions || []).map(s => s.id === sessionId ? updatedSession : s)
      };
    });
  },
  getCurrentSession: (branchId, userId) => {
    const sessions = get().cashSessions || [];
    if (!userId) return undefined;
    
    // Strict match: must be open AND not deleted AND the specific user must be the opener or in working employees
    // Strictly isolate by branchId so cross-tablet/cross-branch sessions never collide
    return sessions.find(s => 
      s.status === 'open' && 
      !s.deletedAt &&
      (s.userId === userId || s.workingEmployeeIds?.includes(userId)) &&
      (branchId ? s.branchId === branchId : true)
    );
  },

  addInformationalSoldProductToSession: async (sessionId, itemData, affectStock, isDeduction = false) => {
    const session = get().cashSessions.find(s => s.id === sessionId);
    if (!session) {
      return { success: false };
    }

    const txs = get().transactions || [];
    const maxNum = txs.reduce((max, t) => {
      const match = t.id?.match(/INF-(\d+)/i) || t.id?.match(/ADJ-(\d+)/i) || t.id?.match(/SUB-(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const nextNum = Math.max(txs.length, maxNum) + 1;
    const prefix = isDeduction ? 'SUB' : 'INF';
    const txId = `${prefix}-${nextNum.toString().padStart(3, '0')}`;

    const rawTotalAmount = itemData.quantity * itemData.price;
    const totalAmount = isDeduction ? -Math.abs(rawTotalAmount) : Math.abs(rawTotalAmount);
    const itemQty = isDeduction ? -Math.abs(itemData.quantity) : Math.abs(itemData.quantity);

    const txDate = session.closingDate || session.closedAt || session.openedAt || new Date().toISOString();
    const currencyCode = itemData.currencyCode || get().getBaseCurrency().code;
    const curr = get().currencies.find(c => c.code === currencyCode);
    const rate = curr?.rateToBase || 1;

    const informationalTx: Transaction = {
      id: txId,
      branchId: session.branchId,
      userId: itemData.userId || session.userId,
      cashierName: itemData.workerName || session.workerName,
      date: txDate,
      subtotal: totalAmount,
      tax: 0,
      total: totalAmount,
      items: [
        {
          id: crypto.randomUUID(),
          product: {
            id: itemData.productId,
            name: itemData.productName,
            price: itemData.price,
            costPrice: 0,
            sku: isDeduction ? 'SUB' : 'INF'
          } as any,
          quantity: itemQty,
          price: itemData.price,
          total: totalAmount
        }
      ],
      payments: [
        {
          method: itemData.paymentMethod || 'cash',
          amount: totalAmount,
          currencyCode: currencyCode as any,
          exchangeRate: rate
        }
      ],
      status: 'completed',
      sessionId: session.id,
      notes: isDeduction
        ? (affectStock ? 'AJUSTE_AUDITORIA_RESTAR_DUPLICADO (Sumando stock devuelto a almacén)' : 'AJUSTE_AUDITORIA_RESTAR_DUPLICADO (Sin afectar stock)')
        : (affectStock ? 'AJUSTE_MANUAL_INFORME (Afectando stock físico)' : 'AJUSTE_MANUAL_INFORME (Sin afectar stock físico)')
    };

    // Agregar a transacciones locales
    set(state => ({
      transactions: [informationalTx, ...state.transactions]
    }));

    // Acción sobre el inventario físico del almacén de la sucursal:
    // Si isDeduction = false (agregar faltante): descontamos de inventario (-quantity)
    // Si isDeduction = true (restar producto anotado doble): SUMAMOS nuevamente al inventario de almacén (+quantity)
    if (affectStock) {
      const stockDelta = isDeduction ? Math.abs(itemData.quantity) : -Math.abs(itemData.quantity);
      get().adjustInventory(itemData.productId, session.branchId, stockDelta, itemData.variantLabel);
    }

    // Sincronizar transacción con Supabase
    pushTransactionToSupabase(informationalTx).catch(() => {});

    // Si el turno está cerrado, recalcular nómina si aplica
    if (session.status === 'closed') {
      const existingSettlement = (get().salarySettlements || []).find(st => st.sessionId === session.id);
      if (existingSettlement) {
        const productObj = get().products.find(p => p.id === itemData.productId);
        const commValue = productObj?.commissionValue || 0;
        const commDelta = commValue * Math.abs(itemData.quantity);
        const newCommissions = isDeduction
          ? Math.max(0, (existingSettlement.commissions || 0) - commDelta)
          : (existingSettlement.commissions || 0) + commDelta;
        const newTotal = isDeduction
          ? Math.max(0, (existingSettlement.total || 0) - commDelta)
          : (existingSettlement.total || 0) + commDelta;

        const updatedSettlement = {
          ...existingSettlement,
          commissions: newCommissions,
          total: newTotal
        };
        set(state => ({
          salarySettlements: state.salarySettlements.map(st => st.id === existingSettlement.id ? updatedSettlement : st)
        }));
        import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
          pushSalarySettlementToSupabase(updatedSettlement).catch(() => {});
        });
      }
    }

    return { success: true, transactionId: txId };
  },

  subtractInformationalProductFromSession: async (sessionId, itemData, affectStock = true) => {
    return get().addInformationalSoldProductToSession(sessionId, itemData, affectStock, true);
  },

  forceCloseSessionFromReports: async (sessionId, closingBalances, closingDate, notes) => {
    const session = get().cashSessions.find(s => s.id === sessionId);
    if (!session) return { success: false };

    const finalClosingDate = closingDate || new Date().toISOString();
    const finalBalances = closingBalances && closingBalances.length > 0
      ? closingBalances
      : session.closingBalances && session.closingBalances.length > 0
        ? session.closingBalances
        : [{ currencyCode: get().getBaseCurrency().code, amount: session.openingBalance || 0, method: 'cash' as const, exchangeRate: 1 }];

    const updatedSession: CashRegisterSession = {
      ...session,
      status: 'closed',
      closedAt: finalClosingDate,
      closingDate: finalClosingDate,
      closingBalances: finalBalances,
      notes: notes ? (session.notes ? `${session.notes} | ${notes}` : notes) : session.notes
    };

    // Actualizar localmente de inmediato
    set(state => ({
      cashSessions: state.cashSessions.map(s => s.id === sessionId ? updatedSession : s)
    }));

    // Si no tiene liquidación de salario generada, crearla
    const sessionTxs = (get().transactions || []).filter(t => 
      t.sessionId === session.id || (
        t.branchId === session.branchId &&
        new Date(t.date).getTime() >= new Date(session.openedAt).getTime() &&
        new Date(t.date).getTime() <= new Date(finalClosingDate).getTime()
      )
    );

    const user = get().users.find(u => u.id === session.userId || u.name?.toLowerCase() === session.workerName?.toLowerCase());
    const commissions = sessionTxs.reduce((sum, tx) => {
      return sum + (tx.items || []).reduce((itemSum, item) => {
        const prodObj = typeof item.product === 'object' ? item.product : get().products.find(p => p.id === (item.product as unknown as string));
        const commVal = prodObj?.commissionValue || 0;
        return itemSum + (commVal * (item.quantity || 0));
      }, 0);
    }, 0);

    const baseSalary = user?.baseSalary || 0;
    const totalSalary = baseSalary + commissions;

    const settlement: SalarySettlement = {
      id: crypto.randomUUID(),
      userId: session.userId,
      userName: session.workerName || user?.name || 'Vendedor',
      sessionId: session.id,
      baseSalary: baseSalary,
      commissions: commissions,
      discrepancyDeduction: 0,
      total: totalSalary,
      date: finalClosingDate,
      status: 'pending'
    };

    set(state => {
      const filtered = (state.salarySettlements || []).filter(st => st.sessionId !== session.id);
      return { salarySettlements: [...filtered, settlement] };
    });

    // Subir a Supabase
    pushCashSessionToSupabase(updatedSession).catch(() => {});
    import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
      pushSalarySettlementToSupabase(settlement).catch(() => {});
    });

    return { success: true };
  },

  pendingOrders: [],
  createPendingOrder: (order) => set((state) => ({
    pendingOrders: [...state.pendingOrders, order]
  })),
  removePendingOrder: (id) => set((state) => ({
    pendingOrders: state.pendingOrders.filter(o => o.id !== id)
  })),

  // Suppliers
  suppliers: [],
  addSupplier: (s) => {
    const newSupplier = { ...s, products: s.products || [] };
    set(state => ({ suppliers: [...state.suppliers, newSupplier] }));
    pushSupplierToSupabase(newSupplier).catch(() => {});
  },
  updateSupplier: (id, s) => {
    set(state => ({ suppliers: state.suppliers.map(x => x.id === id ? { ...x, ...s } : x) }));
    const updated = get().suppliers.find(x => x.id === id);
    if (updated) pushSupplierToSupabase(updated).catch(() => {});
  },
  deleteSupplier: (id) => {
    set(state => ({ suppliers: state.suppliers.filter(x => x.id !== id) }));
    deleteSupplierFromSupabase(id).catch(() => {});
  },

  supplierOrders: [],
  createSupplierOrder: (o) => {
    set(state => ({ supplierOrders: [o, ...state.supplierOrders] }));
    pushSupplierOrderToSupabase(o).catch(() => {});
  },
  updateSupplierOrder: async (id, o) => {
    const previous = get().supplierOrders.find(x => x.id === id);
    const requestedReceived = o.status === 'received' && previous?.status !== 'received';
    if (requestedReceived && navigator.onLine) {
      const userId = get().currentUser?.id || 'system';
      const res = await callReceiveSupplierOrderRPC(id, userId);
      if (!res.success) return;
    } else if (requestedReceived && !navigator.onLine) {
      // Offline receive remains local; the final cloud application is idempotent.
      enqueueOfflineItem('supplier_receive', { id, userId: get().currentUser?.id || 'system' }, `supplier:${id}`);
    }

    set(state => {
      const current = state.supplierOrders.find(x => x.id === id);
      const updated = state.supplierOrders.map(x => x.id === id ? { ...x, ...o } : x);
      const order = updated.find(x => x.id === id);
      if (order && current?.status !== 'received' && order.status === 'received' && !navigator.onLine) {
        // El RPC de recepción es la única autoridad para modificar stock. En offline
        // actualizamos solo el espejo local para evitar una segunda operación de inventario.
        const nextInventory = [...state.inventory];
        for (const item of order.items || []) {
          const qty = Number(item.quantity) || 0;
          const idx = nextInventory.findIndex(i => i.productId === item.productId && i.branchId === order.branchId && (i.variantLabel || '') === (item.variantLabel || ''));
          if (idx >= 0) nextInventory[idx] = { ...nextInventory[idx], quantity: Math.max(0, Number(nextInventory[idx].quantity || 0) + qty) };
          else if (qty > 0) nextInventory.push({ id: crypto.randomUUID(), productId: item.productId, branchId: order.branchId, quantity: qty, minQuantity: 5, variantLabel: item.variantLabel || '' });
        }
        return { supplierOrders: updated, inventory: nextInventory };
      }
      return { supplierOrders: updated };
    });
    const updatedOrder = get().supplierOrders.find(x => x.id === id);
    if (updatedOrder) pushSupplierOrderToSupabase(updatedOrder).catch(() => {});
  },

  inventoryAudits: [],
  createInventoryAudit: (a) => {
    set(state => ({ inventoryAudits: [a, ...state.inventoryAudits] }));
  },
  completeInventoryAudit: async (id, items, notes) => {
    const audit = get().inventoryAudits.find(a => a.id === id);
    if (!audit || audit.status === 'completed') return;
    const userId = get().currentUser?.id || audit.userId || 'system';
    if (navigator.onLine) {
      const res = await callCompleteInventoryAuditRPC(id, audit.branchId, userId, items, notes);
      if (!res.success) return;
    } else {
      enqueueOfflineItem('audit_complete', { id, branchId: audit.branchId, userId, items, notes }, `audit:${id}`);
    }

    set(state => {
      const currentAudit = state.inventoryAudits.find(a => a.id === id);
      if (!currentAudit || currentAudit.status === 'completed') return state;
      // Local mirror uses actual - expected. The server remains authoritative and
      // will reconcile this state on the next sync.
      const normalizedItems = items.map((item: any) => ({ ...item, difference: (Number(item.counted ?? item.actual) || 0) - (Number(item.expected) || 0) }));
      const updatedAudits = state.inventoryAudits.map(a => a.id === id ? { ...a, status: 'completed' as const, items: normalizedItems, notes, date: new Date().toISOString() } : a);
      let inventory = [...state.inventory];
      for (const item of normalizedItems) {
        if (!item.difference) continue;
        const idx = inventory.findIndex(i => i.productId === item.productId && i.branchId === audit.branchId && (i.variantLabel || '') === (item.variantLabel || ''));
        if (idx !== -1) inventory[idx] = { ...inventory[idx], quantity: Math.max(0, inventory[idx].quantity + item.difference) };
      }
      return { inventoryAudits: updatedAudits, inventory };
    });
  },

  fiscalConfigs: INITIAL_FISCAL_CONFIGS,
  updateFiscalConfig: (id, c) => set(state => ({ fiscalConfigs: state.fiscalConfigs.map(x => x.id === id ? { ...x, ...c } : x) })),
  getNextNCF: (type) => {
    const config = get().fiscalConfigs.find(c => c.type === type && c.active);
    if (!config) return undefined;
    if (config.current > config.limit) return undefined;
    
    const ncf = `${config.prefix}${config.current.toString().padStart(8, '0')}`;
    get().updateFiscalConfig(config.id, { current: config.current + 1 });
    return ncf;
  },

  demandForecasts: [],
  updateForecasts: (f) => set({ demandForecasts: f }),

  receiptConfig: {
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showFooter: true,
    footerText: "¡GRACIAS POR SU PREFERENCIA!",
    businessName: "MARÉ",
    businessAddress: "Calle Principal #123, Cuba",
    businessPhone: "+53 000-0000",
    printerWidth: "58mm",
    openDrawer: true,
    autoPrint: true,
  },
  updateReceiptConfig: (config) => {
    set((state) => ({
      receiptConfig: { ...state.receiptConfig, ...config }
    }));
    const full = get().receiptConfig;
    pushReceiptConfigToSupabase(full).catch(() => {});
  },

  salarySettlements: [],
  addSalarySettlement: (settlement) => {
    set((state) => ({
      salarySettlements: [settlement, ...state.salarySettlements]
    }));
    import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
      pushSalarySettlementToSupabase(settlement).catch(() => {});
    }).catch(() => {});
  },
  updateSalarySettlement: (id, settlement) => {
    set((state) => ({
      salarySettlements: state.salarySettlements.map(s => s.id === id ? { ...s, ...settlement } : s)
    }));
    const updated = get().salarySettlements.find(s => s.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
        pushSalarySettlementToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },
  addCashMovement: (sessionId, movement) => {
    set((state) => ({
      cashSessions: state.cashSessions.map(s => 
        s.id === sessionId ? { ...s, movements: [...(s.movements || []), movement] } : s
      )
    }));
    const updated = get().cashSessions.find(s => s.id === sessionId);
    if (updated) {
      enqueueOfflineItem('cash_session', updated, `cash-movement:${sessionId}:${movement.id}`);
      if (navigator.onLine) pushCashSessionToSupabase(updated).catch(() => {});
    }
  },
  removeCashMovement: (sessionId, movementId) => {
    set((state) => ({
      cashSessions: (state.cashSessions || []).map(s => 
        s.id === sessionId ? { ...s, movements: (s.movements || []).filter(m => m.id !== movementId) } : s
      )
    }));
    const updated = get().cashSessions.find(s => s.id === sessionId);
    if (updated) {
      enqueueOfflineItem('cash_session', updated, `cash-movement-remove:${sessionId}:${movementId}:${Date.now()}`);
      if (navigator.onLine) pushCashSessionToSupabase(updated).catch(() => {});
    }
  },

  transfers: [],
  addTransfer: (transfer) => {
    // The transfer RPC is the only authority for inventory transfers. Calling a
    // second upsert here used to duplicate/overwrite a transfer after the RPC
    // had already committed it. This action only updates the local ledger.
    set((state) => ({
      transfers: [transfer, ...state.transfers.filter(t => t.id !== transfer.id && t.operationId !== transfer.operationId)]
    }));
  },

  warranties: [],
  addWarranty: (warranty) => {
    set((state) => ({ warranties: [warranty, ...state.warranties] }));
    import('../services/supabaseSync').then(({ pushWarrantyToSupabase }) => {
      pushWarrantyToSupabase(warranty).catch(() => {});
    }).catch(() => {});
  },
  updateWarranty: (id, warranty) => {
    set((state) => ({
      warranties: state.warranties.map(w => w.id === id ? { ...w, ...warranty } : w)
    }));
    const updated = get().warranties.find(w => w.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushWarrantyToSupabase }) => {
        pushWarrantyToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },

  bankCards: INITIAL_BANK_CARDS,
  addBankCard: (card) => {
    set(state => {
      // Deduplicación por ID, Número de Cuenta o Nombre+Banco
      const isDuplicate = state.bankCards.some(c => 
        c.id === card.id || 
        (c.accountNumber && card.accountNumber && c.accountNumber === card.accountNumber) ||
        (c.name.toLowerCase().trim() === card.name.toLowerCase().trim() && c.bankName?.toLowerCase().trim() === card.bankName?.toLowerCase().trim())
      );
      if (isDuplicate) return state;
      return { bankCards: [...state.bankCards, card] };
    });
    pushBankCardToSupabase(card).catch(() => {});
  },
  updateBankCard: (id, card) => {
    set(state => {
      const updated = state.bankCards.map(c => c.id === id ? { ...c, ...card } : c);
      const found = updated.find(c => c.id === id);
      if (found) pushBankCardToSupabase(found).catch(() => {});
      return { bankCards: updated };
    });
  },
  deleteBankCard: (id) => {
    set(state => ({ bankCards: state.bankCards.filter(c => c.id !== id) }));
    deleteBankCardFromSupabase(id).catch(() => {});
  },

  bankTransactions: [],
  addBankTransaction: (transaction) => {
    set(state => {
      // 1. Strict anti-duplication check
      const isDuplicate = (state.bankTransactions || []).some(t => {
        if (t.id === transaction.id) return true;
        if (transaction.transactionId && t.transactionId && t.transactionId === transaction.transactionId) return true;
        if (transaction.reference && t.reference && t.reference === transaction.reference && t.cardId === transaction.cardId) return true;
        return false;
      });

      if (isDuplicate) {
        console.warn("[Bank] Duplicate bank transaction blocked:", transaction);
        return state;
      }

      const updatedCards = state.bankCards.map(card => {
        if (card.id === transaction.cardId) {
          let newBalance = card.balance;
          if (transaction.type === 'deposit' || transaction.type === 'payment_received') {
            newBalance += transaction.amount;
          } else if (transaction.type === 'withdrawal' || transaction.type === 'supplier_payment') {
            newBalance = Math.max(0, newBalance - transaction.amount);
          }
          const updatedCard = { ...card, balance: newBalance };
          pushBankCardToSupabase(updatedCard).catch(() => {});
          return updatedCard;
        }
        return card;
      });

      pushBankTransactionToSupabase(transaction).catch(() => {});
      return { 
        bankTransactions: [transaction, ...state.bankTransactions],
        bankCards: updatedCards
      };
    });
  },

  deleteBankTransaction: (id) => {
    set(state => {
      const txToDelete = (state.bankTransactions || []).find(t => t.id === id);
      if (!txToDelete) return state;

      // Adjust card balance
      const updatedCards = state.bankCards.map(card => {
        if (card.id === txToDelete.cardId) {
          let newBalance = card.balance;
          if (txToDelete.type === 'deposit' || txToDelete.type === 'payment_received') {
            // Deduct deposit amount from card balance
            newBalance = Math.max(0, newBalance - txToDelete.amount);
          } else if (txToDelete.type === 'withdrawal' || txToDelete.type === 'supplier_payment') {
            // Restore withdrawal amount to card balance
            newBalance = newBalance + txToDelete.amount;
          }
          const updatedCard = { ...card, balance: newBalance };
          pushBankCardToSupabase(updatedCard).catch(() => {});
          return updatedCard;
        }
        return card;
      });

      // Deletions must also be durable offline; otherwise the local deletion
      // silently reappears after the next cloud pull.
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        deleteBankTransactionFromSupabase(id).catch(() => {
          enqueueOfflineItem('bank_transaction', { id, __operation: 'delete' }, `bank-delete:${id}`);
        });
      } else {
        enqueueOfflineItem('bank_transaction', { id, __operation: 'delete' }, `bank-delete:${id}`);
      }

      return {
        bankTransactions: state.bankTransactions.filter(t => t.id !== id),
        bankCards: updatedCards
      };
    });
  },

  reconcileBankBalances: async () => {
    const state = get();
    const seenIds = new Set<string>();
    const seenTxIds = new Set<string>();
    const seenRefs = new Set<string>();
    const uniqueTxs: import('../types').BankTransaction[] = [];
    let removedDuplicates = 0;

    // Filter duplicates preserving the most recent unique record
    for (const bt of state.bankTransactions || []) {
      const isDuplicate = seenIds.has(bt.id) || 
                          (bt.transactionId && seenTxIds.has(bt.transactionId)) ||
                          (bt.reference && seenRefs.has(`${bt.cardId}::${bt.reference}`));

      if (isDuplicate) {
        removedDuplicates++;
        // Si detectamos duplicado, intentar eliminar de Supabase para limpiar la nube también
        deleteBankTransactionFromSupabase(bt.id).catch(() => {});
        continue;
      }

      seenIds.add(bt.id);
      if (bt.transactionId) seenTxIds.add(bt.transactionId);
      if (bt.reference) seenRefs.add(`${bt.cardId}::${bt.reference}`);
      uniqueTxs.push(bt);
    }

    if (removedDuplicates > 0) {
      set({ bankTransactions: uniqueTxs });
    }

    const totalSales = state.transactions.length;
    const totalMovements = uniqueTxs.length;

    return {
      removedDuplicates,
      totalSales,
      totalMovements,
      message: `Reconciliación completada: Base de datos sincronizada con ${totalSales} ventas y ${totalMovements} movimientos bancarios verificados.${removedDuplicates > 0 ? ` Se eliminaron ${removedDuplicates} duplicados.` : ''}`
    };
  },

  refreshBranchInventory: async () => {
    const branchId = get().currentBranchId;
    if (!branchId || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;
    try {
      const res = await pullBranchInventoryFromSupabase(branchId);
      if (!res.success) return false;
      const byKey = new Map<string, InventoryLevel>();
      for (const item of get().inventory || []) {
        if (item.branchId !== branchId) byKey.set(`${item.productId}:${item.branchId}:${item.variantLabel || ''}`, item);
      }
      for (const item of res.inventory) byKey.set(`${item.productId}:${item.branchId}:${item.variantLabel || ''}`, item);
      set({ inventory: Array.from(byKey.values()) });
      return true;
    } catch {
      return false;
    }
  },

  bootstrapPosFromSupabase: async () => {
    const branchId = get().currentBranchId;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    const res = await pullPosBootstrapFromSupabase(branchId);
    if (!res.success || !res.data) return false;
    const d = res.data;
    set((state) => {
      const mergeById = <T extends { id: string }>(remote: T[] | undefined, local: T[]) => {
        const map = new Map(local.map(x => [x.id, x]));
        for (const item of remote || []) map.set(item.id, item);
        return Array.from(map.values());
      };
      const branchInv = d.inventory || [];
      const invMap = new Map<string, InventoryLevel>();
      for (const item of state.inventory || []) {
        if (branchId && item.branchId === branchId) continue;
        invMap.set(`${item.productId}:${item.branchId}:${item.variantLabel || ''}`, item);
      }
      for (const item of branchInv) invMap.set(`${item.productId}:${item.branchId}:${item.variantLabel || ''}`, item);
      return {
        branches: mergeById(d.branches, state.branches || []),
        categories: mergeById(d.categories, state.categories || []),
        products: mergeById(d.products, state.products || []),
        inventory: Array.from(invMap.values()),
        users: mergeById(d.users, state.users || []),
        customers: mergeById(d.customers, state.customers || []),
        currencies: d.currencies?.length ? d.currencies : state.currencies,
        idnSettlementPrices: mergeById(d.idnSettlementPrices, state.idnSettlementPrices || []),
        transactions: mergeById(d.transactions, state.transactions || []),
        cashSessions: mergeById(d.cashSessions, state.cashSessions || []),
        lastSyncTime: new Date().toISOString(),
        syncResult: { success: true, message: 'Caché POS actualizado de forma incremental.' }
      };
    });
    return true;
  },

  syncWithSupabase: async () => {
    set({ isSyncing: true });
    try {
      const { data, result } = await pullAllFromSupabase();
      if (result.success && data) {
        set((state) => {
          // Helper para deduplicar arrays por ID o clave personalizada
          // AHORA ES ADITIVO: No descarta datos locales que no están en Supabase, 
          // simplemente prioriza Supabase para los conflictos de ID.
          const mergeUnique = <T extends Record<string, any>>(supabaseData: T[] | undefined, localData: T[], options?: { offlineIds?: Set<string | number>, semanticDedupe?: boolean, idKey?: string, semanticKeys?: string[] }): T[] => {
            const idKey = options?.idKey || 'id';
            const semanticKeys = options?.semanticKeys || (options?.semanticDedupe ? ['name'] : []);
            const map = new Map<string | number, T>();
            const semanticMap = new Map<string, string | number>(); 
            
            const getSemanticKey = (item: T): string | null => {
              if (semanticKeys.length === 0) return null;
              const values = semanticKeys.map(k => normalizeSemanticText(String(item[k] || ''))).filter(Boolean);
              return values.length > 0 ? values.join('::') : null;
            };

            // 1. Cargar TODOS los datos locales primero
            localData.forEach(item => {
              const sKey = getSemanticKey(item);
              if (sKey) {
                semanticMap.set(sKey, item[idKey]);
              }
              map.set(item[idKey], item);
            });
            
            // 2. Sobrescribir con datos de Supabase (la fuente de verdad principal)
            if (supabaseData) {
              supabaseData.forEach(item => {
                const sKey = getSemanticKey(item);
                if (sKey) {
                  const existingId = semanticMap.get(sKey);
                  if (existingId && existingId !== item[idKey]) {
                    map.delete(existingId);
                  }
                  semanticMap.set(sKey, item[idKey]);
                }
                
                // Si es una sesión de caja y localmente ya fue cerrada pero en la nube está abierta, preservar el estado cerrado
                if (item.status === 'open') {
                  const localItem = map.get(item[idKey]);
                  if (localItem && localItem.status === 'closed') {
                    map.set(item[idKey], {
                      ...item,
                      status: 'closed',
                      closedAt: localItem.closedAt || item.closed_at || new Date().toISOString(),
                      closingDate: localItem.closingDate || localItem.closedAt,
                      closingBalances: localItem.closingBalances || []
                    });
                    return;
                  }
                }

                map.set(item[idKey], item);
              });
            }
            
            return Array.from(map.values());
          };

          // --- 1. Sucursales ---
          const offlineQueuedBranchItems = getOfflineQueue().filter(i => i.type === 'branch');
          const offlineQueuedBranchIds = new Set(offlineQueuedBranchItems.map(i => i.data.id));
          
          const mergedBranches = mergeUnique(data.branches, state.branches || [], { offlineIds: offlineQueuedBranchIds });
          
          // Purge: Si recibimos datos de Supabase, eliminar locales que no estén en Supabase Y no estén en la cola offline
          const finalBranches = (data.branches && data.branches.length > 0)
            ? mergedBranches.filter(b => 
                data.branches.some((sb: any) => sb.id === b.id) || 
                offlineQueuedBranchIds.has(b.id)
              )
            : mergedBranches;

          const validBranchIds = new Set(finalBranches.map(b => b.id));

          let nextBranchId = state.currentBranchId;
          if (!nextBranchId || !validBranchIds.has(nextBranchId)) {
            nextBranchId = finalBranches[0]?.id || '';
          }

          // --- 2. Transacciones ---
          const offlineQueuedTxIds = new Set(
            getOfflineQueue().filter(i => i.type === 'transaction' || i.type === 'void_transaction').map(i => i.data.id)
          );
          const mergedTransactionsRaw = mergeUnique(data.transactions, state.transactions || [], { offlineIds: offlineQueuedTxIds });
          const mergedTransactions = data.transactions
            ? mergedTransactionsRaw.filter(t => data.transactions.some((st: any) => st.id === t.id) || offlineQueuedTxIds.has(t.id))
            : mergedTransactionsRaw;

          // --- 3. Sesiones ---
          const offlineQueuedSessionIds = new Set(
            getOfflineQueue().filter(i => i.type === 'cash_session').map(i => i.data.id)
          );
          const mergedCashSessionsRaw = mergeUnique(data.cashSessions, state.cashSessions || [], { offlineIds: offlineQueuedSessionIds });
          const mergedCashSessions = data.cashSessions
            ? mergedCashSessionsRaw.filter(cs => data.cashSessions.some((ss: any) => ss.id === cs.id) || offlineQueuedSessionIds.has(cs.id))
            : mergedCashSessionsRaw;

          // --- 4. Clientes ---
          const offlineQueuedCustomerIds = new Set(
            getOfflineQueue().filter(i => i.type === 'customer').map(i => i.data.id)
          );
          const mergedCustomers = mergeUnique(data.customers, state.customers || [], { offlineIds: offlineQueuedCustomerIds });

          // --- 5. Devoluciones ---
          const offlineQueuedReturnIds = new Set(
            getOfflineQueue().filter(i => i.type === 'return' || i.type === 'return_complete').map(i => i.data.id)
          );
          const mergedReturnsRaw = mergeUnique(data.returns, state.returns || [], { offlineIds: offlineQueuedReturnIds });
          const mergedReturns = data.returns
            ? mergedReturnsRaw.filter(r => data.returns.some((sr: any) => sr.id === r.id) || offlineQueuedReturnIds.has(r.id))
            : mergedReturnsRaw;

          // --- 6. Inventario (Deduplicación por combinación única) ---
          const baseInv = data.inventory !== undefined ? data.inventory : state.inventory;
          const invMap = new Map<string, InventoryLevel>();
          baseInv.forEach(inv => {
            const key = `${inv.productId}_${inv.branchId}_${inv.variantLabel || ''}`;
            invMap.set(key, inv);
          });
          // Las operaciones offline pendientes son deltas/reconciliaciones y no deben
          // sobrescribir aquí el snapshot remoto. El motor de cola las aplica primero.
          // Purge Inventario: Si recibimos de Supabase, quitar los que no estén en Supabase y no estén en cola offline
          let mergedInventory = Array.from(invMap.values()).filter(inv => !inv.branchId || validBranchIds.has(inv.branchId));
          if (data.inventory && data.inventory.length > 0) {
            const supabaseInvKeys = new Set(data.inventory.map((si: any) => `${si.product_id || si.productId}_${si.branch_id || si.branchId}_${si.variant_label || si.variantLabel || ''}`));
            mergedInventory = mergedInventory.filter(inv => {
              const key = `${inv.productId}_${inv.branchId}_${inv.variantLabel || ''}`;
              return supabaseInvKeys.has(key);
            });
          }

          // --- 7. Otros (Deduplicación simple por ID o clave única) ---
          const mergedProducts = mergeUnique(data.products, state.products || []);
          // Purge Productos
          const finalProducts = (data.products && data.products.length > 0) 
            ? mergedProducts.filter(p => data.products.some((sp: any) => sp.id === p.id))
            : mergedProducts;

          const mergedCategories = mergeUnique(data.categories, state.categories || []);
          // Purge Categorías
          const finalCategories = (data.categories && data.categories.length > 0)
            ? mergedCategories.filter(c => data.categories.some((sc: any) => sc.id === c.id))
            : mergedCategories;

          const mergedUsers = mergeUnique(data.users, state.users || []);
          // Purge Users (except initial admins)
          const finalUsers = (data.users && data.users.length > 0)
            ? mergedUsers.filter(u => data.users.some((su: any) => su.id === u.id) || u.id.startsWith('admin-') || u.id.startsWith('employee-'))
            : mergedUsers;

          const mergedBankCards = mergeUnique(data.bankCards, state.bankCards || []);
          const mergedBankTransactions = mergeUnique(data.bankTransactions, state.bankTransactions || []);
          const mergedSuppliers = mergeUnique(data.suppliers, state.suppliers || []);
          const mergedSupplierOrders = mergeUnique(data.supplierOrders, state.supplierOrders || []);
          const mergedCurrencies = mergeUnique(data.currencies, state.currencies || [], { idKey: 'code' });
          const mergedTransfers = mergeUnique(data.transfers, state.transfers || []);
          const mergedWarranties = mergeUnique(data.warranties, state.warranties || []);
          const mergedQuotes = mergeUnique(data.quotes, state.quotes || []);
          const mergedTimeShifts = mergeUnique(data.timeShifts, state.timeShifts || []);
          const mergedSalarySettlements = mergeUnique(data.salarySettlements, state.salarySettlements || []);
          const mergedIdnSettlementPrices = mergeUnique(data.idnSettlementPrices, state.idnSettlementPrices || []);

          const updatedCurrentUser = state.currentUser
            ? (finalUsers.find((u: any) => u.id === state.currentUser?.id) || state.currentUser)
            : null;

          return {
            products: finalProducts,
            categories: finalCategories,
            inventory: mergedInventory,
            branches: finalBranches,
            currentBranchId: nextBranchId,
            users: finalUsers,
            currentUser: updatedCurrentUser,
            bankCards: mergedBankCards,
            bankTransactions: mergedBankTransactions,
            customers: mergedCustomers,
            suppliers: mergedSuppliers,
            supplierOrders: mergedSupplierOrders,
            currencies: mergedCurrencies,
            transactions: mergedTransactions,
            cashSessions: mergedCashSessions,
            transfers: mergedTransfers,
            warranties: mergedWarranties,
            returns: mergedReturns,
            quotes: mergedQuotes,
            timeShifts: mergedTimeShifts,
            salarySettlements: mergedSalarySettlements,
            idnSettlementPrices: mergedIdnSettlementPrices,
            receiptConfig: data.receiptConfig ? { ...state.receiptConfig, ...data.receiptConfig } : state.receiptConfig,
            storeConfig: data.storeConfig ? { ...state.storeConfig, ...data.storeConfig } : state.storeConfig,
            catalogConfig: data.catalogConfig ? { ...state.catalogConfig, ...data.catalogConfig } : state.catalogConfig,
            lastTurnNumber: data.lastTurnNumber !== undefined ? Math.max(state.lastTurnNumber, data.lastTurnNumber) : state.lastTurnNumber,
            lastSyncTime: new Date().toISOString(),
            syncResult: result,
            isSyncing: false
          };
        });
      } else {
        set({ isSyncing: false, syncResult: result });
      }
      if (result.success) {
        get().reconcileBankBalances().catch(() => {});
      }
      return result;
    } catch (e: any) {
      const errRes: SyncResult = { success: false, message: e?.message || 'Error al sincronizar con Supabase' };
      set({ isSyncing: false, syncResult: errRes });
      return errRes;
    }
  },

  seedDemoProducts: () => {
    set({
      products: INITIAL_PRODUCTS,
      inventory: INITIAL_INVENTORY,
      categories: INITIAL_CATEGORIES,
      branches: INITIAL_BRANCHES,
      bankCards: INITIAL_BANK_CARDS,
      currencies: INITIAL_CURRENCIES
    });
  },

  restoreTransactionsFromBackup: () => {
    try {
      const backupRaw = localStorage.getItem('mare_sales_backup_v1');
      if (!backupRaw) return;
      const backupList = JSON.parse(backupRaw);
      if (!Array.isArray(backupList) || backupList.length === 0) return;

      const currentTxs = get().transactions || [];
      const missingTxs = backupList.filter((bt: any) => !currentTxs.some((ct: any) => ct.id === bt.id));

      if (missingTxs.length > 0) {
        console.info(`[Backup Safety] Detectadas ${missingTxs.length} ventas faltantes en el estado local. Recuperándolas...`);
        set((state) => ({
          transactions: [...missingTxs, ...(state.transactions || [])]
        }));
        
        // Nunca insertar directamente una venta recuperada: debe pasar por la RPC
        // idempotente para que inventario/caja se mantengan coherentes.
        missingTxs.forEach(tx => {
          enqueueOfflineItem('transaction', tx, tx.id);
        });

        get().addNotification(`¡Garantía de Seguridad! Se recuperaron ${missingTxs.length} tickets de venta de forma automática.`, 'success');
      }
    } catch (e) {
      console.error("[Backup Safety] Error restoring from safety backup:", e);
    }
  },

  notifications: [],
  addNotification: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set(state => ({
      notifications: [...state.notifications, { id, message, type }]
    }));
    setTimeout(() => {
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, 4000);
  },
  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  isInitialized: true
}),
{
  name: 'pos-store-storage',
  storage: createJSONStorage(() => localStateStorage),
  // El estado operativo sigue persistiendo para poder trabajar offline, pero
  // evitamos guardar datos puramente transitorios y el historial bancario pesado
  // en cada cambio de UI.
  partialize: (state) => ({
    users: state.users, currentUser: state.currentUser,
    currencies: state.currencies, storeConfig: state.storeConfig, catalogConfig: state.catalogConfig,
    branches: state.branches, currentBranchId: state.currentBranchId, categories: state.categories,
    products: state.products, inventory: state.inventory, cart: state.cart, currentCustomerId: state.currentCustomerId,
    transactions: state.transactions, returns: state.returns, warranties: state.warranties,
    cashSessions: state.cashSessions, transfers: state.transfers, suppliers: state.suppliers,
    supplierOrders: state.supplierOrders, inventoryAudits: state.inventoryAudits, salarySettlements: state.salarySettlements,
    quotes: state.quotes, timeShifts: state.timeShifts, pendingOrders: state.pendingOrders,
    idnSettlementPrices: state.idnSettlementPrices, receiptConfig: state.receiptConfig,
    fiscalConfigs: state.fiscalConfigs, bankCards: state.bankCards
  })
}
));
