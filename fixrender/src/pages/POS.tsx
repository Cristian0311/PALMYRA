import React, { lazy, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { Search, Wifi, WifiOff, RefreshCw, Plus, Minus, CreditCard, Receipt, Trash2, ShoppingCart, ShieldCheck, DollarSign, Banknote, QrCode, ArrowLeftRight, UserPlus, X, Lock, Unlock, Camera, AlertCircle, TrendingUp, Wallet, MessageSquare, Mail, HelpCircle, Calculator, ArrowRight, Package, User, RotateCcw, Printer, Bluetooth, Usb, Smartphone, Send, Copy, Check, CheckCircle, Share2, Store, ChevronDown, ChevronUp, Filter } from "lucide-react";
import type { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { cn, generateId } from "../lib/utils";
import { useStore } from "../store/useStore";
import { Product, Payment, Transaction, CashRegisterSession } from "../types";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { InfoTooltip } from "../components/InfoTooltip";
import { getOfflineQueueCount, processOfflineQueue } from "../services/offlineSync";
import { normalizeSemanticText } from "../utils/textUtils";
import { POSCatalog } from "../components/POSCatalog";

const POSReceiptModal = lazy(() => import("../components/POSReceiptModal"));
const POSPrinterSetupModal = lazy(() => import("../components/POSPrinterSetupModal"));

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_CASH_SESSIONS: CashRegisterSession[] = [];

export default function POS() {
  const [showCashManagementModal, setShowCashManagementModal] = useState(false);
  const [lastClosedSession, setLastClosedSession] = useState<CashRegisterSession | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  const { categories, products, cart, addToCart, updateCartQty, clearCart, processTransaction, branches, currentBranchId, setCurrentBranch, currencies, getBaseCurrency, currentCustomerId, setCartCustomer, currentUser, pendingOrders, removePendingOrder, getCurrentSession, openSession, closeSession, addCashMovement, removeCashMovement, inventory, addCustomer, bankCards, addBankTransaction, customers, users, logout, createReturn, processReturn, receiptConfig, idnSettlementPrices, addIDNSettlementPrice, updateIDNSettlementPrice, deleteIDNSettlementPrice, setInventoryQuantity, addNotification, joinOpenSession, salarySettlements } = useStore(useShallow((state) => ({ categories: state.categories, products: state.products, cart: state.cart, addToCart: state.addToCart, updateCartQty: state.updateCartQty, clearCart: state.clearCart, processTransaction: state.processTransaction, branches: state.branches, currentBranchId: state.currentBranchId, setCurrentBranch: state.setCurrentBranch, currencies: state.currencies, getBaseCurrency: state.getBaseCurrency, currentCustomerId: state.currentCustomerId, setCartCustomer: state.setCartCustomer, currentUser: state.currentUser, pendingOrders: state.pendingOrders, removePendingOrder: state.removePendingOrder, getCurrentSession: state.getCurrentSession, openSession: state.openSession, closeSession: state.closeSession, addCashMovement: state.addCashMovement, removeCashMovement: state.removeCashMovement, inventory: state.inventory, addCustomer: state.addCustomer, bankCards: state.bankCards, addBankTransaction: state.addBankTransaction, customers: state.customers, users: state.users, logout: state.logout, createReturn: state.createReturn, processReturn: state.processReturn, receiptConfig: state.receiptConfig, idnSettlementPrices: state.idnSettlementPrices, addIDNSettlementPrice: state.addIDNSettlementPrice, updateIDNSettlementPrice: state.updateIDNSettlementPrice, deleteIDNSettlementPrice: state.deleteIDNSettlementPrice, setInventoryQuantity: state.setInventoryQuantity, addNotification: state.addNotification, joinOpenSession: state.joinOpenSession, salarySettlements: state.salarySettlements })));


  // Heavy administrative collections subscribe only while their UI is visible.
  // Normal sales therefore do not re-render because a transaction/session changed elsewhere.
  const needsTransactions = showCashManagementModal || !!lastClosedSession;
  const needsCashSessions = showOpenShiftModal || !!joiningSessionId;
  const transactions = useStore((state) => needsTransactions ? state.transactions : EMPTY_TRANSACTIONS);
  const cashSessions = useStore((state) => needsCashSessions ? state.cashSessions : EMPTY_CASH_SESSIONS);
  const activeCashSessions = useMemo(() => cashSessions.filter(s => !s.deletedAt), [cashSessions]);
  const activeTransactions = useMemo(() => transactions.filter(t => !t.deletedAt), [transactions]);
  const [idnFilter, setIdnFilter] = useState("");
  const [debouncedIdnFilter, setDebouncedIdnFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedIdnFilter(idnFilter);
    }, 200);
    return () => clearTimeout(timer);
  }, [idnFilter]);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [idnPhysicalCounts, setIdnPhysicalCounts] = useState<{ [productId: string]: number }>({});
  const [isProcessingIDN, setIsProcessingIDN] = useState(false);
  const [idnSelectedProductFilter, setIdnSelectedProductFilter] = useState("all");

  const [showIDNReceiptModal, setShowIDNReceiptModal] = useState<{
    tx: Transaction;
    details: any[];
    workerName: string;
    branchName: string;
    totalToPay: number;
    publicSales: number;
    date: string;
  } | null>(null);

  const [showSetSettlementPriceModal, setShowSetSettlementPriceModal] = useState(false);
  const [idnPriceFormProduct, setIdnPriceFormProduct] = useState("");
  const [idnPriceFormAmount, setIdnPriceFormAmount] = useState("");


  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(getOfflineQueueCount());
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  useEffect(() => {
    const updateCount = () => setPendingOfflineCount(getOfflineQueueCount());
    const handleOnline = () => {
      setIsOnline(true);
      updateCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateCount();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline_queue_updated', updateCount);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline_queue_updated', updateCount);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      addNotification('No hay conexión a internet actualmente.', 'warning');
      return;
    }
    setIsSyncingOffline(true);
    try {
      const res = await processOfflineQueue();
      setPendingOfflineCount(res.remaining);
      if (res.remaining > 0) {
        addNotification(`Sincronización incompleta: ${res.processed} operaciones procesadas y ${res.remaining} siguen pendientes.`, 'warning');
      } else if (res.processed > 0) {
        addNotification(`Sincronización manual completada: ${res.processed} operaciones confirmadas.`, 'success');
      } else {
        addNotification('Todo está al día y sincronizado con Supabase.', 'info');
      }
    } finally {
      setIsSyncingOffline(false);
    }
  };
  
  // Cash Management State
  const [cashManagementTab, setCashManagementTab] = useState<'movements' | 'close' | 'sales'>('movements');
  const [closingBalances, setClosingBalances] = useState<{ [key: string]: number }>({});
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [finalBalancesToClose, setFinalBalancesToClose] = useState<Payment[]>([]);
  const [movementData, setMovementData] = useState({ type: 'expense' as 'income' | 'expense', amount: '', currencyCode: 'CUP', description: '' });

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', taxId: '' });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [configData, setConfigData] = useState<{ serialNumber?: string, selectedSize?: string, selectedColor?: string }>({});
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isBottomBarMinimized, setIsBottomBarMinimized] = useState(false);
  const [copiedTransferInfo, setCopiedTransferInfo] = useState(false);
  
  const queryParams = new URLSearchParams(window.location.search);
  
  
  const navigate = useNavigate();
  const currentSession = getCurrentSession(currentBranchId || (currentUser?.branchId || currentUser?.assignedBranchId || branches[0]?.id || ''), currentUser?.id || '');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSalarySummary, setShowSalarySummary] = useState(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  const [showPrinterSetupModal, setShowPrinterSetupModal] = useState(false);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [printerStatusMsg, setPrinterStatusMsg] = useState("");

  useEffect(() => {
    import('../lib/escpos').then(async ({ getConnectedDeviceName }) => {
      const name = await getConnectedDeviceName();
      if (name) setConnectedPrinterName(name);
    }).catch(() => {});
  }, []);
  
  type PaymentLine = { id: string, code: string, amount: number, method: 'cash' | 'transfer', bankCardId?: string };
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState<Transaction | null>(null);
  const [returnConfirm, setReturnConfirm] = useState<{ tx: Transaction, item: any } | null>(null);

  const [activePaymentLineId, setActivePaymentLineId] = useState<string | null>(null);

  const [salesFilter, setSalesFilter] = useState<'all' | 'usd' | 'transfer' | 'cash_cup' | 'mixed'>('all');
  const [salesSubTab, setSalesSubTab] = useState<'tickets' | 'products'>('tickets');

  const [posError, setPosError] = useState("");
  const [posSuccess, setPosSuccess] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [sessionWorkerName, setSessionWorkerName] = useState("");
  const [sessionPassword, setSessionPassword] = useState("");

  const [joiningSessionPassword, setJoiningSessionPassword] = useState("");
  const [isNewEmployee, setIsNewEmployee] = useState(false);

  // Worker detection for shift opening and branch locking
  const detectedWorker = React.useMemo(() => {
    const trimmed = (sessionWorkerName || '').toLowerCase().trim();
    if (trimmed) {
      return (users || []).find(u => (u.name || '').toLowerCase() === trimmed) || null;
    }
    return null;
  }, [sessionWorkerName, users]);

  const isWorkerIndependent = detectedWorker?.isIndependent === true;
  const workerAssignedBranchId = detectedWorker?.assignedBranchId || (
    detectedWorker?.allowedBranches && detectedWorker.allowedBranches.length === 1 ? detectedWorker.allowedBranches[0] : null
  );

  const [posViewMode, setPosViewMode] = useState<'standard' | 'idn'>('standard');
  const [selectedAdminIDNUserId, setSelectedAdminIDNUserId] = useState<string>('');

  const isCurrentUserIndependent = currentUser?.isIndependent === true;
  const currentSessionWorker = currentSession ? (
    (users || []).find(u => u.id === currentSession.userId || (u.name && currentSession.workerName && u.name.toLowerCase() === currentSession.workerName.toLowerCase()))
  ) : null;
  const isSessionIndependent = currentSessionWorker?.isIndependent === true;

  const independentUsers = (users || []).filter(u => u.isIndependent);

  useEffect(() => {
    if (!selectedAdminIDNUserId && independentUsers.length > 0) {
      setSelectedAdminIDNUserId(independentUsers[0].id);
    }
  }, [independentUsers, selectedAdminIDNUserId]);

  // When a shift is opened for an independent worker or current user is independent, default view to 'idn'
  useEffect(() => {
    if (isSessionIndependent || isCurrentUserIndependent) {
      setPosViewMode('idn');
    }
  }, [isSessionIndependent, isCurrentUserIndependent]);

  const shouldShowIDNView = isCurrentUserIndependent || isSessionIndependent || posViewMode === 'idn';

  const activeIDNWorker = React.useMemo(() => {
    if (isCurrentUserIndependent) return currentUser;
    if (isSessionIndependent) return currentSessionWorker;
    if (selectedAdminIDNUserId) {
      const found = (users || []).find(u => u.id === selectedAdminIDNUserId);
      if (found) return found;
    }
    return (users || []).find(u => u.isIndependent) || currentUser;
  }, [isCurrentUserIndependent, isSessionIndependent, selectedAdminIDNUserId, users, currentUser, currentSessionWorker]);

  const activeIDNBranchId = activeIDNWorker?.assignedBranchId || activeIDNWorker?.branchId || currentBranchId;

  // Auto-lock sessionBranchId if worker has an assigned branch
  useEffect(() => {
    if (workerAssignedBranchId) {
      setSessionBranchId(workerAssignedBranchId);
    }
  }, [workerAssignedBranchId]);

  useEffect(() => {
    if (sessionWorkerName) {
      const exists = users.find(u => (u.name || '').toLowerCase() === sessionWorkerName.toLowerCase().trim());
      setIsNewEmployee(!exists);
    } else {
      setIsNewEmployee(false);
    }
  }, [sessionWorkerName, users]);
  
  const isBranchLocked = Boolean(
    workerAssignedBranchId || 
    (currentUser?.role !== 'admin' && currentUser?.assignedBranchId) ||
    (currentSession && ((users || []).find(u => u.id === currentSession.userId)?.assignedBranchId))
  );

  const allowedBranches = React.useMemo(() => {
    // Administrators can operate across every branch.
    if (currentUser?.role === 'admin') return branches || [];

    // Employees must never inherit a previous admin branch or fall back to all branches.
    // Their scope comes strictly from assignedBranchId, branchId, or allowedBranches.
    const assignedId = currentUser?.assignedBranchId || currentUser?.branchId || workerAssignedBranchId;
    if (assignedId) {
      return (branches || []).filter(b => b.id === assignedId);
    }
    if (currentUser?.allowedBranches && currentUser.allowedBranches.length > 0) {
      return (branches || []).filter(b => currentUser.allowedBranches!.includes(b.id));
    }
    return [];
  }, [currentUser, branches, workerAssignedBranchId]);
    
  const [showConfirmIDNModal, setShowConfirmIDNModal] = useState(false);

  const [sessionBranchId, setSessionBranchId] = useState<string>(
    currentBranchId || ((allowedBranches || []).length > 0 ? allowedBranches[0].id : "")
  );

  const handleCloseIDNAccount = () => {
    const targetWorker = activeIDNWorker;
    const branchId = activeIDNBranchId;
    if (!targetWorker) {
      setPosError("No se ha seleccionado ningún vendedor independiente.");
      return;
    }
    if (!branchId) {
      setPosError("El vendedor no tiene un almacén asignado para liquidar.");
      return;
    }
    setShowConfirmIDNModal(true);
  };

  const handleExecuteIDNSettlement = async () => {
    const targetWorker = activeIDNWorker;
    const branchId = activeIDNBranchId;
    if (!targetWorker || !branchId) {
      setShowConfirmIDNModal(false);
      return;
    }

    setIsProcessingIDN(true);
    try {
      const settlementDetails: any[] = [];
      let totalToPay = 0;

      const branchInventory = (inventory || []).filter(i => i.branchId === branchId);
      
      for (const invItem of branchInventory) {
        const product = (products || []).find(p => p.id === invItem.productId);
        if (!product) continue;

        const settlementPrice = (idnSettlementPrices || []).find(
          sp => sp.userId === targetWorker.id && sp.productId === product.id
        )?.settlementPrice || product.costPrice || 0;

        const physicalCount = idnPhysicalCounts[product.id] ?? invItem.quantity;
        const soldQty = Math.max(0, invItem.quantity - physicalCount);

        if (soldQty > 0) {
          const subtotal = soldQty * settlementPrice;
          totalToPay += subtotal;
          settlementDetails.push({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            qty: soldQty,
            publicPrice: product.price || 0,
            price: settlementPrice,
            subtotal
          });
        } else if (physicalCount > invItem.quantity) {
          // If physical count was manually increased above system stock without sales, update stock directly
          setInventoryQuantity(product.id, branchId, physicalCount);
        }
      }

      // Permitir liquidación con 0 ventas o 0 CUP de acuerdo a la solicitud del usuario
      const currentTransactions = useStore.getState().transactions.filter(t => !t.deletedAt);
      const maxIdnNum = currentTransactions.reduce((max, t) => {
        const match = t.id?.match(/LIQ-IDN-(\d+)/i);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      let nextIdnNum = Math.max(currentTransactions.length, maxIdnNum) + 1;
      let idnTxId = `LIQ-IDN-${nextIdnNum.toString().padStart(2, '0')}`;
      if (currentTransactions.some(t => t.id === idnTxId)) {
        const wSuffix = targetWorker.name?.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase() || 'W';
        idnTxId = `LIQ-IDN-${nextIdnNum.toString().padStart(2, '0')}-${wSuffix}`;
      }

      const transaction: Transaction = {
        id: idnTxId,
        items: settlementDetails.map(d => ({
          id: crypto.randomUUID(),
          product: (products || []).find(p => p.id === d.productId) || {
            id: d.productId,
            name: d.name,
            price: d.publicPrice,
            costPrice: d.price,
            sku: d.sku || 'IDN'
          } as any,
          quantity: d.qty,
          price: d.price,
          total: d.subtotal
        })),
        total: totalToPay,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        payments: [{
          method: 'cash',
          amount: totalToPay,
          currencyCode: baseCurrency.code,
          exchangeRate: 1
        }],
        branchId: branchId,
        userId: targetWorker.id,
        cashierName: targetWorker.name,
        sessionId: currentSession?.id,
        notes: 'LIQUIDACION_IDN',
        status: 'completed'
      };

      // Register transaction in store
      useStore.getState().processTransaction(transaction);

      const branchName = branches.find(b => b.id === branchId)?.name || 'Almacén Asignado';
      const totalPublicSales = settlementDetails.reduce((sum, d) => sum + ((d.publicPrice || d.price) * d.qty), 0);
      const receiptData = {
        tx: transaction,
        details: settlementDetails,
        workerName: targetWorker.name || 'Vendedor IDN',
        branchName: branchName,
        totalToPay: totalToPay,
        publicSales: totalPublicSales,
        date: transaction.date
      };

      setShowIDNReceiptModal(receiptData);
      setIdnPhysicalCounts({});
      setPosSuccess(`Liquidación de ${targetWorker.name} procesada correctamente.`);
      setTimeout(() => setPosSuccess(""), 3500);
      setShowConfirmIDNModal(false);
    } catch (err) {
      console.error("Error in IDN settlement:", err);
      setPosError("Error al procesar la liquidación.");
    } finally {
      setIsProcessingIDN(false);
    }
  };

  const handlePrintIDNThermal = async (data: typeof showIDNReceiptModal, options?: { preferRawBT?: boolean }) => {
    if (!data) return;
    try {
      const lines: string[] = [
        `CENTER|BOLD|${receiptConfig.businessName || 'MARÉ'}`,
        "CENTER|VALE DE LIQUIDACION IDN",
        `VENDEDOR: ${(data.workerName || 'VENDEDOR').toUpperCase()}`,
        `ALMACEN: ${(data.branchName || 'ALMACEN').toUpperCase()}`,
        `FECHA: ${new Date(data.date).toLocaleString()}`,
        "---",
        "BOLD|DETALLE DE VENTAS (CUP):",
      ];

      (data.details || []).forEach(d => {
        const label = `${d.qty}x ${(d.name || '').slice(0, 16)}`;
        const val = `${baseCurrency.symbol}${d.subtotal.toLocaleString()} CUP`;
        const spaceCount = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(spaceCount)}${val}`);
      });

      lines.push("---");
      lines.push(`BOLD|TOTAL LIQUIDAR: ${baseCurrency.symbol}${data.totalToPay.toLocaleString()} CUP`);
      lines.push("---");
      lines.push("CENTER|CUADRE REALIZADO CON EXITO");

      const { printThermalReceipt } = await import('../lib/escpos');
      await printThermalReceipt({ lines, width: '58mm', preferRawBT: options?.preferRawBT });
      setPosSuccess("Enviado a imprimir vale térmico...");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (printErr) {
      console.warn("Thermal print error:", printErr);
      setPosError("No se pudo imprimir el ticket.");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const [deductFromSalary, setDeductFromSalary] = useState(false);

  const [showCancelShiftModal, setShowCancelShiftModal] = useState(false);
  const [cancelShiftPassword, setCancelShiftPassword] = useState("");

  const handleCancelShift = () => {
    if (!currentSession) return;
    
    // Find worker to check password
    const worker = users.find(u => u.id === currentSession.userId || (u.name && currentSession.workerName && u.name.toLowerCase() === currentSession.workerName.toLowerCase()));
    
    const isPasswordValid = 
      (worker?.password && cancelShiftPassword === worker.password) ||
      (currentUser?.password && cancelShiftPassword === currentUser.password) ||
      users.some(u => u.role === 'admin' && u.password === cancelShiftPassword);

    if (isPasswordValid) {
      void useStore.getState().cancelSession(currentSession.id).then((ok) => {
        if (ok) {
          setShowCancelShiftModal(false);
          setCancelShiftPassword("");
          setPosSuccess("Turno cancelado y guardado. Las ventas quedaron anuladas y el inventario fue revertido.");
          setTimeout(() => setPosSuccess(""), 3500);
        } else {
          setPosError("No se pudo cancelar el turno. No se realizó ninguna confirmación.");
          setTimeout(() => setPosError(""), 3500);
        }
      });
    } else {
      setPosError("Contraseña incorrecta. Por favor ingresa la contraseña asignada al trabajador.");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const handleFinishIDNAndGoHome = () => {
    if (currentSession) {
      const closingBalances: Payment[] = [
        { currencyCode: baseCurrency.code, amount: showIDNReceiptModal?.totalToPay || 0, method: 'cash', exchangeRate: 1 }
      ];
      closeSession(currentSession.id, closingBalances, activeIDNWorker?.name || currentSession.workerName);
      setLastClosedSession({
        ...currentSession,
        closedAt: new Date().toISOString(),
        closingDate: new Date().toISOString(),
        status: 'closed',
        closingBalances
      });
    }
    setShowIDNReceiptModal(null);
    setIdnPhysicalCounts({});
    setShowConfirmIDNModal(false);
    setPosViewMode('standard');
    setSessionWorkerName("");
    setSessionPassword("");
    setPosSuccess("Liquidación completada. Sesión cerrada.");
    setTimeout(() => setPosSuccess(""), 3000);
  };

  const handleCancelAndReturnToEmployeeSelector = () => {
    setIdnPhysicalCounts({});
    clearCart();
    setIdnFilter("");
    setDebouncedIdnFilter("");
    setIdnSelectedProductFilter("all");
    setShowConfirmIDNModal(false);
    setShowIDNReceiptModal(null);
    setShowCheckoutModal(false);
    setShowMobileCart(false);
    setPosViewMode('standard');
    setSessionWorkerName("");
    setSessionPassword("");
    setSelectedAdminIDNUserId("");
    setJoiningSessionId(null);
    setJoiningSessionPassword("");
    setPosError("");
    setPosSuccess("Punto de venta cancelado. No se contó ni descontó inventario. Regresando al selector de empleado.");
    setTimeout(() => setPosSuccess(""), 3000);
  };

  const handleSaveIDNSettlementPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIDNWorker?.id || !idnPriceFormProduct) {
      setPosError("Seleccione un producto");
      return;
    }
    const val = parseFloat(idnPriceFormAmount);
    if (isNaN(val) || val < 0) {
      setPosError("Ingrese un precio válido");
      return;
    }

    const existing = (idnSettlementPrices || []).find(
      p => p.userId === activeIDNWorker.id && p.productId === idnPriceFormProduct
    );

    if (existing) {
      updateIDNSettlementPrice(existing.id, { settlementPrice: val });
    } else {
      addIDNSettlementPrice({
        id: generateId('SP'),
        userId: activeIDNWorker.id,
        productId: idnPriceFormProduct,
        settlementPrice: val
      });
    }

    setShowSetSettlementPriceModal(false);
    setPosSuccess("Precio de liquidación actualizado.");
    setTimeout(() => setPosSuccess(""), 3000);
  };

  const baseCurrency = getBaseCurrency();
  const expectedBalances = React.useMemo(() => {
    if (!currentSession) return [];
    
    // Start with opening balance as cash in base currency
    const expected: Payment[] = [
      { currencyCode: baseCurrency.code as any, amount: currentSession.openingBalance, exchangeRate: 1, method: 'cash' }
    ];

    // Add all transaction payments from this session
    const sessionTxs = activeTransactions.filter(t => 
      t.branchId === currentBranchId && 
      t.sessionId === currentSession.id
    );

    sessionTxs.forEach(tx => {
      (tx.payments || []).forEach(p => {
        const existing = expected.find(e => e.currencyCode === p.currencyCode && e.method === p.method);
        if (existing) {
          existing.amount += p.amount;
        } else {
          expected.push({ ...p });
        }
      });
      
      // Subtract change given in each currency
      if (tx.changePayments && tx.changePayments.length > 0) {
        tx.changePayments.forEach(cp => {
          const existing = expected.find(e => e.currencyCode === cp.currencyCode && e.method === cp.method);
          if (existing) {
            existing.amount -= cp.amount;
          } else {
            expected.push({ ...cp, amount: -cp.amount });
          }
        });
      } else if (tx.changeGiven && tx.changeGiven > 0) {
        // Fallback for activeTransactions with only changeGiven in base currency
        const existing = expected.find(e => e.currencyCode === baseCurrency.code && e.method === 'cash');
        if (existing) {
          existing.amount -= tx.changeGiven;
        } else {
          expected.push({ 
            currencyCode: baseCurrency.code as any, 
            amount: -tx.changeGiven, 
            exchangeRate: 1, 
            method: 'cash' 
          });
        }
      }
    });

    // Add cash movements
    if (currentSession?.movements) {
      currentSession.movements.forEach(m => {
        const existing = expected.find(e => e.currencyCode === m.currencyCode && e.method === 'cash');
        if (existing) {
          existing.amount += (m.type === 'income' ? m.amount : -m.amount);
        } else {
          expected.push({ 
            currencyCode: m.currencyCode as any, 
            amount: m.type === 'income' ? m.amount : -m.amount,
            exchangeRate: currencies.find(c => c.code === m.currencyCode)?.rateToBase || 1,
            method: 'cash'
          });
        }
      });
    }

    return expected.filter(e => e.amount !== 0);
  }, [currentSession, activeTransactions, currentBranchId, baseCurrency, currencies]);

  const handleReturnItem = async () => {
    if (!returnConfirm) return;
    const { tx, item } = returnConfirm;

    try {
      const returnId = generateId();
      const prodId = typeof (item.product as any) === 'object' ? (item.product?.id || '') : (item.product || '');
      const returnData = {
        id: returnId,
        transactionId: tx.id,
        productId: prodId,
        quantity: item.quantity,
        reason: 'Devolución de cliente',
        date: new Date().toISOString(),
        status: 'pending' as const,
        type: 'refund' as const,
        notes: `Devolución desde historial de ventas. Ticket: ${tx.id}`
      };

      createReturn(returnData);
      processReturn(returnId, 'complete');
      
      setPosSuccess("Producto devuelto y stock actualizado correctamente");
      setReturnConfirm(null);
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err) {
      console.error("Error processing return:", err);
      setPosError("Error al procesar la devolución");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSession) {
      const finalBalances: Payment[] = Object.entries(closingBalances)
        .filter(([_, amount]) => (amount as number) > 0)
        .map(([key, amount]) => {
          const [code, method] = key.split('-');
          const currency = currencies.find(c => c.code === code)!;
          return {
            currencyCode: code as any,
            amount: amount as number,
            exchangeRate: currency.rateToBase,
            method: method as any
          };
        });

      let hasDiscrepancy = false;
      expectedBalances.forEach(eb => {
        const actual = finalBalances.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        if (Math.abs(actual - eb.amount) > 0.01) {
          hasDiscrepancy = true;
        }
      });
      finalBalances.forEach(fb => {
        const exp = expectedBalances.find(eb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        if (Math.abs(fb.amount - exp) > 0.01) {
          hasDiscrepancy = true;
        }
      });

      if (hasDiscrepancy) {
        setFinalBalancesToClose(finalBalances);
        setShowDiscrepancyModal(true);
      } else {
        processClose(finalBalances);
        setPosSuccess("Caja cerrada exitosamente.");
        setTimeout(() => setPosSuccess(""), 3000);
      }
    }
  };

  const processClose = (balances: Payment[], discrepancyDeduction?: number, sessionMeta?: Partial<CashRegisterSession>) => {
    if (!currentSession) return;
    let finalClosingDate = new Date().toISOString();
    if (sessionClosingDate) {
      const parts = sessionClosingDate.split('-');
      if (parts.length === 3) {
        const d = new Date();
        d.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        finalClosingDate = d.toISOString();
      }
    }
    const sessionToClose: CashRegisterSession = { 
      ...currentSession, 
      status: 'closed' as const, 
      closedAt: finalClosingDate, 
      closingBalances: balances, 
      workerName: sessionWorkerName || currentSession.workerName,
      closingDate: finalClosingDate,
      ...(sessionMeta || {})
    };
    closeSession(currentSession.id, balances, sessionWorkerName || currentSession.workerName, finalClosingDate, discrepancyDeduction, sessionMeta);
    setLastClosedSession(sessionToClose);
    setClosingBalances({});
    setSessionWorkerName("");
    setSessionClosingDate(new Date().toISOString().split('T')[0]);
    setShowCashManagementModal(false);
    setShowSalarySummary(true);
    setShowOpenShiftModal(false);
  };

  const confirmClose = () => {
    if (currentSession) {
      let totalDeduction = 0;
      if (deductFromSalary) {
        expectedBalances.forEach(eb => {
          const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
          const diff = actual - eb.amount;
          if (diff < 0) {
            // Convert to base currency
            const currency = currencies.find(c => c.code === eb.currencyCode);
            totalDeduction += Math.abs(diff) * (currency?.rateToBase || 1);
          }
        });
      }

      // Build discrepancy details
      const discrepancyDetails: {
        currencyCode: string;
        method: 'cash' | 'transfer';
        expected: number;
        actual: number;
        difference: number;
      }[] = [];

      expectedBalances.forEach(eb => {
        const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        const diff = actual - eb.amount;
        if (Math.abs(diff) > 0.01) {
          discrepancyDetails.push({
            currencyCode: eb.currencyCode,
            method: eb.method as any,
            expected: eb.amount,
            actual,
            difference: diff
          });
        }
      });

      finalBalancesToClose.forEach(fb => {
        if (!expectedBalances.some(eb => eb.currencyCode === fb.currencyCode && eb.method === fb.method)) {
          discrepancyDetails.push({
            currencyCode: fb.currencyCode,
            method: fb.method as any,
            expected: 0,
            actual: fb.amount,
            difference: fb.amount
          });
        }
      });

      const matchingProductsAnalysis = discrepancyDetails.map(dd => {
        const matchedProducts = products
          .filter(p => Math.abs(p.price - Math.abs(dd.difference)) < 1)
          .slice(0, 3)
          .map(p => ({ id: p.id, name: p.name, price: p.price }));
        return {
          currencyCode: dd.currencyCode,
          difference: dd.difference,
          matchedProducts
        };
      }).filter(m => m.matchedProducts.length > 0);

      const sessionMeta: Partial<CashRegisterSession> = {
        isForcedClose: true,
        hasDiscrepancy: discrepancyDetails.length > 0,
        discrepancyDetails,
        discrepancyDeductionApplied: totalDeduction,
        deductedFromSalary: deductFromSalary,
        matchingProductsAnalysis,
        auditStatus: 'pending_review',
        notes: `Cierre forzado con descuadre. Deducción salarial: ${totalDeduction > 0 ? `${totalDeduction} CUP` : 'No aplicada'}.`
      };

      processClose(finalBalancesToClose, totalDeduction, sessionMeta);
      setShowDiscrepancyModal(false);
      setDeductFromSalary(false);
      setFinalBalancesToClose([]);
      setPosSuccess("Caja cerrada. Se registraron los datos para la auditoría de descuadres en Reportes.");
      setTimeout(() => setPosSuccess(""), 3500);
    }
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    const amt = parseFloat(movementData.amount);
    if (isNaN(amt) || amt <= 0) return;

    addCashMovement(currentSession.id, {
      id: crypto.randomUUID(),
      sessionId: currentSession.id,
      branchId: currentSession.branchId || currentBranchId,
      workerName: currentSession.workerName || sessionWorkerName || currentUser?.name || 'Vendedor',
      type: movementData.type,
      amount: amt,
      currencyCode: movementData.currencyCode,
      description: movementData.description,
      date: new Date().toISOString()
    });

    addNotification(`Movimiento de ${movementData.type === 'income' ? 'entrada' : 'salida'} registrado: ${formatMoney(amt, movementData.currencyCode)}`, 'success');
    setMovementData({ type: 'expense', amount: '', currencyCode: 'CUP', description: '' });
  };

  // Barcode scanner moved lower

  const subtotalBase = cart.reduce((sum, item) => {
    const price = typeof (item.product as any) === 'object' && item.product !== null ? (item.product.price ?? item.price ?? 0) : (item.price ?? 0);
    return sum + (price * item.quantity);
  }, 0);
  const taxBase = 0; // Configurable tax if needed
  const rawTotalBase = subtotalBase + taxBase;
  const isCupBase = baseCurrency.code === 'CUP' || baseCurrency.code === 'MN';
  const totalBase = isCupBase ? Math.round(rawTotalBase) : Math.round(rawTotalBase * 100) / 100;

  // Calcula cuánto se ha pagado en moneda base
  const totalPaidBase = paymentLines.reduce((sum, line) => {
    const currency = currencies.find(c => c.code === line.code);
    if (!currency || !line.amount) return sum;
    return sum + (line.amount * currency.rateToBase);
  }, 0);

  const balanceBase = totalBase - totalPaidBase;
  const remainingBase = isCupBase ? Math.round(Math.max(0, balanceBase)) : Math.max(0, Math.round(balanceBase * 100) / 100);
  const changeBase = isCupBase ? Math.round(Math.abs(Math.min(0, balanceBase))) : Math.abs(Math.min(0, Math.round(balanceBase * 100) / 100));
  const isPaid = remainingBase <= 0 && totalBase > 0;

  const generateSerial = () => {
    const randomSN = `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    setConfigData({ ...configData, serialNumber: randomSN });
  };

  const getProductStock = (productId: string, variantLabel?: string) => {
    return (inventory || []).reduce((total, item) => {
      const stockBranchId = currentSession?.branchId || currentBranchId;
      if (item.branchId !== stockBranchId || item.productId !== productId) return total;
      if (variantLabel) return item.variantLabel === variantLabel ? total + item.quantity : total;
      return total + item.quantity;
    }, 0);
  };

  const getCartQuantity = (productId: string, variantLabel?: string) => {
    return cart
      .filter(item => {
        const pId = typeof (item.product as any) === 'object' && item.product !== null ? item.product.id : item.product;
        return pId === productId && (item.variantLabel || '') === (variantLabel || '');
      })
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  useBarcodeScanner((barcode) => {
    const normCode = normalizeSemanticText(barcode);
    const scannedProduct = (products || []).find(p => {
      if (!p) return false;
      return (
        p.id === barcode ||
        normalizeSemanticText(p.sku) === normCode ||
        normalizeSemanticText(p.barcode) === normCode ||
        p.sku === barcode ||
        p.barcode === barcode
      );
    });

    if (scannedProduct) {
       const totalAvailable = getProductStock(scannedProduct.id);
       if (totalAvailable > 0) {
          const needsConfig = scannedProduct.hasSerial || (scannedProduct.availableSizes?.length) || (scannedProduct.availableColors?.length);
          if (needsConfig) {
             setSelectedProduct(scannedProduct);
             setShowConfigModal(true);
          } else {
             addToCart(scannedProduct);
             setPosSuccess(`¡Producto "${scannedProduct.name}" detectado y agregado al carrito!`);
             setTimeout(() => setPosSuccess(""), 2000);
          }
       } else {
          setPosError(`El producto "${scannedProduct.name}" no tiene existencias suficientes en este almacén.`);
          setTimeout(() => setPosError(""), 3000);
       }
    } else {
      setPosError(`No se encontró ningún producto con el código "${barcode}".`);
      setTimeout(() => setPosError(""), 2500);
    }
  });

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let cancelled = false;

    if (showCameraScanner) {
      void import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
        if (cancelled) return;

        scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render((decodedText) => {
        // On successful scan
        const scannedProduct = products.find(p => p.sku === decodedText || p.id === decodedText || p.barcode === decodedText);
        if (scannedProduct) {
          const totalAvailable = getProductStock(scannedProduct.id);
          if (totalAvailable > 0) {
            const needsConfig = scannedProduct.hasSerial || (scannedProduct.availableSizes?.length) || (scannedProduct.availableColors?.length);
            if (needsConfig) {
              setSelectedProduct(scannedProduct);
              setShowConfigModal(true);
            } else {
              addToCart(scannedProduct);
              setPosSuccess("Producto escaneado");
              setTimeout(() => setPosSuccess(""), 1500);
            }
          } else {
            setPosError("Sin existencias");
            setTimeout(() => setPosError(""), 1500);
          }
        } else {
          // Check if it's an order payload from the customer shop
          if (decodedText.startsWith("APP_ORDER:")) {
            try {
              const payloadStr = decodedText.replace("APP_ORDER:", "");
              const payload = JSON.parse(payloadStr);
              if (payload && payload.i && Array.isArray(payload.i)) {
                clearCart();
                payload.i.forEach((item: any) => {
                  const p = products.find(prod => prod.id === item.id);
                  if (p) {
                    for(let i=0; i<item.q; i++) {
                      addToCart(p);
                    }
                  }
                });
                setPosSuccess("Carrito de cliente cargado exitosamente.");
                setTimeout(() => setPosSuccess(""), 3000);
              }
            } catch(e) {
              setPosError("Código de orden inválido");
              setTimeout(() => setPosError(""), 1500);
            }
          } else {
            // Check if it's a legacy pending order (by ID)
            const order = pendingOrders.find(o => o.id === decodedText && o.status === 'pending');
            if (order) {
              clearCart();
              order.items.forEach(item => {
                const prodObj = typeof (item.product as any) === 'object' && item.product !== null ? item.product : products.find(p => p.id === (item.product as any));
                if (prodObj) {
                  for(let i=0; i<item.quantity; i++){
                    addToCart(prodObj, item.serialNumber);
                  }
                }
              });
              removePendingOrder(order.id);
              setPosSuccess("Orden cargada exitosamente.");
              setTimeout(() => setPosSuccess(""), 3000);
            } else {
              setPosError("Código no reconocido");
              setTimeout(() => setPosError(""), 1500);
            }
          }
        }
          setShowCameraScanner(false);
        }, (error) => {
          // Handle scan errors silently
        });
      });
    }

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [showCameraScanner, products, inventory, currentBranchId]);

  const handleProductClick = useCallback((product: Product) => {
    setPosError("");
    setSelectedProduct(product);
    const autoSN = product.hasSerial ? `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}` : "";
    setConfigData({
      selectedSize: product.availableSizes?.[0],
      selectedColor: product.availableColors?.[0],
      serialNumber: autoSN
    });
    setShowConfigModal(true);
  }, []);

  const handleCatalogOutOfStock = useCallback(() => {
    setPosError("Sin existencias en esta sucursal.");
    setTimeout(() => setPosError(""), 3000);
  }, []);

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPosError("");
    if (selectedProduct) {
      const variantLabel = configData.selectedSize || configData.selectedColor;
      if (getCartQuantity(selectedProduct.id, variantLabel) >= getProductStock(selectedProduct.id, variantLabel)) {
        setPosError(`No hay suficiente stock para la variante ${variantLabel || 'seleccionada'}.`);
        setTimeout(() => setPosError(""), 3000);
        return;
      }
      addToCart({
        ...selectedProduct,
      }, configData.serialNumber, { size: configData.selectedSize, color: configData.selectedColor, variantLabel });
      
      setShowConfigModal(false);
      setSelectedProduct(null);
      setConfigData({});
    }
  };

  const formatMoney = (amount: number, symbol: string) => {
    // Determine decimals: CUP/MN/CUC should be integer
    const isCup = symbol === 'CUP' || symbol === 'MN' || symbol === 'CUC' || symbol === '₱';
    const decimals = isCup ? 0 : 2;
    const formatted = amount.toLocaleString('es-CU', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
    return `${symbol} ${formatted}`;
  };

  const addPaymentLine = () => {
    const newId = crypto.randomUUID();
    const curr = currencies.find(c => c.code === baseCurrency.code);
    let fillAmount = 0;
    if (remainingBase > 0) {
      const rawAmount = remainingBase / (curr?.rateToBase || 1);
      fillAmount = curr?.code === 'CUP' ? Math.round(rawAmount) : Math.round(rawAmount * 100) / 100;
    }
    const defaultBank = bankCards.find(c => c.currency === baseCurrency.code) || bankCards[0];
    setPaymentLines(prev => [...prev, { id: newId, code: baseCurrency.code, amount: fillAmount, method: 'cash', bankCardId: defaultBank?.id }]);
    setActivePaymentLineId(newId);
  };

  const updatePaymentLine = (id: string, field: keyof PaymentLine, value: any) => {
    const isCupSymbol = (s: string) => s === 'CUP' || s === 'MN' || s === 'CUC' || s === '₱';

    setPaymentLines(prev => {
      let nextLines = prev.map(p => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };

        // Handle currency conversion when code changes
        if (field === 'code' && value !== p.code) {
          const oldCurrency = currencies.find(c => c.code === p.code);
          const newCurrency = currencies.find(c => c.code === value);
          if (oldCurrency && newCurrency) {
            const amountInBase = p.amount * oldCurrency.rateToBase;
            const convertedAmount = amountInBase / newCurrency.rateToBase;
            // If new currency is CUP-like, round to integer, otherwise keep 2 decimals
            updated.amount = isCupSymbol(value) ? Math.round(convertedAmount) : Math.round(convertedAmount * 100) / 100;
          }
        }

        // If amount is directly edited and it's CUP, round to integer
        if (field === 'amount' && isCupSymbol(updated.code)) {
          updated.amount = Math.round(updated.amount);
        }

        if (field === 'method' && value === 'transfer') {
          // If transfer is selected, force CUP if not already
          if (updated.code !== 'CUP') {
            const oldCurrency = currencies.find(c => c.code === updated.code);
            const cupCurrency = currencies.find(c => c.code === 'CUP');
            if (oldCurrency && cupCurrency) {
              const amountInBase = updated.amount * oldCurrency.rateToBase;
              updated.amount = Math.round(amountInBase / cupCurrency.rateToBase);
            }
            updated.code = 'CUP';
          }
          
          if (!updated.bankCardId) {
            const matchingCard = bankCards.find(c => c.currency === updated.code) || bankCards[0];
            if (matchingCard) {
              updated.bankCardId = matchingCard.id;
            }
          }
        }

        // Ensure that if it's CUP, it's ALWAYS an integer regardless of the field being changed
        if (isCupSymbol(updated.code)) {
          updated.amount = Math.round(updated.amount);
        }

        if (field === 'code' && updated.method === 'transfer') {
          const matchingCard = bankCards.find(c => c.currency === value) || bankCards[0];
          if (matchingCard) {
            updated.bankCardId = matchingCard.id;
          }
        }
        return updated;
      });
      return nextLines;
    });
  };

  const removePaymentLine = (id: string) => {
    setPaymentLines(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activePaymentLineId === id && filtered.length > 0) {
        setActivePaymentLineId(filtered[0].id);
      }
      return filtered;
    });
  };

  const autoFillRemaining = (id: string) => {
    const line = paymentLines.find(p => p.id === id);
    if (!line) return;
    const currency = currencies.find(c => c.code === line.code);
    if (!currency) return;
    
    // We want to fill this line with what is missing in base currency
    const amountNeededInCurrency = remainingBase / currency.rateToBase;
    const finalAmount = line.amount + amountNeededInCurrency;
    
    // If it's CUP or MN, round to integer
    const roundedAmount = (line.code === 'CUP' || line.code === 'MN') ? Math.round(finalAmount) : Math.round(finalAmount * 100) / 100;
    
    updatePaymentLine(id, 'amount', roundedAmount);
  };

  const splitUsdPayment = (id: string) => {
    const line = paymentLines.find(p => p.id === id);
    if (!line || line.code !== 'USD') return;
    
    const usdCurrency = currencies.find(c => c.code === 'USD');
    const cupCurrency = currencies.find(c => c.code === 'CUP');
    if (!usdCurrency || !cupCurrency) return;

    // Take the integer part of the CURRENT amount in this line
    const integerPart = Math.floor(line.amount);
    
    // Calculate base currency covered by OTHER lines
    const coveredByOthers = paymentLines.reduce((sum, p) => {
      if (p.id === id) return sum;
      const curr = currencies.find(c => c.code === p.code);
      return sum + (p.amount * (curr?.rateToBase || 0));
    }, 0);

    // Calculate base currency covered by the integer USD part
    const coveredByUsdInteger = integerPart * usdCurrency.rateToBase;
    
    // The exact remainder needed in base currency to reach totalBase
    const remainderBase = totalBase - (coveredByOthers + coveredByUsdInteger);
    
    // Convert to CUP and round to integer
    const remainderCup = Math.max(0, Math.round(remainderBase / cupCurrency.rateToBase));

    // 1. Update current line to integer USD
    updatePaymentLine(id, 'amount', integerPart);

    // 2. Add or Update CUP line
    // Search for any existing CUP cash line that is NOT the current line
    const existingCupLine = paymentLines.find(p => (p.code === 'CUP' || p.code === 'MN') && p.method === 'cash' && p.id !== id);
    
    if (existingCupLine) {
      updatePaymentLine(existingCupLine.id, 'amount', existingCupLine.amount + remainderCup);
      setActivePaymentLineId(existingCupLine.id);
    } else if (remainderCup > 0) {
      const newId = crypto.randomUUID();
      const defaultCupBank = bankCards.find(c => c.currency === 'CUP') || bankCards[0];
      setPaymentLines(prev => [...prev, { 
        id: newId, 
        code: 'CUP', 
        amount: remainderCup, 
        method: 'cash', 
        bankCardId: defaultCupBank?.id 
      }]);
      setActivePaymentLineId(newId);
    }
  };

  const openCheckout = () => {
    if (!currentSession) {
      setPosError("No hay un turno de caja abierto en esta sucursal. Por favor, abre un turno para comenzar a cobrar.");
      setShowOpenShiftModal(true);
      return;
    }
    const newId = crypto.randomUUID();
    const defaultBank = bankCards.find(c => c.currency === baseCurrency.code) || bankCards[0];
    setPaymentLines([
      {
        id: newId,
        code: baseCurrency.code,
        amount: totalBase,
        method: 'cash',
        bankCardId: defaultBank?.id
      }
    ]);
    setActivePaymentLineId(newId);
    setShowCheckoutModal(true);
  };

  const handlePairBluetooth = async () => {
    setIsConnectingPrinter(true);
    setPrinterStatusMsg("Buscando impresora Bluetooth...");
    try {
      const { connectBluetoothPrinter } = await import('../lib/escpos');
      const device = await connectBluetoothPrinter();
      setConnectedPrinterName(device.name || "Impresora Bluetooth 58mm");
      setPosSuccess(`Impresora "${device.name || 'Bluetooth'}" conectada`);
      setPrinterStatusMsg(`Conectado a ${device.name || 'Bluetooth'}`);
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.warn("Bluetooth connection error:", err);
      setPosError(err.message || "No se pudo conectar la impresora Bluetooth");
      setPrinterStatusMsg(err.message || "Error al conectar");
      setTimeout(() => setPosError(""), 4000);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsConnectingPrinter(true);
    setPrinterStatusMsg("Buscando impresora USB...");
    try {
      const { connectPrinter } = await import('../lib/escpos');
      await connectPrinter();
      setConnectedPrinterName("Impresora USB (Serie)");
      setPosSuccess("Impresora USB conectada correctamente");
      setPrinterStatusMsg("Impresora USB conectada");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.warn("USB connection error:", err);
      setPosError(err.message || "No se pudo conectar la impresora USB");
      setPrinterStatusMsg(err.message || "Error al conectar");
      setTimeout(() => setPosError(""), 4000);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const getTransactionReceiptLines = (tx: import("../types").Transaction): string[] => {
    const receiptConfig = useStore.getState().receiptConfig;
    const lines: string[] = [];
    
    lines.push(`CENTER|BOLD|${receiptConfig.businessName || 'MARÉ POS'}`);
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    
    lines.push("---");
    lines.push(`Ticket ID: ${tx.id}`);
    lines.push(`Fecha: ${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    const sellerDisplay = tx.cashierName || (currentSession?.workerName) || users.find(u => u.id === tx.userId)?.name || 'Vendedor';
    lines.push(`Vendedor: ${sellerDisplay.toUpperCase()}`);
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    lines.push(`Cliente: ${(customer?.name || 'Consumidor Final').slice(0, 22)}`);
    lines.push("---");
    
    tx.items.forEach(item => {
      const prodName = typeof (item.product as any) === 'object' ? ((item.product as any)?.name || 'Producto') : (products.find(p => p.id === (item.product as any))?.name || (item.product as any) || 'Producto');
      const prodPrice = typeof (item.product as any) === 'object' ? ((item.product as any)?.price || 0) : (products.find(p => p.id === (item.product as any))?.price || item.price || 0);
      const prodWarranty = typeof (item.product as any) === 'object' ? ((item.product as any)?.warrantyDays || 0) : (products.find(p => p.id === (item.product as any))?.warrantyDays || 0);
      const itemName = `${item.quantity}x ${prodName}`;
      const itemPrice = formatMoney(prodPrice * item.quantity, baseCurrency.symbol);
      const dots = Math.max(1, 32 - itemName.length - itemPrice.length);
      lines.push(`${itemName}${" ".repeat(dots)}${itemPrice}`);
      if (item.serialNumber) {
        lines.push(`  S/N: ${item.serialNumber}`);
      }
      if (item.warrantyCode) {
        lines.push(`  Gda: ${item.warrantyCode} (${prodWarranty}d)`);
      }
    });
    
    lines.push("---");
    const totLabel = "TOTAL:";
    const totVal = formatMoney(tx.total, baseCurrency.symbol);
    const totDots = Math.max(1, 32 - totLabel.length - totVal.length);
    lines.push(`BOLD|${totLabel}${" ".repeat(totDots)}${totVal}`);
    lines.push("---");
    
    lines.push("BOLD|Pagos recibidos:");
    (tx.payments || []).forEach(p => {
      const symbol = currencies.find(c => c.code === p.currencyCode)?.symbol || '';
      const method = p.method === 'cash' ? 'Efectivo' : 'Transf';
      const label = `  ${method} (${p.currencyCode}):`;
      const val = formatMoney(p.amount, symbol);
      const sp = Math.max(1, 32 - label.length - val.length);
      lines.push(`${label}${" ".repeat(sp)}${val}`);
    });
    
    if (tx.changePayments && tx.changePayments.length > 0) {
      lines.push("BOLD|Vuelto entregado:");
      tx.changePayments.forEach(cp => {
        const symbol = currencies.find(c => c.code === cp.currencyCode)?.symbol || '';
        const label = `  Efectivo (${cp.currencyCode}):`;
        const val = formatMoney(cp.amount, symbol);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    } else if (tx.changeGiven && tx.changeGiven > 0) {
      const label = "Vuelto:";
      const val = formatMoney(tx.changeGiven, baseCurrency.symbol);
      const sp = Math.max(1, 32 - label.length - val.length);
      lines.push(`${label}${" ".repeat(sp)}${val}`);
    }
    
    if (receiptConfig.showFooter && receiptConfig.footerText) {
      lines.push("---");
      lines.push(`CENTER|${receiptConfig.footerText}`);
    }

    return lines;
  };

  const getClosureReceiptLines = (session: CashRegisterSession): string[] => {
    const receiptConfig = useStore.getState().receiptConfig;
    const sessionTx = activeTransactions.filter(t => 
      t.sessionId === session.id && !t.deletedAt
    );

    const soldMap: { [name: string]: { name: string, qty: number, total: number } } = {};
    sessionTx.forEach(tx => {
      tx.items.forEach(item => {
        const name = typeof item.product === 'string' ? item.product : (item.product?.name || 'Producto');
        if (!soldMap[name]) soldMap[name] = { name, qty: 0, total: 0 };
        const price = typeof item.product === 'object' ? (item.product?.price || 0) : 0;
        soldMap[name].qty += item.quantity;
        soldMap[name].total += (price * item.quantity);
      });
    });
    const soldList = Object.values(soldMap);
    const totalSales = sessionTx.reduce((sum, tx) => sum + tx.total, 0);

    const commissions = sessionTx.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => {
        const prodId = typeof item.product === 'string' ? item.product : item.product.id;
        const prod = products.find(p => p.id === prodId);
        if (!prod) return s;
        const commValue = prod.commissionValue || 0;
        return s + (commValue * item.quantity);
      }, 0);
    }, 0);

    const employee = users.find(u => u.id === session.userId || u.name === session.workerName) || users.find(u => u.name?.toLowerCase() === session.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
    const isIndependent = employee?.isIndependent || false;

    // Calculate total cost for shop (what the independent seller owes the shop)
    const totalShopCost = sessionTx.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => {
        const prodId = typeof item.product === 'string' ? item.product : item.product.id;
        const prod = products.find(p => p.id === prodId);
        const cost = typeof item.product === 'object' ? (item.product?.costPrice || 0) : (prod?.costPrice || 0);
        return s + (cost * item.quantity);
      }, 0);
    }, 0);

    const baseSalary = isIndependent ? 0 : (employee?.baseSalary || 0);
    const totalSalary = isIndependent ? 0 : (baseSalary + commissions);
    const sellerProfit = isIndependent ? (totalSales - totalShopCost) : totalSalary;

    const lines: string[] = [];
    lines.push(`CENTER|BOLD|${receiptConfig.businessName || 'MARÉ POS'}`);
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    lines.push("---");
    lines.push("CENTER|BOLD|CIERRE DE CAJA / TURNO");
    lines.push(`TURNO: ${session.id}`);
    lines.push(`FECHA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleDateString()}`);
    lines.push(`HORA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`VENDEDOR: ${(session.workerName || 'VENDEDOR').toUpperCase()}${isIndependent ? ' (IND)' : ''}`);
    lines.push(`SUCURSAL: ${(branches.find(b => b.id === session.branchId)?.name || 'Central').slice(0, 18)}`);
    lines.push("---");
    lines.push("BOLD|PRODUCTOS VENDIDOS:");
    if (soldList.length === 0) {
      lines.push("Sin ventas registradas");
    } else {
      soldList.forEach(p => {
        const label = `${p.qty}x ${p.name.slice(0, 16)}`;
        const val = formatMoney(p.total, baseCurrency.symbol);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    }
    lines.push("---");
    const totSLabel = "TOTAL VENTAS:";
    const totSVal = formatMoney(totalSales, baseCurrency.symbol);
    lines.push(`BOLD|${totSLabel}${" ".repeat(Math.max(1, 32 - totSLabel.length - totSVal.length))}${totSVal}`);
    lines.push(`ITEMS TOTALES: ${soldList.reduce((s, i) => s + i.qty, 0)}`);
    lines.push("---");

    if (isIndependent) {
      lines.push("BOLD|LIQUIDACION INDEPENDIENTE:");
      const shopLabel = "Costo Fijo Tienda:";
      const shopVal = formatMoney(totalShopCost, baseCurrency.symbol);
      lines.push(`${shopLabel}${" ".repeat(Math.max(1, 32 - shopLabel.length - shopVal.length))}${shopVal}`);
      
      const profitLabel = "Ganancia Vendedor:";
      const profitVal = formatMoney(sellerProfit, baseCurrency.symbol);
      lines.push(`BOLD|${profitLabel}${" ".repeat(Math.max(1, 32 - profitLabel.length - profitVal.length))}${profitVal}`);
    } else {
      lines.push("BOLD|NOMINA / COMISIONES:");
      const salLabel = "Salario Base:";
      const salVal = formatMoney(baseSalary, baseCurrency.symbol);
      lines.push(`${salLabel}${" ".repeat(Math.max(1, 32 - salLabel.length - salVal.length))}${salVal}`);
      
      const comLabel = "Comisiones:";
      const comVal = formatMoney(commissions, baseCurrency.symbol);
      lines.push(`${comLabel}${" ".repeat(Math.max(1, 32 - comLabel.length - comVal.length))}${comVal}`);
      
      const netLabel = "Total a Pagar:";
      const netVal = formatMoney(totalSalary, baseCurrency.symbol);
      lines.push(`BOLD|${netLabel}${" ".repeat(Math.max(1, 32 - netLabel.length - netVal.length))}${netVal}`);
      
      const settlement = useStore.getState().salarySettlements.find(s => s.sessionId === session.id);
      if (settlement && settlement.discrepancyDeduction && settlement.discrepancyDeduction > 0) {
        const dedLabel = "(-) Descuento:";
        const dedVal = formatMoney(settlement.discrepancyDeduction, baseCurrency.symbol);
        lines.push(`${dedLabel}${" ".repeat(Math.max(1, 32 - dedLabel.length - dedVal.length))}${dedVal}`);
        
        const finalLabel = "NETO RECIBIR:";
        const finalVal = formatMoney(settlement.total, baseCurrency.symbol);
        lines.push(`BOLD|${finalLabel}${" ".repeat(Math.max(1, 32 - finalLabel.length - finalVal.length))}${finalVal}`);
      }
    }
    lines.push("---");
    lines.push("BOLD|COBROS POR METODO/MONEDA:");
    
    // Aggregate payments by currency and method
    const paymentTotals: { [key: string]: { code: string, method: string, amount: number } } = {};
    sessionTx.forEach(tx => {
      (tx.payments || []).forEach(p => {
        const key = `${p.currencyCode}-${p.method}`;
        if (!paymentTotals[key]) {
          paymentTotals[key] = { code: p.currencyCode, method: p.method, amount: 0 };
        }
        paymentTotals[key].amount += p.amount;
      });
    });

    const paymentKeys = Object.keys(paymentTotals);
    if (paymentKeys.length === 0) {
      lines.push("Sin cobros registrados");
    } else {
      paymentKeys.forEach(k => {
        const pt = paymentTotals[k];
        const methodLabel = pt.method === 'transfer' ? 'Transf' : 'Efec';
        const sym = currencies.find(c => c.code === pt.code)?.symbol || '';
        const label = `${methodLabel} (${pt.code}):`;
        const val = formatMoney(pt.amount, sym);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    }

    lines.push("---");
    lines.push("BOLD|ARQUEO DE FONDOS:");
    const fondoLabel = "Fondo Inicial:";
    const fondoVal = formatMoney(session.openingBalance, baseCurrency.symbol);
    lines.push(`${fondoLabel}${" ".repeat(Math.max(1, 32 - fondoLabel.length - fondoVal.length))}${fondoVal}`);
    lines.push("---");
    lines.push("BOLD|LIQUIDACION SALARIO:");
    const baseLabel = "Salario Base:";
    const baseVal = formatMoney(baseSalary, baseCurrency.symbol);
    lines.push(`${baseLabel}${" ".repeat(Math.max(1, 32 - baseLabel.length - baseVal.length))}${baseVal}`);
    const comLabel = "Comisiones:";
    const comVal = `+${formatMoney(commissions, baseCurrency.symbol)}`;
    lines.push(`${comLabel}${" ".repeat(Math.max(1, 32 - comLabel.length - comVal.length))}${comVal}`);
    const totSalLabel = "TOTAL SALARIO:";
    const totSalVal = formatMoney(totalSalary, baseCurrency.symbol);
    lines.push(`BOLD|${totSalLabel}${" ".repeat(Math.max(1, 32 - totSalLabel.length - totSalVal.length))}${totSalVal}`);
    lines.push("---");
    lines.push("CENTER|Firma: _________________");
    lines.push("CENTER|MARÉ SISTEMA POS");

    return lines;
  };

  const handleThermalPrint = async (tx: import("../types").Transaction, options?: { preferRawBT?: boolean; silent?: boolean }) => {
    try {
      const { printThermalReceipt, isPrinterConnected } = await import('../lib/escpos');
      const lines = getTransactionReceiptLines(tx);
      const isConnected = await isPrinterConnected();

      if (options?.preferRawBT) {
        await printThermalReceipt({
          lines,
          openDrawer: receiptConfig.openDrawer ?? true,
          width: '58mm',
          preferRawBT: true,
          onSuccess: () => {
            setPosSuccess("Enviado a impresora (RawBT)");
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
        return;
      }

      if (!isConnected) {
        // Direct attempt via printThermalReceipt (will use Bluetooth/Serial/RawBT)
        const printed = await printThermalReceipt({
          lines,
          openDrawer: receiptConfig.openDrawer ?? true,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Ticket enviado (${method === 'bluetooth' ? 'Bluetooth' : method === 'rawbt' ? 'RawBT' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          },
          onError: () => {
            if (!options?.silent) {
              setPosError("Sin conexión activa con impresora");
              setTimeout(() => setPosError(""), 3000);
            }
          }
        });
        if (!printed && !options?.silent) {
          setPosError("Sin conexión activa con impresora");
          setTimeout(() => setPosError(""), 3000);
        }
      } else {
        await printThermalReceipt({
          lines,
          openDrawer: receiptConfig.openDrawer ?? true,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Ticket impreso (${method === 'bluetooth' ? 'Bluetooth' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
      }
    } catch (err: any) {
      console.warn("Thermal print:", err);
      if (!options?.silent) {
        setPosError("No se pudo imprimir el ticket");
        setTimeout(() => setPosError(""), 3000);
      }
    }
  };

  const handlePrintClosureThermal = async (session: CashRegisterSession | null, options?: { preferRawBT?: boolean }) => {
    if (!session) return;
    try {
      const { printThermalReceipt, isPrinterConnected } = await import('../lib/escpos');
      const lines = getClosureReceiptLines(session);
      const isConnected = await isPrinterConnected();

      setLastClosedSession(session);

      if (options?.preferRawBT) {
        await printThermalReceipt({
          lines,
          openDrawer: false,
          width: '58mm',
          preferRawBT: true,
          onSuccess: () => {
            setPosSuccess("Cierre enviado a impresora (RawBT)");
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
        return;
      }

      if (!isConnected) {
        const printed = await printThermalReceipt({
          lines,
          openDrawer: false,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Comprobante impreso (${method === 'bluetooth' ? 'Bluetooth' : method === 'rawbt' ? 'RawBT' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          },
          onError: () => {
            setPosError("Sin conexión a impresora");
            setTimeout(() => setPosError(""), 3000);
          }
        });
        if (!printed) {
          setPosError("Sin impresora térmica conectada");
          setTimeout(() => setPosError(""), 3000);
        }
      } else {
        await printThermalReceipt({
          lines,
          openDrawer: false,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Comprobante impreso (${method === 'bluetooth' ? 'Bluetooth' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
      }
    } catch (err: any) {
      console.error('Error al imprimir comprobante:', err);
      setPosError("No se pudo imprimir el comprobante");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const handleWhatsAppReceipt = (tx: Transaction) => {
    let phone = "";
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (customer?.phone) {
      phone = String(customer.phone || '').replace(/\D/g,'');
    } else {
      const input = window.prompt("Ingrese el número de WhatsApp del cliente:");
      if (!input) return;
      phone = String(input || '').replace(/\D/g,'');
    }
    
    if (!phone) {
      addNotification("Número de teléfono inválido.", 'error');
      return;
    }
    
    const storeName = useStore.getState().storeConfig.storeName;
    let itemsText = (tx.items || []).map(i => {
      const pName = typeof (i.product as any) === 'object' ? ((i.product as any)?.name || 'Producto') : (products.find(p => p.id === (i.product as any))?.name || (i.product as any) || 'Producto');
      const pPrice = typeof (i.product as any) === 'object' ? ((i.product as any)?.price || 0) : (products.find(p => p.id === (i.product as any))?.price || i.price || 0);
      return `${i.quantity}x ${pName} - ${formatMoney(pPrice * i.quantity, baseCurrency.symbol)}`;
    }).join('%0A');
    const text = `Hola, gracias por tu compra en *${storeName}*.%0A%0A*Detalle del recibo ${tx.id}:*%0A${itemsText}%0A%0A*Total:* ${formatMoney(tx.total, baseCurrency.symbol)}%0A%0A¡Vuelve pronto!`;
    const url = `https://wa.me/${phone}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleEmailReceipt = (tx: Transaction) => {
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (!customer?.email) {
      addNotification("El cliente no tiene un correo registrado.", 'warning');
      return;
    }
    const storeName = useStore.getState().storeConfig.storeName;
    const subject = `Tu Recibo de Compra - ${storeName}`;
    const body = `Hola ${customer?.name || 'Cliente'},\n\nGracias por tu compra. Tu recibo es ${tx.id} por un total de ${formatMoney(tx.total, baseCurrency.symbol)}.\n\nSaludos,\n${storeName}`;
    const url = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleCheckout = async () => {
    // Final payments with rounded USD
    const finalizedPayments: import('../types').Payment[] = paymentLines
      .filter(p => p.amount > 0)
      .map(p => {
        const currency = currencies.find(c => c.code === p.code)!;
        let amount = p.amount;
        if (p.code === 'CUP') {
          amount = Math.round(amount);
        } else if (p.code === 'USD' && p.method === 'cash') {
          amount = Math.round(amount * 100) / 100;
        }
        return {
          currencyCode: p.code as any,
          amount: amount,
          exchangeRate: currency.rateToBase,
          method: p.method,
          bankCardId: p.bankCardId
        };
      });

    // Bloqueo estricto: Una venta NO puede crearse sin un turno abierto
    if (!currentSession) {
      setPosError("No existe un turno de caja activo para registrar esta venta. Por favor, abre un turno primero.");
      setShowOpenShiftModal(true);
      return;
    }

    const currentTransactions = useStore.getState().transactions.filter(t => !t.deletedAt);
    const txCount = currentTransactions.length;
    const maxTicketNum = currentTransactions.reduce((max, t) => {
      const match = t.id?.match(/TIKECT ID-MARE(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    let nextTicketNum = Math.max(txCount, maxTicketNum) + 1;
    let txId = `TIKECT ID-MARE${nextTicketNum.toString().padStart(2, '0')}`;
    if (currentTransactions.some(t => t.id === txId)) {
      const bObj = branches.find(b => b.id === effectiveBranchId);
      const bCode = bObj?.name?.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase() || 'TG';
      txId = `TIKECT ID-MARE${nextTicketNum.toString().padStart(2, '0')}-${bCode}`;
    }

    const activeSellerId = currentSession.userId || currentUser?.id || 'u1';
    const activeSellerName = currentSession.workerName || currentUser?.name || 'Vendedor';
    const sellerUser = (users || []).find(u => u.id === activeSellerId) || currentUser;
    const effectiveBranchId = currentSession.branchId || sellerUser?.assignedBranchId || currentBranchId || (branches[0]?.id || 'b1');

    const tx: import('../types').Transaction = {
      id: txId,
      branchId: effectiveBranchId,
      userId: activeSellerId,
      sellerEmployeeIds: currentSession.workingEmployeeIds?.length ? currentSession.workingEmployeeIds : [activeSellerId],
      cashierName: activeSellerName,
      date: new Date().toISOString(),
      subtotal: subtotalBase,
      tax: taxBase,
      total: totalBase,
      items: cart,
      payments: finalizedPayments,
      status: 'completed',
      customerId: currentCustomerId,
      changeGiven: changeBase,
      changePayments: [],
      sessionId: currentSession.id
    };

    // Generate NCF if customer is selected or if config requires it
    const nextNcf = useStore.getState().getNextNCF('B01'); // Default to Factura de Crédito Fiscal if needed, or B02
    if (nextNcf) {
      tx.ncf = nextNcf;
      tx.ncfType = 'B01';
    }

    const saleConfirmed = await processTransaction(tx);
    if (!saleConfirmed) {
      setPosError('La venta no fue confirmada. Verifique el stock, turno y conexión antes de continuar.');
      setTimeout(() => setPosError(''), 5000);
      return;
    }

    // Register bank activeTransactions only after the sale is confirmed.
    finalizedPayments.forEach(p => {
      if (p.method === 'transfer' && p.bankCardId) {
        const itemDetails = cart.map(item => `${item.quantity}x ${item.product?.name || 'Producto'}`).join(', ');
        addBankTransaction({
          id: generateId('BTX'),
          cardId: p.bankCardId,
          type: 'payment_received',
          amount: p.amount * p.exchangeRate,
          date: tx.date,
          reference: tx.id,
          description: `Venta ${tx.id}: ${itemDetails.substring(0, 100)}${itemDetails.length > 100 ? '...' : ''}`,
          transactionId: tx.id
        });
      }
    });

    // Close all checkout and mobile cart drawers cleanly
    setShowCheckoutModal(false);
    setShowMobileCart(false);
    clearCart();
    setPosSuccess(`Venta ${tx.id} registrada correctamente.`);
    setTimeout(() => setPosSuccess(""), 3000);

    // Show receipt modal so cashier gets receipt details & print option
    setShowReceiptModal(tx);

    if (useStore.getState().receiptConfig.autoPrint) {
      handleThermalPrint(tx, { silent: true }).catch(console.error);
    }
  };

  const [sessionClosingDate, setSessionClosingDate] = useState(new Date().toISOString().split('T')[0]);

  const handleOpenSession = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = parseFloat(openingAmount);
    const val = isNaN(rawVal) || rawVal < 0 ? 0 : rawVal;
    
    if (!sessionBranchId) {
      setPosError("Debes seleccionar una sucursal");
      setTimeout(() => setPosError(""), 3000);
      return;
    }

    const { users } = useStore.getState();
    const trimmedWorkerName = sessionWorkerName.trim();

    // An employee can only open a shift for their own account. The administrator
    // may explicitly select another worker/IDN from the POS.
    const workerToAssign = currentUser?.role === 'admin'
      ? (detectedWorker || (trimmedWorkerName ? users.find(u => (u.name || '').toLowerCase() === trimmedWorkerName.toLowerCase()) : currentUser))
      : currentUser;

    if (!workerToAssign) {
      setPosError("Debes seleccionar un vendedor para abrir la caja");
      setTimeout(() => setPosError(""), 3000);
      return;
    }

    if (currentUser?.role !== 'admin' && workerToAssign.id !== currentUser?.id) {
      setPosError("Un trabajador solo puede abrir su propio turno.");
      return;
    }

    const permittedBranchIds = new Set(allowedBranches.map(b => b.id));
    if (currentUser?.role !== 'admin' && (!sessionBranchId || !permittedBranchIds.has(sessionBranchId))) {
      setPosError("No tienes una sucursal autorizada para abrir el turno.");
      return;
    }

    // Verificar contraseña obligatoria del trabajador
    const requiredPassword = (workerToAssign.password || '').trim();
    const enteredPassword = (sessionPassword || '').trim();

    if (!requiredPassword) {
      setPosError(`El empleado ${workerToAssign?.name || 'empleado'} no tiene contraseña asignada. El administrador debe asignarle una en Configuración -> Usuarios.`);
      setTimeout(() => setPosError(""), 4000);
      return;
    }

    if (enteredPassword !== requiredPassword) {
      setPosError(`Contraseña incorrecta para ${workerToAssign?.name || 'empleado'}. Acceso denegado.`);
      setTimeout(() => setPosError(""), 4000);
      return;
    }

    const workerName = workerToAssign?.name || trimmedWorkerName || currentUser?.name || 'Vendedor';
    const workerId = workerToAssign?.id || currentUser?.id || 'emp-1';

    setCurrentBranch(sessionBranchId);
    openSession({
      id: crypto.randomUUID(),
      branchId: sessionBranchId,
      openedAt: new Date().toISOString(),
      openingBalance: val,
      status: "open",
      userId: workerId,
      workerName: workerName,
      workingEmployeeIds: [workerId, currentUser?.id].filter(Boolean) as string[]
    });
    setOpeningAmount("0");
    setSessionWorkerName("");
    setSessionPassword("");
    setPosSuccess(`Turno abierto correctamente por ${workerName}`);
    setTimeout(() => setPosSuccess(""), 3000);
  };

  const handleJoinExistingSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joiningSessionId) return;

    const targetSession = (activeCashSessions || []).find(s => s.id === joiningSessionId);
    if (!targetSession) {
      setPosError("No se encontró el turno seleccionado");
      return;
    }

    // Identify the user owning the session
    const targetUser = (users || []).find(u => u.id === targetSession.userId || (u.name || '').toLowerCase() === (targetSession.workerName || '').toLowerCase());
    if (!targetUser) {
      setPosError("No se pudo identificar al dueño del turno");
      return;
    }

    if (currentUser?.role !== 'admin' && targetUser.id !== currentUser?.id) {
      setPosError("No puedes unirte al turno de otro trabajador.");
      return;
    }

    if (currentUser?.role !== 'admin' && !allowedBranches.some(b => b.id === targetSession.branchId)) {
      setPosError("Este turno pertenece a una sucursal que no tienes autorizada.");
      return;
    }

    const requiredPassword = (targetUser.password || '').trim();
    const enteredPassword = (joiningSessionPassword || '').trim();

    if (!requiredPassword) {
      setPosError(`El empleado ${targetUser?.name || 'empleado'} no tiene contraseña asignada. El administrador debe asignarle una.`);
      return;
    }

    if (enteredPassword !== requiredPassword) {
      setPosError("Contraseña incorrecta. Acceso denegado.");
      return;
    }

    // Join the session
    joinOpenSession(targetSession.id, currentUser?.id || 'emp-tmp', targetSession.workerName);
    setCurrentBranch(targetSession.branchId);
    setJoiningSessionId(null);
    setJoiningSessionPassword("");
    setPosSuccess(`Te has unido al turno de ${targetSession.workerName || 'Vendedor'} correctamente`);
    setTimeout(() => setPosSuccess(""), 3000);
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const id = generateId('CST');
    addCustomer({ id, ...newCustomer });
    setCartCustomer(id);
    setShowAddCustomerModal(false);
    setNewCustomer({ name: '', phone: '', email: '', taxId: '' });
  };

  if (shouldShowIDNView && currentSession) {
    const branchId = activeIDNBranchId;
    const branchInventory = (inventory || []).filter(i => i.branchId === branchId);
    const filterLower = (debouncedIdnFilter || '').toLowerCase().trim();
    const filteredInventory = branchInventory
      .filter(inv => {
        const p = (products || []).find(prod => prod.id === inv.productId);
        return (p?.name || '').toLowerCase().includes(filterLower) || 
               (p?.sku || '').toLowerCase().includes(filterLower);
      })
      .slice(0, 100); // Limit to 100 products for performance

    let currentTotalToPay = 0;
    let currentTotalPublicSales = 0;
    let totalSoldUnits = 0;

    filteredInventory.forEach(inv => {
      const p = (products || []).find(prod => prod.id === inv.productId);
      const settlementPrice = (idnSettlementPrices || []).find(
        sp => sp.userId === activeIDNWorker?.id && sp.productId === inv.productId
      )?.settlementPrice || p?.costPrice || 0;

      const physicalCount = idnPhysicalCounts[inv.productId] ?? inv.quantity;
      const soldQty = Math.max(0, inv.quantity - physicalCount);
      currentTotalToPay += soldQty * settlementPrice;
      currentTotalPublicSales += soldQty * (p?.price || 0);
      totalSoldUnits += soldQty;
    });

    return (
      <div className="flex flex-col h-full bg-primary">
        {/* Header IDN */}
        <header className="bg-secondary text-primary p-3 sm:p-4 flex items-center justify-between shadow-lg flex-wrap gap-3 border-b border-base">
          <div 
            onClick={handleCancelAndReturnToEmployeeSelector}
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/80 p-1.5 -m-1.5 rounded-2xl transition-all border border-transparent hover:border-amber-500/30 group select-none"
            title="Hacer clic para cancelar punto de venta y volver al selector de empleado (sin contar ni descontar nada)"
          >
            <div className="bg-amber-500 p-2 rounded-xl text-white shadow-md shadow-amber-500/30 group-hover:bg-rose-600 transition-colors">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black uppercase tracking-tight">Liquidación de Inventario IDN</h1>
                <span className="text-[8px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded uppercase group-hover:bg-rose-600 group-hover:text-white transition-all">
                  ✕ Cancelar
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-300 uppercase">{activeIDNWorker?.name || 'Vendedor'}</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 px-2 py-0.5 rounded-lg">
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-[9px] font-black uppercase">
                    {branches.find(b => b.id === branchId)?.name || 'Sin Almacén Asignado'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cancel and return to Employee selector button */}
            <button
              type="button"
              onClick={handleCancelAndReturnToEmployeeSelector}
              className="px-2.5 sm:px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-[10px] sm:text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Cancelar punto de venta y volver al selector de empleado"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar / Salir</span>
            </button>

            {/* Admin worker selector */}
            {currentUser?.role === 'admin' && independentUsers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
                <span className="text-[8px] font-bold text-slate-400 uppercase hidden sm:inline">Vendedor:</span>
                <select
                  value={activeIDNWorker?.id || ''}
                  onChange={e => setSelectedAdminIDNUserId(e.target.value)}
                  className="bg-transparent text-amber-400 text-[10px] font-black uppercase outline-none cursor-pointer"
                >
                  {independentUsers.map(u => {
                    const bName = branches.find(br => br.id === u.assignedBranchId)?.name || 'Sin Almacén';
                    return (
                      <option key={u.id} value={u.id} className="bg-slate-800 text-white">
                        {u.name} ({bName})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Back to standard POS button for Admin */}
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setPosViewMode('standard')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">TPV Estándar</span>
              </button>
            )}

            <div className="hidden sm:flex flex-col items-end pl-2">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total a Liquidar (CUP)</span>
              <span className="text-base font-black text-amber-400">{baseCurrency.symbol}{currentTotalToPay.toLocaleString()} CUP</span>
            </div>
            
            <button 
              onClick={() => logout()}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-slate-300 hover:text-white"
              title="Cerrar Sesión"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col p-3 sm:p-4 space-y-3">
          {/* Alertas, Buscador y Selector Directo de Producto */}
          <div className="bg-secondary p-3 sm:p-4 rounded-2xl border border-base shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              {/* Selector directo de producto */}
              <div className="md:w-80">
                <select
                  value={idnSelectedProductFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIdnSelectedProductFilter(val);
                    if (val === 'all') {
                      setIdnFilter('');
                    } else {
                      const prod = products.find(p => p.id === val);
                      setIdnFilter(prod?.name || '');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800 uppercase"
                >
                  <option value="all">📦 Todos los productos ({branchInventory.length})</option>
                  {branchInventory.map(inv => {
                    const prod = (products || []).find(p => p.id === inv.productId);
                    if (!prod) return null;
                    return (
                      <option key={inv.id} value={prod.id}>
                        {prod.name || 'Producto'} ({prod.sku || ''}) • Stock: {inv.quantity}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Buscador libre por texto */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o SKU..."
                  value={idnFilter}
                  onChange={(e) => {
                    setIdnFilter(e.target.value);
                    if (idnSelectedProductFilter !== 'all') setIdnSelectedProductFilter('all');
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="md:hidden flex items-center justify-between px-2 pt-1 border-t border-slate-100">
                 <span className="text-[10px] font-black uppercase text-slate-400">Total Liquidar:</span>
                 <span className="text-sm font-black text-amber-600">{baseCurrency.symbol}{currentTotalToPay.toLocaleString()} CUP</span>
              </div>
            </div>
            {!branchId && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <p className="text-[10px] font-bold text-rose-700 uppercase">
                  {activeIDNWorker?.name || 'Este vendedor'} no tiene un almacén asignado. Asígnele un almacén en Configuración &gt; Empleados.
                </p>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 bg-secondary rounded-2xl border border-base shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-subtle border-b border-base">
                    <th className="px-4 py-3 text-[9px] font-black text-muted uppercase">Producto</th>
                    <th className="px-4 py-3 text-[9px] font-black text-muted uppercase text-center">Stock Sistema</th>
                    <th className="px-4 py-3 text-[9px] font-black text-muted uppercase text-center">Queda / Físico</th>
                    <th className="px-4 py-3 text-[9px] font-black text-muted uppercase text-center">Vendidos</th>
                    <th className="px-4 py-3 text-[9px] font-black text-muted uppercase text-right">Precio Liquidación (CUP)</th>
                    <th className="px-4 py-3 text-[9px] font-black text-muted uppercase text-right">Monto a Liquidar (CUP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {filteredInventory.map(inv => {
                    const p = (products || []).find(prod => prod.id === inv.productId);
                    const settlementPrice = (idnSettlementPrices || []).find(
                      sp => sp.userId === activeIDNWorker?.id && sp.productId === inv.productId
                    )?.settlementPrice || p?.costPrice || 0;

                    const physicalCount = idnPhysicalCounts[inv.productId] ?? inv.quantity;
                    const soldQty = Math.max(0, inv.quantity - physicalCount);
                    const subtotal = soldQty * settlementPrice;

                    return (
                      <tr key={inv.id} className={cn("hover:bg-slate-50/70 transition-colors", soldQty > 0 && "bg-amber-50/40")}>
                        <td className="px-4 py-3">
                          <p className="text-[11px] font-black text-slate-900 uppercase truncate max-w-[200px]">{p?.name || 'Producto'}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{p?.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{inv.quantity} Uds</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <input 
                              type="number" 
                              min="0"
                              max={inv.quantity}
                              value={idnPhysicalCounts[inv.productId] ?? inv.quantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setIdnPhysicalCounts({ ...idnPhysicalCounts, [inv.productId]: Math.max(0, Number(e.target.value)) })}
                              className={cn(
                                "w-20 px-2 py-1.5 border rounded-lg text-center text-xs font-black outline-none focus:ring-2",
                                (idnPhysicalCounts[inv.productId] ?? inv.quantity) < inv.quantity ? "border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-300" : "border-slate-200 bg-slate-50 text-slate-900",
                                (idnPhysicalCounts[inv.productId] ?? inv.quantity) > inv.quantity && "border-rose-300 bg-rose-50 text-rose-600"
                              )}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-[11px] font-black px-2 py-0.5 rounded", soldQty > 0 ? "bg-amber-100 text-amber-900 font-black" : "text-slate-400")}>
                            {soldQty} Uds
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setIdnPriceFormProduct(inv.productId);
                              setIdnPriceFormAmount(settlementPrice.toString());
                              setShowSetSettlementPriceModal(true);
                            }}
                            className="text-[10px] font-black text-indigo-700 hover:underline cursor-pointer"
                            title="Haz clic para modificar precio de liquidación"
                          >
                            {baseCurrency.symbol}{settlementPrice.toLocaleString()} CUP
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={cn("text-[11px] font-black", soldQty > 0 ? "text-amber-700" : "text-slate-400")}>
                            {baseCurrency.symbol}{subtotal.toLocaleString()} CUP
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Package className="w-10 h-10 text-slate-300" />
                          <p className="text-xs font-black text-slate-400 uppercase">No hay productos con stock en este almacén</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Footer Actions */}
        <footer className="bg-white border-t border-slate-200 p-4 shadow-xl">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 flex-wrap">
               <div className="text-left">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Unidades Vendidas</p>
                 <p className="text-sm font-black text-slate-900">{totalSoldUnits} Uds</p>
               </div>
               <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
               <div className="text-left">
                 <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest">Total a Liquidar (CUP)</p>
                 <p className="text-xl font-black text-amber-700">{baseCurrency.symbol}{currentTotalToPay.toLocaleString()} CUP</p>
               </div>
            </div>

            <button 
              onClick={handleCloseIDNAccount}
              disabled={isProcessingIDN || !branchId}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase transition-all shadow-lg shadow-amber-600/20 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessingIDN ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Cerrar Cuenta y Liquidar
            </button>
          </div>
        </footer>

        {/* Modal Confirmar Liquidación IDN */}
        {showConfirmIDNModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100 p-2 rounded-xl text-amber-700">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">Confirmar Liquidación IDN</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Vendedor: {activeIDNWorker?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowConfirmIDNModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 text-xs space-y-2">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Almacén / Sucursal:</span>
                  <span className="text-slate-900">{branches.find(b => b.id === branchId)?.name || 'Almacén'}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Unidades a descontar:</span>
                  <span className="text-slate-900">{totalSoldUnits} Uds</span>
                </div>
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Venta al público total:</span>
                  <span className="text-slate-900">{baseCurrency.symbol}{currentTotalPublicSales.toLocaleString()} CUP</span>
                </div>
                <div className="flex justify-between font-black text-amber-800 text-sm pt-2 border-t border-slate-200">
                  <span>Total a Entregar (CUP):</span>
                  <span>{baseCurrency.symbol}{currentTotalToPay.toLocaleString()} CUP</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Al confirmar, el inventario se actualizará inmediatamente según el conteo físico verificado y se generará el vale de liquidación.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmIDNModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteIDNSettlement}
                  disabled={isProcessingIDN}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  {isProcessingIDN ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirmar y Liquidar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Vale de Liquidación IDN (con opciones de impresión manual) */}
        {showIDNReceiptModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-hidden animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 overflow-hidden">
              <div className="text-center space-y-1 p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20 shrink-0">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center mx-auto text-amber-700 dark:text-amber-300 mb-1">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase">Vale de Liquidación IDN</h3>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  {showIDNReceiptModal.workerName} • {showIDNReceiptModal.branchName}
                </p>
                <p className="text-[8px] font-medium text-slate-400">
                  {new Date(showIDNReceiptModal.date).toLocaleString()}
                </p>
              </div>

              {/* Detalle de Productos Vendidos - Scrollable */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-4 space-y-2.5">
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                  <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-wider px-1">
                    <span>Producto / Cantidad</span>
                    <span>Monto Liquidado</span>
                  </div>
                  {showIDNReceiptModal.details.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-[9px] uppercase font-black tracking-widest bg-white dark:bg-slate-800 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                      Sin ventas registradas en este turno
                    </div>
                  ) : (
                    showIDNReceiptModal.details.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-black text-slate-900 dark:text-white uppercase text-[10px] sm:text-[11px] truncate">{item?.name || 'Producto'}</p>
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">
                            {item.qty} uds × {baseCurrency.symbol}{item.price.toLocaleString()} CUP
                          </p>
                        </div>
                        <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-xs shrink-0">
                          {baseCurrency.symbol}{item.subtotal.toLocaleString()} CUP
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Gran Total */}
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 flex justify-between items-center">
                  <div>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider block">Total Entregado / Liquidado</span>
                    <span className="text-[8px] text-amber-700 dark:text-amber-400">Precio liquidación pactado</span>
                  </div>
                  <span className="text-base sm:text-lg font-black text-amber-800 dark:text-amber-300 font-mono">
                    {baseCurrency.symbol}{showIDNReceiptModal.totalToPay.toLocaleString()} CUP
                  </span>
                </div>
              </div>

              {/* Botones de Impresión y Acción - Sticky Footer */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintIDNThermal(showIDNReceiptModal)}
                    className="py-2.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                    <span>Ticket 58mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintIDNThermal(showIDNReceiptModal, { preferRawBT: true })}
                    className="py-2.5 px-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>RawBT (Móvil)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleFinishIDNAndGoHome}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all shadow-md shadow-amber-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Finalizar y Volver al Inicio</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Overlay */}
        {(posError || posSuccess) && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
            {posError && (
              <div className="bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
                <AlertCircle className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase">{posError}</span>
                <button onClick={() => setPosError("")} className="ml-2 p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {posSuccess && (
              <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
                <CheckCircle className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase">{posSuccess}</span>
                <button onClick={() => setPosSuccess("")} className="ml-2 p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 relative">
      {/* Global High-Priority Toast Overlay */}
      {(posError || posSuccess) && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          {posError && (
            <div className="bg-rose-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-rose-500">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wide leading-tight">{posError}</span>
              </div>
              <button onClick={() => setPosError("")} className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {posSuccess && (
            <div className="bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-emerald-500">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wide leading-tight">{posSuccess}</span>
              </div>
              <button onClick={() => setPosSuccess("")} className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      {!currentSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 overflow-y-auto space-y-4">
          {joiningSessionId ? (
            /* Modal Formulario de Ingreso a Turno Abierto Existente */
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[2rem] shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95 border border-white/20">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-none mb-1">
                Reanudar Turno Abierto
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                Turno de {(activeCashSessions || []).find(s => s.id === joiningSessionId)?.workerName || 'Vendedor'}
              </p>

              {posError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold text-left flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="text-[11px] leading-tight">{posError}</span>
                </div>
              )}

              <form onSubmit={handleJoinExistingSession} className="space-y-3.5">
                <div className="text-left">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Contraseña del Vendedor del Turno
                  </label>
                  <input
                    type="password"
                    required
                    value={joiningSessionPassword}
                    onChange={e => {
                      setJoiningSessionPassword(e.target.value);
                      setPosError("");
                    }}
                    placeholder="Ingresa la contraseña"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setJoiningSessionId(null);
                      setJoiningSessionPassword("");
                      setPosError("");
                    }}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-sm"
                  >
                    Entrar al Turno
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {lastClosedSession && !showOpenShiftModal ? (
                /* Pantalla visual de Turno Finalizado / Cierre */
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-2xl text-center max-w-md w-full animate-in zoom-in-95 border border-white/20 my-auto">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-100 shadow-sm">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Turno Finalizado</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                    {lastClosedSession.id} • {lastClosedSession.workerName || 'Vendedor'}
                  </p>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-left space-y-1.5 mb-4">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-bold">Sucursal:</span>
                      <span className="font-black text-slate-900">{branches.find(b => b.id === lastClosedSession.branchId)?.name || 'Central'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-bold">Cierre:</span>
                      <span className="font-bold text-slate-700">{new Date(lastClosedSession.closingDate || lastClosedSession.closedAt || new Date()).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                      <span className="text-slate-500 font-bold">Fondo Inicial:</span>
                      <span className="font-mono font-bold text-slate-800">{formatMoney(lastClosedSession.openingBalance || 0, baseCurrency.symbol)}</span>
                    </div>
                    {lastClosedSession.closingBalances && lastClosedSession.closingBalances.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-200 space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Arqueo Declarado</span>
                        {lastClosedSession.closingBalances.map((b, bIdx) => (
                          <div key={bIdx} className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 capitalize">{b.currencyCode} ({b.method === 'transfer' ? 'Transferencia' : 'Efectivo'}):</span>
                            <span className="font-mono font-black text-emerald-700">{formatMoney(b.amount, currencies.find(c => c.code === b.currencyCode)?.symbol || '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botones de impresión y acciones */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintClosureThermal(lastClosedSession)}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[8px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Printer className="w-3 h-3 text-slate-500" />
                        Ticket 58mm
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintClosureThermal(lastClosedSession, { preferRawBT: true })}
                        className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-black text-[8px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Share2 className="w-3 h-3 text-indigo-500" />
                        RawBT (Móvil)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowOpenShiftModal(true)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Abrir Nuevo Turno / Caja
                    </button>

                    {currentUser?.role === 'admin' ? (
                      <button 
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Volver al Menú Principal
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => logout()}
                        className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Cerrar Sesión del Empleado
                      </button>
                    )}
                  </div>
                </div>

              ) : (
                /* Modal Formulario de Apertura de Caja */
                <div className="bg-white p-5 rounded-[2rem] shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95 border border-white/20 my-auto">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-2">Apertura de Caja</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Fondo Inicial del Turno</p>
                  
                  <div className="flex justify-center mb-4">
                    <span className="flex items-center gap-1 text-[7px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Sistema Local Protegido
                    </span>
                  </div>

                  
                  {/* Inline Modal Alert */}
                  {posError && (
                    <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in zoom-in-95">
                      <div className="flex items-center gap-2 text-left">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="text-[11px] font-bold">{posError}</span>
                      </div>
                      <button type="button" onClick={() => setPosError("")} className="p-1 hover:bg-rose-100 rounded-lg text-rose-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {posSuccess && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in zoom-in-95">
                      <div className="flex items-center gap-2 text-left">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-bold">{posSuccess}</span>
                      </div>
                      <button type="button" onClick={() => setPosSuccess("")} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleOpenSession} className="space-y-3">
                    <div className="text-left space-y-2">
                      <div>
                        <label className="block text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Seleccionar Vendedor / Empleado del Turno
                        </label>
                        {currentUser?.role === 'admin' ? (
                          <select
                            value={sessionWorkerName}
                            onChange={e => {
                              setSessionWorkerName(e.target.value);
                              setSessionPassword("");
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                            required
                          >
                            <option value="">-- Seleccionar Trabajador / IDN --</option>
                            {(users || []).filter(u => u.isActive !== false).map(u => (
                              <option key={u.id} value={u.name || ''}>
                                {u.name || 'Trabajador'} {u.isIndependent ? '(Vendedor IDN)' : (u.role === 'admin' ? '(Administrador)' : '(Empleado)')}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700">
                            {currentUser?.name || 'Trabajador'}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Contraseña del Vendedor Seleccionado
                        </label>
                        <input
                          type="password"
                          required
                          value={sessionPassword}
                          onChange={e => setSessionPassword(e.target.value)}
                          placeholder={detectedWorker ? `Ingresa la contraseña de ${detectedWorker?.name || 'trabajador'}` : "Ingresa la contraseña del trabajador"}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {isWorkerIndependent && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-1.5 text-left">
                        <Package className="w-3 h-3 text-amber-600 shrink-0" />
                        <p className="text-[8px] font-black text-amber-800 uppercase tracking-tight">
                          Vendedor Independiente (IDN) • Almacén exclusivo bloqueado
                        </p>
                      </div>
                    )}


                      {(allowedBranches || []).length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-left">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">
                              Sucursal / Almacén a Operar
                            </label>
                            {isBranchLocked && (
                              <span className="flex items-center gap-1 text-[8px] font-black text-amber-700 uppercase bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                <Lock className="w-2.5 h-2.5" /> Bloqueado
                              </span>
                            )}
                          </div>
                          <select 
                            value={sessionBranchId}
                            disabled={isBranchLocked}
                            onChange={(e) => setSessionBranchId(e.target.value)}
                            className={cn(
                              "w-full px-4 py-3 border rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none",
                              isBranchLocked ? "bg-amber-50/70 border-amber-200 cursor-not-allowed text-amber-900 font-black" : "bg-slate-50 border-slate-100"
                            )}
                          >
                            {allowedBranches.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          {isBranchLocked && (
                            <p className="text-[8px] font-bold text-amber-700 mt-1 uppercase">
                              El vendedor tiene un almacén fijo asignado y no puede vender desde otro almacén.
                            </p>
                          )}
                        </div>
                        
                        <div className="text-left">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">
                              Fondo Inicial ({baseCurrency.symbol} CUP)
                            </label>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Puede ser 0</span>
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <span className="text-slate-400 font-bold">{baseCurrency.symbol}</span>
                            </div>
                            <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              value={openingAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={e => setOpeningAmount(e.target.value)}
                              className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-2.5 pt-2">
                          <button 
                            type="submit"
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                          >
                            Abrir Caja y Comenzar
                          </button>

                          {lastClosedSession && (
                            <button
                              type="button"
                              onClick={() => setShowOpenShiftModal(false)}
                              className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                            >
                              Ver Resumen de Turno Anterior
                            </button>
                          )}

                          {currentUser?.role === 'admin' ? (
                            <button 
                              type="button"
                              onClick={() => navigate('/')}
                              className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                            >
                              Volver al Menú
                            </button>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => logout()}
                              className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                            >
                              Cerrar Sesión
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-4">
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold">
                          No tienes sucursales asignadas.
                        </div>
                        {currentUser?.role === 'admin' ? (
                          <button 
                            type="button"
                            onClick={() => navigate('/')}
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                          >
                            Volver al Menú
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => logout()}
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                          >
                            Cerrar Sesión
                          </button>
                        )}
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* Turnos Abiertos en Curso (Evita duplicidad y permite reanudar con contraseña) */}
              {(() => {
                const otherOpenSessions = (activeCashSessions || []).filter(s => s.status === 'open');
                if (otherOpenSessions.length === 0) return null;
                return (
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 text-left max-w-sm w-full mt-2 shrink-0">
                    <span className="text-[8px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1.5 mb-2.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin-slow text-indigo-500" />
                      Turnos Abiertos Actualmente
                    </span>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {otherOpenSessions.map(s => (
                        <div key={s.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight block truncate">
                              {s.workerName || 'Vendedor'}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block">
                              {branches.find(b => b.id === s.branchId)?.name || 'Sucursal'} • ID: {s.id.slice(0, 6)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setJoiningSessionId(s.id);
                              setJoiningSessionPassword("");
                              setPosError("");
                            }}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-black text-[8px] uppercase tracking-wide rounded-lg transition-all active:scale-95 cursor-pointer shrink-0"
                          >
                            Reanudar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Checkout Modal - Compact & Linear Redesign */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[80] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md sm:max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[94vh] sm:max-h-[90vh] border border-slate-200 dark:border-slate-800">
            
            {/* Header: Total Summary (Compact) */}
            <div className="bg-slate-900 text-white p-3.5 sm:p-4 relative shrink-0">
              <button 
                onClick={() => { setShowCheckoutModal(false); setPaymentLines([]); setActivePaymentLineId(null); }}
                className="absolute right-3 top-3 p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                title="Cerrar cobro"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
              
              <div className="text-center">
                <p className="text-slate-400 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] mb-0.5">Total a Cobrar</p>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">{formatMoney(totalBase, baseCurrency.symbol)}</h3>
                <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                  {currencies.filter(c => !c.isBase).map(c => (
                    <span key={c.code} className="text-[8px] font-black bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
                      {c.code}: {formatMoney(totalBase / c.rateToBase, c.symbol)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2 sm:space-y-3">
              {/* Status Bar (Compact) */}
              <div className="flex gap-2">
                <div className="flex-1 bg-subtle border border-base p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                  <p className="text-[7px] sm:text-[8px] font-black text-muted uppercase tracking-widest">Pagado</p>
                  <p className="text-sm sm:text-base font-black text-primary">{formatMoney(totalPaidBase, baseCurrency.symbol)}</p>
                </div>
                <div className={cn(
                  "flex-1 p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-colors",
                  remainingBase > 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
                )}>
                  <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-muted">
                    {remainingBase > 0 ? "Faltante" : "Vuelto"}
                  </p>
                  <p className={cn(
                    "text-sm sm:text-base font-black",
                    remainingBase > 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {formatMoney(remainingBase > 0 ? remainingBase : changeBase, baseCurrency.symbol)}
                  </p>
                </div>
              </div>

              {changeBase > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-1">Vuelto a entregar</p>
                  <p className="text-2xl font-black text-emerald-600">{formatMoney(changeBase, baseCurrency.symbol)}</p>
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-tight mt-1">Entregar en {baseCurrency.code}</p>
                </div>
              )}

              {/* Linear Payment Inputs (Compact) */}
              <div className="space-y-1.5">
                {paymentLines.map((line) => (
                  <div 
                    key={line.id} 
                    onClick={() => setActivePaymentLineId(line.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-2xl border-2 transition-all cursor-pointer group",
                      activePaymentLineId === line.id ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800" : "bg-secondary border-base hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider",
                          line.method === 'cash' ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                        )}>
                          {line.method === 'cash' ? 'EFECTIVO' : 'TRANSF.'}
                        </span>
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest">{line.code}</span>
                      </div>
                      <div className="text-lg font-black text-primary leading-none">
                        {formatMoney(line.amount, currencies.find(c => c.code === line.code)?.symbol || '')}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removePaymentLine(line.id); }}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={addPaymentLine} 
                  className="w-full py-2 bg-subtle border-2 border-dashed border-base text-muted text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-3 h-3" /> Agregar Pago
                </button>
              </div>

              {activePaymentLineId && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 grid grid-cols-2 gap-1 p-1 bg-white rounded-xl border border-slate-100">
                      <button
                        onClick={() => updatePaymentLine(activePaymentLineId, 'method', 'cash')}
                        className={cn(
                          "py-2 rounded-lg text-[9px] font-black uppercase transition-all",
                          paymentLines.find(l => l.id === activePaymentLineId)?.method === 'cash' ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                        )}
                      >Efectivo</button>
                      <button
                        onClick={() => {
                          updatePaymentLine(activePaymentLineId, 'method', 'transfer');
                        }}
                        className={cn(
                          "py-2 rounded-lg text-[9px] font-black uppercase transition-all",
                          paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                        )}
                      >Transf.</button>
                    </div>
                    <div className="flex-[1.2] flex gap-1 p-1 bg-white rounded-xl border border-slate-100 overflow-x-auto scrollbar-hide">
                      {currencies
                        .filter(c => {
                          const activeLine = paymentLines.find(l => l.id === activePaymentLineId);
                          if (activeLine?.method === 'transfer') {
                            return c.code === 'CUP' || c.code === 'MN';
                          }
                          return true;
                        })
                        .map(c => (
                        <button
                          key={c.code}
                          onClick={() => {
                            const line = paymentLines.find(l => l.id === activePaymentLineId);
                            if (line) {
                              updatePaymentLine(line.id, 'code', c.code);
                            }
                          }}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-[9px] font-black transition-all",
                            paymentLines.find(l => l.id === activePaymentLineId)?.code === c.code ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50 disabled:opacity-30"
                          )}
                        >{c.code}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' && (
                      <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-3.5 border border-slate-800 shadow-md space-y-2.5 animate-in fade-in duration-200">
                        {/* Header: Selector & Bank Info */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                              <CreditCard className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">Cuenta de Destino:</span>
                          </div>
                          
                          <select
                            value={paymentLines.find(l => l.id === activePaymentLineId)?.bankCardId || ''}
                            onChange={(e) => updatePaymentLine(activePaymentLineId, 'bankCardId', e.target.value)}
                            className="flex-1 max-w-[240px] px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-[10px] font-bold truncate transition-colors"
                          >
                            <option value="" className="text-slate-900 bg-white">Seleccionar Cuenta / Tarjeta...</option>
                            {(() => {
                              const activeLineCode = paymentLines.find(l => l.id === activePaymentLineId)?.code;
                              const matchedCards = bankCards.filter(c => c.currency === activeLineCode);
                              const cardsToRender = matchedCards.length > 0 ? matchedCards : bankCards;
                              return cardsToRender.map(card => (
                                <option key={card.id} value={card.id} className="text-slate-900 bg-white">
                                  {card.bank || 'Banco'} - {card.name || 'Tarjeta'} ({card.currency || 'CUP'})
                                </option>
                              ));
                            })()}
                          </select>
                        </div>

                        {/* Card Details Body */}
                        {(() => {
                          const activeLine = paymentLines.find(l => l.id === activePaymentLineId);
                          const card = bankCards.find(c => c.id === activeLine?.bankCardId);
                          if (!card) {
                            return (
                              <div className="p-2.5 bg-slate-800/50 border border-slate-800 rounded-xl text-center">
                                <p className="text-[9px] font-bold text-slate-400">Seleccione arriba la cuenta receptora para ver la tarjeta y teléfono de confirmación.</p>
                              </div>
                            );
                          }

                          const rawAccount = card.accountNumber || card.lastFourDigits || card.lastFour || '';
                          const cleanAccount = rawAccount ? rawAccount.replace(/\s+/g, '') : '';
                          const cleanDigits = rawAccount ? rawAccount.replace(/\D/g, '') : '';
                          const formattedCardNumber = cleanDigits.length > 0 
                            ? cleanDigits.replace(/(\d{4})(?=\d)/g, '$1 ') 
                            : rawAccount;
                          const cleanPhone = card.phone ? card.phone.replace(/\D/g, '') : '';
                          const isCup = activeLine?.code === 'CUP' || activeLine?.code === 'MN';
                          const transferAmt = isCup ? Math.round(activeLine?.amount || 0) : (activeLine?.amount || 0);

                          const handleCopyText = (text: string, label: string) => {
                            navigator.clipboard?.writeText(text);
                            setPosSuccess(`${label} copiado`);
                            setTimeout(() => setPosSuccess(""), 2000);
                          };

                          const handleCopyAllTransferData = () => {
                            const bankDisplay = card.bank || card.bankName || 'Banco';
                            const holderDisplay = card.name || card.cardHolder || 'Titular';
                            const textToCopy = `Banco: ${bankDisplay}\nTitular: ${holderDisplay}\nTarjeta: ${cleanDigits || cleanAccount}\n${card.phone ? `Confirmar SMS al: ${card.phone}\n` : ''}Monto Exacto: ${transferAmt} ${activeLine?.code || 'CUP'}`;
                            navigator.clipboard?.writeText(textToCopy);
                            setCopiedTransferInfo(true);
                            setTimeout(() => setCopiedTransferInfo(false), 2500);
                          };

                          return (
                            <div className="space-y-2">
                              {/* Tarjeta Magnética */}
                              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-inner">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">Número de Tarjeta</span>
                                    <span className="text-[7px] font-bold text-slate-500 uppercase">({card.bank})</span>
                                  </div>
                                  <div className="font-mono font-black text-sm sm:text-base tracking-widest text-emerald-400 select-all whitespace-nowrap overflow-x-auto scrollbar-hide py-0.5">
                                    {formattedCardNumber}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(cleanDigits || cleanAccount, 'Tarjeta')}
                                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm shrink-0"
                                  title="Copiar número de tarjeta"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar</span>
                                </button>
                              </div>

                              {/* Monto y Teléfono SMS en fila compacta */}
                              <div className="grid grid-cols-2 gap-2">
                                {/* Monto Exacto */}
                                <div className="p-2 bg-slate-800/80 border border-slate-700/80 rounded-xl flex items-center justify-between gap-1">
                                  <div className="min-w-0">
                                    <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-0.5">Monto Exacto</p>
                                    <p className="text-xs font-black text-white truncate">
                                      {transferAmt.toLocaleString('es-CU')} {activeLine?.code || 'CUP'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(transferAmt.toString(), 'Monto')}
                                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors shrink-0"
                                    title="Copiar monto"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Teléfono SMS */}
                                {card.phone ? (
                                  <div className="p-2 bg-slate-800/80 border border-slate-700/80 rounded-xl flex items-center justify-between gap-1">
                                    <div className="min-w-0">
                                      <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest leading-none mb-0.5">Confirmar SMS</p>
                                      <p className="text-xs font-mono font-bold text-white truncate">{card.phone}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(cleanPhone, 'Teléfono')}
                                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors shrink-0"
                                      title="Copiar teléfono"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-2 bg-slate-800/80 border border-slate-700/80 rounded-xl flex items-center justify-between gap-1">
                                    <div className="min-w-0">
                                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Titular</p>
                                      <p className="text-xs font-bold text-slate-200 truncate">{card?.name || 'Titular'}</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Botón para copiar todos los datos */}
                              <button
                                type="button"
                                onClick={handleCopyAllTransferData}
                                className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded-xl text-[10px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-98"
                              >
                                {copiedTransferInfo ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">¡Datos de pago copiados!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>Copiar datos de pago (WhatsApp / SMS)</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="flex justify-between items-end mb-1 px-1 gap-2 flex-wrap">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Monto a recibir</label>
                      <div className="flex gap-2">
                        {paymentLines.find(l => l.id === activePaymentLineId)?.code === 'USD' && 
                         (paymentLines.find(l => l.id === activePaymentLineId)?.amount || 0) % 1 !== 0 && (
                          <button 
                            onClick={() => splitUsdPayment(activePaymentLineId)}
                            className="bg-amber-50 text-amber-700 text-[9px] font-black px-3 py-1 rounded-full border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-1 shadow-sm"
                            title="Pagar enteros en USD y el resto en CUP"
                          >
                            <DollarSign className="w-2.5 h-2.5" /> USD Entero + CUP
                          </button>
                        )}
                        {remainingBase > 0 && (
                          <button 
                            onClick={() => autoFillRemaining(activePaymentLineId)}
                            className={cn(
                              "px-3 py-1 rounded-full transition-all uppercase tracking-tighter animate-bounce shadow-lg flex items-center gap-1.5",
                              paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' 
                                ? "bg-blue-600 text-white text-[11px] font-black ring-4 ring-blue-100" 
                                : "bg-indigo-50 text-indigo-600 text-[9px] font-black"
                            )}
                          >
                            {paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' && <div className="w-2 h-2 rounded-full bg-white animate-ping" />}
                            Total a cobrar: {formatMoney(remainingBase / (currencies.find(c => c.code === paymentLines.find(l => l.id === activePaymentLineId)?.code)?.rateToBase || 1), currencies.find(c => c.code === paymentLines.find(l => l.id === activePaymentLineId)?.code)?.symbol || '')}
                          </button>
                        )}
                      </div>
                    </div>
                    <input 
                      type="number"
                      step="0.01"
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      value={(() => {
                        const amt = paymentLines.find(l => l.id === activePaymentLineId)?.amount;
                        return (amt === undefined || Number.isNaN(amt)) ? '' : amt;
                      })()}
                      onChange={(e) => updatePaymentLine(activePaymentLineId, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-2xl font-black text-slate-900 shadow-inner"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                disabled={remainingBase > 0.01 || paymentLines.length === 0 || paymentLines.some(l => l.method === 'transfer' && bankCards.length > 0 && !l.bankCardId)}
                onClick={handleCheckout}
                className="w-full py-3 sm:py-3.5 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-30 disabled:grayscale disabled:shadow-none active:scale-95 cursor-pointer"
              >
                CONFIRMAR COBRO
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cash Management Modal */}
      {showCashManagementModal && currentSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 border border-white/20 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-widest">Caja y Ventas del Turno</h3>
              </div>
              <button 
                onClick={() => setShowCashManagementModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0">
              <button
                onClick={() => setCashManagementTab('movements')}
                className={cn(
                  "flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors",
                  cashManagementTab === 'movements' ? "text-indigo-600 border-b-2 border-indigo-600 bg-white" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Movimientos
              </button>
              <button
                onClick={() => setCashManagementTab('sales')}
                className={cn(
                  "flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors",
                  cashManagementTab === 'sales' ? "text-indigo-600 border-b-2 border-indigo-600 bg-white" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Ventas del Turno
              </button>
              <button
                onClick={() => setCashManagementTab('close')}
                className={cn(
                  "flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors",
                  cashManagementTab === 'close' ? "text-indigo-600 border-b-2 border-indigo-600 bg-white" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Arqueo y Cierre
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {cashManagementTab === 'movements' ? (
                <div className="space-y-6">
                  <form onSubmit={handleAddMovement} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
                        <select 
                          value={movementData.type}
                          onChange={e => setMovementData({...movementData, type: e.target.value as any})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="expense">Egreso (Gasto)</option>
                          <option value="income">Ingreso (Entrada)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Moneda</label>
                        <select 
                          value={movementData.currencyCode}
                          onChange={e => setMovementData({...movementData, currencyCode: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          required
                          value={movementData.amount}
                          onFocus={(e) => e.target.select()}
                          onChange={e => setMovementData({...movementData, amount: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Descripción</label>
                        <input 
                          type="text" 
                          required
                          value={movementData.description}
                          onChange={e => setMovementData({...movementData, description: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Ej: Pago de almuerzo"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100">
                      Registrar Movimiento
                    </button>
                  </form>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de Turno</h4>
                    {currentSession?.movements && currentSession.movements.length > 0 ? (
                      currentSession.movements.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-slate-200 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              m.type === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                            )}>
                              {m.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{m.description}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(m.date).toLocaleTimeString()}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <p className={cn(
                              "text-[11px] font-black",
                              m.type === 'income' ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {m.type === 'income' ? '+' : '-'}{m.amount.toLocaleString('es-CU', { minimumFractionDigits: 2 })} {m.currencyCode}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`¿Estás seguro de que deseas eliminar este movimiento: "${m.description}"?`)) {
                                  removeCashMovement(currentSession.id, m.id);
                                  addNotification("Movimiento de caja eliminado", 'info');
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Eliminar movimiento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4 font-bold">No hay movimientos registrados</p>
                    )}
                  </div>
                </div>
              ) : cashManagementTab === 'sales' ? (
                <div className="space-y-4">
                  {(() => {
                    const sessionTx = activeTransactions.filter(t => 
                      t.sessionId === currentSession?.id && !t.deletedAt
                    );

                    // Categorize payment types
                    let cashCupSum = 0;
                    let cashUsdSum = 0;
                    let transferCupSum = 0;
                    let otherSum = 0;

                    sessionTx.forEach(tx => {
                      (tx.payments || []).forEach(p => {
                        if (p.currencyCode === 'USD' && p.method === 'cash') {
                          cashUsdSum += p.amount;
                        } else if (p.currencyCode === baseCurrency.code && p.method === 'cash') {
                          cashCupSum += p.amount;
                        } else if (p.method === 'transfer') {
                          transferCupSum += (p.amount * (p.exchangeRate || 1));
                        } else {
                          otherSum += (p.amount * (p.exchangeRate || 1));
                        }
                      });
                    });

                    const totalSalesAmount = sessionTx.reduce((sum, tx) => sum + (tx.total || 0), 0);

                    // Helper to determine payment category for a transaction
                    const getTxPaymentCategory = (tx: Transaction): 'usd' | 'transfer' | 'cash_cup' | 'mixed' => {
                      const payments = tx.payments || [];
                      if (payments.length === 0) return 'cash_cup';
                      const hasUsd = payments.some(p => p.currencyCode === 'USD');
                      const hasTransfer = payments.some(p => p.method === 'transfer');
                      const hasCashCup = payments.some(p => p.currencyCode === baseCurrency.code && p.method === 'cash');

                      if (payments.length === 1) {
                        if (hasUsd) return 'usd';
                        if (hasTransfer) return 'transfer';
                        if (hasCashCup) return 'cash_cup';
                      }

                      // Multiple payments
                      const uniqueTypes = new Set(payments.map(p => `${p.currencyCode}-${p.method}`));
                      if (uniqueTypes.size === 1) {
                        if (hasUsd) return 'usd';
                        if (hasTransfer) return 'transfer';
                        return 'cash_cup';
                      }
                      return 'mixed';
                    };

                    const filteredTx = sessionTx.filter(tx => {
                      if (salesFilter === 'all') return true;
                      const cat = getTxPaymentCategory(tx);
                      return cat === salesFilter;
                    });

                    // Product Aggregation with Payment context breakdown
                    type ProdBreakdown = {
                      name: string;
                      quantity: number;
                      unitPrice: number;
                      total: number;
                      usdQty: number;
                      usdTotal: number;
                      transferQty: number;
                      transferTotal: number;
                      cashCupQty: number;
                      cashCupTotal: number;
                      mixedQty: number;
                      mixedTotal: number;
                    };

                    const productAgg: Record<string, ProdBreakdown> = {};
                    sessionTx.forEach(tx => {
                      const cat = getTxPaymentCategory(tx);
                      (tx.items || []).forEach(item => {
                        const prodObj = typeof item.product === 'object' ? item.product : products.find(p => p.id === (item.product as unknown as string));
                        const name = prodObj?.name || (typeof item.product === 'string' ? item.product : 'Producto');
                        const price = prodObj?.price || 0;
                        const variantStr = item.variantLabel ? ` (${item.variantLabel})` : '';
                        const fullName = `${name}${variantStr}`;

                        if (!productAgg[fullName]) {
                          productAgg[fullName] = { 
                            name: fullName, 
                            quantity: 0, 
                            unitPrice: price, 
                            total: 0,
                            usdQty: 0,
                            usdTotal: 0,
                            transferQty: 0,
                            transferTotal: 0,
                            cashCupQty: 0,
                            cashCupTotal: 0,
                            mixedQty: 0,
                            mixedTotal: 0
                          };
                        }
                        productAgg[fullName].quantity += item.quantity;
                        productAgg[fullName].total += (price * item.quantity);

                        if (cat === 'usd') {
                          productAgg[fullName].usdQty += item.quantity;
                          productAgg[fullName].usdTotal += (price * item.quantity);
                        } else if (cat === 'transfer') {
                          productAgg[fullName].transferQty += item.quantity;
                          productAgg[fullName].transferTotal += (price * item.quantity);
                        } else if (cat === 'cash_cup') {
                          productAgg[fullName].cashCupQty += item.quantity;
                          productAgg[fullName].cashCupTotal += (price * item.quantity);
                        } else {
                          productAgg[fullName].mixedQty += item.quantity;
                          productAgg[fullName].mixedTotal += (price * item.quantity);
                        }
                      });
                    });

                    const consolidatedList = Object.values(productAgg);

                    return (
                      <div className="space-y-4">
                        {/* Financial Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-2.5 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between text-emerald-700 mb-1">
                              <span className="text-[8px] font-black uppercase tracking-wider">Efectivo CUP</span>
                              <Banknote className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-black text-emerald-900 truncate">
                              {formatMoney(cashCupSum, baseCurrency.symbol)}
                            </span>
                          </div>

                          <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-2.5 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between text-amber-700 mb-1">
                              <span className="text-[8px] font-black uppercase tracking-wider">Efectivo USD</span>
                              <DollarSign className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-amber-900 block truncate">
                                ${cashUsdSum.toFixed(2)} USD
                              </span>
                              <span className="text-[8px] font-bold text-amber-600 block">
                                {formatMoney(cashUsdSum * (currencies.find(c => c.code === 'USD')?.rateToBase || 1), baseCurrency.symbol)} eq.
                              </span>
                            </div>
                          </div>

                          <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-2.5 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between text-blue-700 mb-1">
                              <span className="text-[8px] font-black uppercase tracking-wider">Transferencia</span>
                              <CreditCard className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-black text-blue-900 truncate">
                              {formatMoney(transferCupSum, baseCurrency.symbol)}
                            </span>
                          </div>

                          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-2.5 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between text-indigo-700 mb-1">
                              <span className="text-[8px] font-black uppercase tracking-wider">Total Ventas</span>
                              <Package className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-indigo-900 block truncate">
                                {formatMoney(totalSalesAmount, baseCurrency.symbol)}
                              </span>
                              <span className="text-[8px] font-bold text-indigo-600 block">
                                {sessionTx.length} {sessionTx.length === 1 ? 'ticket' : 'tickets'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Subtabs & Filters */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1 border-t border-slate-100">
                          {/* Subtabs */}
                          <div className="flex bg-slate-100 p-0.5 rounded-xl text-[9px] font-black uppercase">
                            <button
                              onClick={() => setSalesSubTab('tickets')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1",
                                salesSubTab === 'tickets' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              <Receipt className="w-3 h-3" />
                              Tickets ({sessionTx.length})
                            </button>
                            <button
                              onClick={() => setSalesSubTab('products')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1",
                                salesSubTab === 'products' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              <Package className="w-3 h-3" />
                              Productos ({consolidatedList.reduce((s, p) => s + p.quantity, 0)} u.)
                            </button>
                          </div>

                          {/* Filter by Payment Method */}
                          {salesSubTab === 'tickets' && (
                            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
                              <button
                                onClick={() => setSalesFilter('all')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                                  salesFilter === 'all' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                )}
                              >
                                Todos
                              </button>
                              <button
                                onClick={() => setSalesFilter('usd')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-0.5",
                                  salesFilter === 'usd' ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                )}
                              >
                                💵 USD
                              </button>
                              <button
                                onClick={() => setSalesFilter('transfer')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-0.5",
                                  salesFilter === 'transfer' ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                )}
                              >
                                💳 Transferencia
                              </button>
                              <button
                                onClick={() => setSalesFilter('cash_cup')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-0.5",
                                  salesFilter === 'cash_cup' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                )}
                              >
                                💵 Efectivo CUP
                              </button>
                              <button
                                onClick={() => setSalesFilter('mixed')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-0.5",
                                  salesFilter === 'mixed' ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                                )}
                              >
                                🔄 Mixto
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Content: Tickets view vs Products view */}
                        {salesSubTab === 'tickets' ? (
                          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                            {filteredTx.length > 0 ? (
                              filteredTx.map((tx) => {
                                const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
                                const cat = getTxPaymentCategory(tx);
                                return (
                                  <div key={tx.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                            {tx.id}
                                          </span>
                                          <span className="text-[9px] font-bold text-slate-400">
                                            {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                          <span className="text-[9px] font-bold text-slate-600">
                                            • {customer?.name || 'Consumidor Final'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-black text-slate-900 dark:text-white">
                                          {formatMoney(tx.total, baseCurrency.symbol)}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => setShowReceiptModal(tx)}
                                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Ver Comprobante Flotante"
                                          >
                                            <Receipt className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleThermalPrint(tx)}
                                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Imprimir Ticket Térmico"
                                          >
                                            <Printer className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (window.confirm(`¿Estás seguro de eliminar el ticket ${tx.id}? Esto devolverá los productos al inventario.`)) {
                                                useStore.getState().deleteTransaction(tx.id);
                                                addNotification(`Ticket ${tx.id} eliminado y stock restaurado.`, 'info');
                                              }
                                            }}
                                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Anular Venta"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Products list in this ticket - Compact & Contained */}
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2 space-y-1 text-[9px] max-h-24 sm:max-h-28 overflow-y-auto custom-scrollbar">
                                      {tx.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-slate-700 font-bold">
                                          <span className="truncate pr-2">
                                            {item.quantity}x {typeof (item.product as any) === "object" ? ((item.product as any)?.name || "Producto") : (products.find(p => p.id === (item.product as any))?.name || (item.product as any) || "Producto")}
                                            {item.variantLabel ? ` (${item.variantLabel})` : ''}
                                          </span>
                                          <span className="font-mono shrink-0">
                                            {formatMoney((typeof (item.product as any) === "object" ? ((item.product as any)?.price || 0) : (products.find(p => p.id === (item.product as any))?.price || item.price || 0)) * item.quantity, baseCurrency.symbol)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Payment Method Badges & Breakdown */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-100 text-[8px] font-black">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {cat === 'usd' && (
                                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            💵 100% Pagado en USD
                                          </span>
                                        )}
                                        {cat === 'transfer' && (
                                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            💳 Pagado por Transferencia
                                          </span>
                                        )}
                                        {cat === 'cash_cup' && (
                                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            💵 Pagado en Efectivo CUP
                                          </span>
                                        )}
                                        {cat === 'mixed' && (
                                          <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            🔄 Pago Mixto / Multi-moneda
                                          </span>
                                        )}

                                        {/* Individual lines */}
                                        {(tx.payments || []).map((p, pIdx) => {
                                          const card = p.bankCardId ? bankCards.find(c => c.id === p.bankCardId) : null;
                                          const sym = currencies.find(c => c.code === p.currencyCode)?.symbol || '';
                                          return (
                                            <span key={pIdx} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                              {p.method === 'transfer' ? 'Transf' : 'Efec'} {formatMoney(p.amount, sym)} {card ? `(${card.bank})` : ''}
                                            </span>
                                          );
                                        })}
                                      </div>

                                      {tx.changeGiven && tx.changeGiven > 0 ? (
                                        <span className="text-emerald-600 font-bold">
                                          Vuelto: {formatMoney(tx.changeGiven, baseCurrency.symbol)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <Receipt className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                  No hay ventas con este filtro
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                            {consolidatedList.length > 0 ? (
                              consolidatedList.map((prod, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <span className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                                        {prod.quantity}x
                                      </span>
                                      <div className="min-w-0">
                                        <span className="font-black text-slate-900 text-xs uppercase block truncate">{prod?.name || "Producto"}</span>
                                        <span className="text-[9px] font-bold text-slate-400 block">
                                          Precio unitario: {formatMoney(prod.unitPrice, baseCurrency.symbol)}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-black text-indigo-600 text-xs shrink-0 ml-2">
                                      {formatMoney(prod.total, baseCurrency.symbol)}
                                    </span>
                                  </div>

                                  {/* Payment method breakdown for this product */}
                                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 text-[8px] font-bold">
                                    <span className="text-slate-400 uppercase tracking-widest text-[7px] font-black">Pagado en:</span>
                                    {prod.usdQty > 0 && (
                                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                                        💵 USD: {prod.usdQty} u. ({formatMoney(prod.usdTotal, baseCurrency.symbol)})
                                      </span>
                                    )}
                                    {prod.transferQty > 0 && (
                                      <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded">
                                        💳 Transf: {prod.transferQty} u. ({formatMoney(prod.transferTotal, baseCurrency.symbol)})
                                      </span>
                                    )}
                                    {prod.cashCupQty > 0 && (
                                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                                        💵 CUP: {prod.cashCupQty} u. ({formatMoney(prod.cashCupTotal, baseCurrency.symbol)})
                                      </span>
                                    )}
                                    {prod.mixedQty > 0 && (
                                      <span className="bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                                        🔄 Mixto: {prod.mixedQty} u. ({formatMoney(prod.mixedTotal, baseCurrency.symbol)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <Package className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                  No hay productos vendidos en este turno
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Buttons to Print Full Shift Summary */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => handlePrintClosureThermal(currentSession)}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Printer className="w-4 h-4" />
                            Imprimir Resumen Turno (58mm)
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintClosureThermal(currentSession, { preferRawBT: true })}
                            className="py-3 px-4 bg-slate-800 text-slate-200 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            title="Impresión con RawBT para Android"
                          >
                            <Printer className="w-3.5 h-3.5 text-indigo-400" />
                            RawBT
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-indigo-50 rounded-2xl p-4 flex justify-between items-center border border-indigo-100">
                    <div>
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Fondo Inicial</p>
                      <p className="text-lg font-black text-indigo-900">{(currentSession?.openingBalance || 0).toLocaleString('es-CU', { minimumFractionDigits: 2 })} {baseCurrency.code}</p>
                    </div>
                    <button 
                      onClick={() => {
                        const autoBalances: {[key: string]: number} = {};
                        expectedBalances.forEach(eb => {
                          autoBalances[`${eb.currencyCode}-${eb.method}`] = eb.amount;
                        });
                        setClosingBalances(autoBalances);
                      }}
                      className="text-[9px] font-black uppercase text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-95"
                    >
                      Cuadre Perfecto
                    </button>
                  </div>

                  <form onSubmit={handleClose} className="space-y-5">
                    {/* Fecha de Cierre Arriba */}
                    <div className="space-y-3">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Fecha de Cierre del Turno
                        </label>
                        <input 
                          type="date"
                          required
                          value={sessionClosingDate}
                          onChange={(e) => setSessionClosingDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                      </div>

                      {/* Vendedor del Turno (Sin volver a pedir el nombre) */}
                      <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-indigo-600" />
                          <span className="text-[9px] font-black text-indigo-900 uppercase tracking-wider">Vendedor Asignado:</span>
                        </div>
                        <span className="text-xs font-black text-indigo-950 uppercase tracking-tight">
                          {currentSession?.workerName || sessionWorkerName || currentUser?.name || 'Vendedor'}
                        </span>
                      </div>

                      {/* Salary Calculation Card */}
                      {(() => {
                        const sessionUser = users.find(u => u.id === currentSession?.userId || (u.name && currentSession?.workerName && u.name.toLowerCase() === currentSession.workerName.toLowerCase())) || currentUser;
                        if (!sessionUser || sessionUser.isIndependent) return null;
                        
                        const sessionTx = activeTransactions.filter(t => 
                          t.sessionId === currentSession?.id && !t.deletedAt
                        );
                        const totalSales = sessionTx.reduce((sum, tx) => sum + (tx.total || 0), 0);
                        
                        const productCommissions = sessionTx.reduce((sum, tx) => {
                          return sum + (tx.items || []).reduce((itemSum, item) => {
                            const prodId = typeof item.product === 'string' ? item.product : item.product?.id;
                            const prodObj = products.find(p => p.id === prodId);
                            const commVal = prodObj?.commissionValue || 0;
                            return itemSum + (commVal * (item.quantity || 0));
                          }, 0);
                        }, 0);

                        const rateCommission = ((sessionUser.commissionRate || 0) > 0) ? (totalSales * (sessionUser.commissionRate || 0)) / 100 : 0;
                        const totalCommissions = productCommissions + rateCommission;
                        const totalSalary = (sessionUser.baseSalary || 0) + totalCommissions;
                        
                        return (
                          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-amber-600" />
                                <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Liquidación del Turno</span>
                              </div>
                              <span className="text-xs font-black text-amber-900 uppercase">
                                {sessionUser?.name || "Vendedor"}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-100">
                              <div>
                                <p className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">Salario Base</p>
                                <p className="text-sm font-black text-amber-900">{formatMoney(sessionUser.baseSalary || 0, baseCurrency.symbol)}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">Comisiones Ventas</p>
                                <p className="text-sm font-black text-emerald-700">+{formatMoney(totalCommissions, baseCurrency.symbol)}</p>
                                {productCommissions > 0 && (
                                  <p className="text-[7px] text-emerald-600 font-bold mt-0.5">({formatMoney(productCommissions, baseCurrency.symbol)} por productos)</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="pt-2 border-t border-amber-100 flex justify-between items-center">
                              <span className="text-[9px] font-black text-amber-900 uppercase">Total a Entregar</span>
                              <span className="text-lg font-black text-amber-600">{formatMoney(totalSalary, baseCurrency.symbol)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Arqueo de Efectivo Físico</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {currencies.map(c => (
                          <div key={c.code} className="bg-slate-50 p-3 rounded-xl border border-slate-100 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                            <label className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Efectivo {c.code}</label>
                            <input 
                              type="number" 
                              min="0" step="0.01"
                              value={closingBalances[`${c.code}-cash`] || ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setClosingBalances({ ...closingBalances, [`${c.code}-cash`]: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border-none focus:ring-0 outline-none font-black text-slate-900 text-sm p-0"
                              placeholder="0.00"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Transferencias</h4>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <label className="block text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Transf. CUP</label>
                        <input 
                          type="number" 
                          min="0" step="0.01"
                          value={closingBalances['CUP-transfer'] || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setClosingBalances({ ...closingBalances, 'CUP-transfer': parseFloat(e.target.value) || 0 })}
                          className="w-full bg-transparent border-none focus:ring-0 outline-none font-black text-slate-900 text-sm p-0"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        type="submit"
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Cerrar Turno y Finalizar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Modal */}
      {showDiscrepancyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 border border-rose-100 flex flex-col max-h-[90vh]">
            <div className="p-6 text-center space-y-4 shrink-0 border-b border-slate-100 bg-rose-50/30">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Discrepancia Detectada</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Revisión del Descuadre</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumen de Descuadres</p>
                    <div className="space-y-2">
                      {expectedBalances.map(eb => {
                        const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
                        const diff = actual - eb.amount;
                        if (Math.abs(diff) < 0.01) return null;
                        
                        return (
                          <div key={`${eb.currencyCode}-${eb.method}`} className="space-y-2 border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-600 uppercase">{eb.currencyCode} ({eb.method === 'cash' ? 'Efectivo' : 'Transf.'})</span>
                              <span className={cn(
                                "text-xs font-black",
                                diff > 0 ? "text-emerald-600" : "text-rose-600"
                              )}>
                                {diff > 0 ? 'SOBRANTE: +' : 'FALTANTE: '}{diff.toLocaleString('es-CU')}
                              </span>
                            </div>
                            

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">¿Descontar faltante del salario?</p>
                        <p className="text-[8px] font-bold text-rose-500 uppercase">Se aplicará automáticamente a la liquidación</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setDeductFromSalary(!deductFromSalary)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative border-2",
                          deductFromSalary ? "bg-rose-600 border-rose-600" : "bg-slate-200 border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                          deductFromSalary ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                onClick={() => setShowDiscrepancyModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
              >
                Volver a Revisar
              </button>
              <button 
                onClick={confirmClose}
                className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
              >
                Forzar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Configurar Producto */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Configurar Producto</h3>
              <p className="text-slate-500 mb-6">Completa los detalles para <span className="font-semibold text-slate-800">{selectedProduct?.name}</span>.</p>
              
              <form onSubmit={handleConfigSubmit} className="space-y-4">
                {selectedProduct?.hasSerial && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie (Opcional)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="Ej: SN-123456789" 
                        value={configData.serialNumber || ''}
                        onChange={(e) => setConfigData({...configData, serialNumber: e.target.value})}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                      />
                      <button type="button" onClick={generateSerial} className="px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors">
                        Generar
                      </button>
                    </div>
                  </div>
                )}
                
                {selectedProduct?.availableSizes && selectedProduct.availableSizes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Talla</label>
                    <select 
                      required
                      value={configData.selectedSize || ''}
                      onChange={(e) => setConfigData({...configData, selectedSize: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    >
                      {selectedProduct.availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                {selectedProduct?.availableColors && selectedProduct.availableColors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                    <select 
                      required
                      value={configData.selectedColor || ''}
                      onChange={(e) => setConfigData({...configData, selectedColor: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    >
                      {selectedProduct.availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => { setShowConfigModal(false); setConfigData({}); }}
                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* POS Tablet & Desktop Professional Top Bar */}
      <header className="bg-slate-900 text-white px-3 sm:px-4 py-2 flex items-center justify-between gap-2 border-b border-slate-800 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/80">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-200 truncate max-w-[110px] sm:max-w-[150px]">
              {currentSession?.workerName || currentUser?.name || 'Caja Activa'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
            <span>•</span>
            <span className="truncate max-w-[160px] text-slate-300 flex items-center gap-1.5">
              {branches.find(b => b.id === currentBranchId)?.name || branches[0]?.name || 'Sucursal General'}
              {isBranchLocked && (
                <span className="flex items-center gap-0.5 bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[8px] border border-amber-500/30">
                  <Lock className="w-2.5 h-2.5" /> Bloqueado
                </span>
              )}
            </span>
          </div>

          {/* Exchange Rates Ticker */}
          <div className="hidden md:flex items-center gap-2 bg-indigo-950/60 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
            {currencies.filter(c => !c.isBase).slice(0, 2).map(c => (
              <span key={c.code} className="text-[9px] font-black text-indigo-300">
                1 {c.code} = {c.rateToBase.toLocaleString('es-CU')} {baseCurrency.code}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Offline / Online Sync Status Badge */}
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingOffline}
            className={cn(
              "px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border active:scale-95",
              !isOnline
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : pendingOfflineCount > 0
                ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/50 cursor-pointer"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            )}
            title={pendingOfflineCount > 0 ? "Haz clic para sincronizar cambios pendientes con la nube" : (isOnline ? "Conectado a la base de datos" : "Sin conexión - guardando ventas localmente")}
          >
            {isSyncingOffline ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline">
              {!isOnline ? "Offline" : (pendingOfflineCount > 0 ? (isSyncingOffline ? "Subiendo..." : "Subir") : "Online")}
            </span>
            {pendingOfflineCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-amber-500 text-white shrink-0">
                {pendingOfflineCount}
              </span>
            )}
          </button>

          {/* Cierre de Caja Button - High Priority & Clearly Visible */}
          <button
            type="button"
            onClick={() => {
              setCashManagementTab('close');
              setShowCashManagementModal(true);
            }}
            className="px-2.5 sm:px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-rose-950/40 active:scale-95 border border-rose-500/40"
            title="Cerrar Caja y Finalizar Turno"
          >
            <Lock className="w-3.5 h-3.5 text-rose-200" />
            <span>Cerrar Caja</span>
          </button>

          {/* Cancelar Turno Button */}
          {currentSession && (
            <button
              type="button"
              onClick={() => setShowCancelShiftModal(true)}
              className="px-2 sm:px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-rose-600 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-slate-200 active:scale-95"
              title="Anular Turno Completo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Cancelar Turno</span>
            </button>
          )}

          {/* Printer Config (voluntary, never intrusive) */}
          <button
            type="button"
            onClick={() => setShowPrinterSetupModal(true)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all active:scale-95"
            title="Configurar Impresora Térmica"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-100 overflow-hidden relative">
        
        <POSCatalog
          baseCurrencySymbol={baseCurrency.symbol}
          currentUserRole={currentUser?.role}
          showMobileCart={showMobileCart}
          onSelectConfiguredProduct={handleProductClick}
          onOutOfStock={handleCatalogOutOfStock}
        />

        {/* Sidebar: Cart / Ticket (Side-by-side on Tablet md+ and Desktop, overlay on Mobile) */}
        {Boolean(currentSession) && (
          <aside className={cn(
            "w-full md:w-[310px] lg:w-[340px] xl:w-[360px] bg-secondary border-l border-base flex flex-col shrink-0 z-50 transition-all duration-300",
            showMobileCart ? "fixed inset-0 md:relative md:inset-auto" : "hidden md:flex"
          )}>
          {/* Sidebar Header */}
          <div className="h-12 border-b border-base flex items-center justify-between px-3.5 shrink-0 bg-subtle">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-xs">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-black text-[11px] uppercase tracking-wider text-primary leading-none">Ticket de Venta</h3>
                <p className="text-[8px] font-bold text-muted uppercase tracking-tight mt-0.5">{cart.reduce((s, i) => s + i.quantity, 0)} {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? 'artículo' : 'artículos'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={clearCart} className="p-1.5 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all" title="Limpiar Ticket">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowMobileCart(false)} className="md:hidden p-1.5 text-muted hover:bg-subtle rounded-lg transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Customer Selector */}
          <div className="p-2.5 bg-secondary border-b border-base flex gap-1.5">
            <div className="flex-1 relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
              <select 
                value={currentCustomerId || ""}
                onChange={(e) => setCartCustomer(e.target.value || undefined)}
                className="w-full pl-7 pr-3 py-1.5 bg-subtle border border-base rounded-lg outline-none text-[9px] font-bold uppercase tracking-tight text-primary focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
              >
                <option value="">Consumidor Final</option>
                {customers.map(c => (<option key={c.id} value={c.id}>{c?.name || "Cliente"}</option>))}
              </select>
            </div>
            <button onClick={() => setShowAddCustomerModal(true)} className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-900 hover:bg-indigo-100 transition-all" title="Registrar Cliente">
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted py-12 space-y-3">
                <div className="w-12 h-12 bg-subtle rounded-full flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-muted" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-secondary mb-0.5">Ticket Vacío</p>
                  <p className="text-[8px] font-medium uppercase text-muted">Toca productos del inventario</p>
                </div>
              </div>
            ) : (
              cart.map(item => {
                const prodObj = typeof (item.product as any) === 'object' && item.product !== null ? item.product : (products.find(p => p.id === (item.product as any)) || null);
                const prodName = (prodObj?.name || (typeof (item.product as any) === 'string' ? (item.product as any) : 'Producto')) as string;
                const prodPrice = prodObj?.price ?? item.price ?? 0;
                const prodImg = prodObj?.image || '';
                const prodColor = prodObj?.color || '';
                const prodId = (prodObj?.id || (typeof (item.product as any) === 'string' ? (item.product as any) : '')) as string;
                const prodHasSerial = prodObj?.hasSerial ?? false;

                return (
                  <div key={item.id} className="p-1.5 sm:p-2 rounded-xl bg-subtle border border-base hover:bg-secondary transition-colors flex gap-2">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-secondary rounded-lg overflow-hidden shrink-0 border border-base">
                      {prodImg ? (
                        <img 
                          src={prodImg} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '';
                            e.currentTarget.style.display = 'none';
                          }}
                         loading="lazy" decoding="async" />
                      ) : (
                        <div className={cn("w-full h-full opacity-20 flex items-center justify-center font-bold text-[9px] text-muted", prodColor)}>
                          {(prodName || "PR").substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex justify-between items-start gap-1">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[10px] font-bold text-primary leading-tight line-clamp-1">{prodName}</h4>
                          <p className="text-[8px] font-semibold text-muted">{formatMoney(prodPrice, baseCurrency.symbol)} / u.</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] sm:text-[11px] font-black text-primary font-mono">{formatMoney(prodPrice * item.quantity, baseCurrency.symbol)}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, -item.quantity)}
                            className="p-0.5 text-muted hover:text-rose-500 rounded transition-colors cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <div className="flex items-center bg-secondary rounded-md p-0.5 border border-base">
                          <button 
                            onClick={() => updateCartQty(item.id, -1)} 
                            className="p-0.5 sm:p-1 rounded hover:bg-subtle text-secondary hover:text-rose-500 transition-all active:scale-90 cursor-pointer"
                            title="Disminuir"
                          >
                            <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                          <span className="w-5 text-center text-[10px] font-black text-primary font-mono">{item.quantity}</span>
                          <button 
                            onClick={() => {
                              if (getCartQuantity(prodId, item.variantLabel) >= getProductStock(prodId, item.variantLabel)) {
                                setPosError("Stock insuficiente"); setTimeout(() => setPosError(""), 3000);
                              } else updateCartQty(item.id, 1);
                            }} 
                            disabled={prodHasSerial}
                            className="p-0.5 sm:p-1 rounded hover:bg-subtle text-secondary hover:text-indigo-600 transition-all disabled:opacity-20 active:scale-90 cursor-pointer"
                            title="Aumentar"
                          >
                            <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {item.variantLabel && <span className="px-1 py-0.2 bg-subtle text-secondary text-[7px] font-black rounded uppercase border border-base">{item.variantLabel}</span>}
                          {item.serialNumber && <span className="px-1 py-0.2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[7px] font-black rounded border border-indigo-100 dark:border-indigo-900">SN: {item.serialNumber}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Summary */}
          <div className="p-3 bg-secondary border-t border-base space-y-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold text-muted uppercase tracking-wider">
                <span>Subtotal</span>
                <span className="text-primary font-black">{formatMoney(subtotalBase, baseCurrency.symbol)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-base">
                <span className="text-[11px] font-black text-primary uppercase tracking-wider">Total</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{formatMoney(totalBase, baseCurrency.symbol)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <button 
                disabled={cart.length === 0}
                onClick={() => {
                  if (!currentSession) {
                    setPosError("Debes abrir un turno de caja antes de cobrar.");
                    setShowOpenShiftModal(true);
                    return;
                  }
                  const lineId = crypto.randomUUID();
                  setPaymentLines([{ id: lineId, code: baseCurrency.code, amount: totalBase, method: 'cash' }]);
                  setActivePaymentLineId(lineId);
                  setShowCheckoutModal(true);
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 disabled:opacity-20 active:scale-98 flex items-center justify-center gap-2"
              >
                <Banknote className="w-4 h-4 text-emerald-300" />
                Cobrar Efectivo
              </button>
              
              <div className="grid grid-cols-2 gap-1.5">
                <button 
                  disabled={cart.length === 0}
                  onClick={() => {
                    if (!currentSession) {
                      setPosError("Debes abrir un turno de caja antes de cobrar.");
                      setShowOpenShiftModal(true);
                      return;
                    }
                    const lineId = crypto.randomUUID();
                    setPaymentLines([{ id: lineId, code: baseCurrency.code, amount: totalBase, method: 'transfer' }]);
                    setActivePaymentLineId(lineId);
                    setShowCheckoutModal(true);
                  }}
                  className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-xs disabled:opacity-20 active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Transferir
                </button>
                <button 
                  disabled={cart.length === 0}
                  onClick={() => openCheckout()}
                  className="py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-xs disabled:opacity-20 active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cobro Mixto
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
      </div>

      {showReceiptModal && (
        <POSReceiptModal
          showReceiptModal={showReceiptModal}
          products={products}
          currencies={currencies}
          baseCurrency={baseCurrency}
          formatMoney={formatMoney}
          onClose={() => setShowReceiptModal(null)}
          onWhatsAppReceipt={handleWhatsAppReceipt}
          onThermalPrint={handleThermalPrint}
        />
      )}

      {returnConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-rose-100">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-2 animate-bounce">
                <ArrowLeftRight className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">¿Confirmar Devolución?</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
                Estás a punto de devolver <span className="text-rose-600">{returnConfirm.item.quantity}x {typeof returnConfirm.item.product === "object" ? (returnConfirm.item.product?.name || "Producto") : (products.find(p => p.id === returnConfirm.item.product)?.name || returnConfirm.item.product || "Producto")}</span>. 
                Esto reintegrará el stock a la sucursal actual.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button 
                  onClick={() => setReturnConfirm(null)}
                  className="py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleReturnItem}
                  className="py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSalarySummary && lastClosedSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[95] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            {/* Header: Compact & Sticky */}
            <div className="p-3.5 sm:p-4 text-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-1 border border-emerald-100 dark:border-emerald-900/50 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-100 dark:border-indigo-900">
                  {lastClosedSession.id}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {lastClosedSession.workerName || 'Vendedor'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mt-0.5">
                Turno Cerrado con Éxito
              </h3>
              <p className="text-[8px] sm:text-[9px] font-medium text-slate-400 uppercase tracking-wider">
                {new Date(lastClosedSession.closingDate || lastClosedSession.closedAt || new Date()).toLocaleString()}
              </p>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-5 space-y-3 text-left">
              {(() => {
                const sessionTransactions = activeTransactions.filter(t => 
                  t.branchId === lastClosedSession.branchId && 
                  t.sessionId === lastClosedSession.id
                );

                const employee = users.find(u => u.id === lastClosedSession.userId || u.name === lastClosedSession.workerName) || users.find(u => u.name?.toLowerCase() === lastClosedSession.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
                const isIndependent = employee?.isIndependent === true;

                const commissions = isIndependent ? 0 : sessionTransactions.reduce((sum, tx) => {
                  return sum + (tx.items || []).reduce((s, item) => {
                    const prodId = typeof item.product === 'string' ? item.product : item.product?.id;
                    const prod = products.find(p => p.id === prodId);
                    if (!prod) return s;
                    const commValue = prod.commissionValue || 0;
                    return s + (commValue * item.quantity);
                  }, 0);
                }, 0);

                const baseSalary = isIndependent ? 0 : (employee?.baseSalary || 0);
                const settlement = salarySettlements.find(s => s.sessionId === lastClosedSession.id);
                const deduction = settlement?.discrepancyDeduction || 0;
                const totalSalary = (baseSalary + commissions) - deduction;
                
                const totalSales = sessionTransactions.reduce((sum, tx) => sum + (tx.total || 0), 0);
                const totalItems = sessionTransactions.reduce((sum, tx) => sum + (tx.items || []).reduce((s, i) => s + (i.quantity || 0), 0), 0);

                // Group products for display
                const groupedProducts: { [name: string]: number } = {};
                sessionTransactions.forEach(tx => {
                  tx.items.forEach(item => {
                    const name = typeof item.product === 'string' ? item.product : item.product?.name;
                    if (name) groupedProducts[name] = (groupedProducts[name] || 0) + item.quantity;
                  });
                });

                return (
                  <div className="space-y-3">
                    {/* Resumen de Productos */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl sm:rounded-2xl p-3 border border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
                        <span>Resumen de Venta</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{totalItems} {totalItems === 1 ? 'unidad' : 'unidades'}</span>
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {Object.entries(groupedProducts).map(([name, qty]) => (
                          <div key={name} className="flex justify-between items-center text-[10px] sm:text-[11px] py-0.5 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px] sm:max-w-[240px]">{name}</span>
                            <span className="font-mono font-black text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-600 shrink-0">x{qty}</span>
                          </div>
                        ))}
                        {Object.keys(groupedProducts).length === 0 && (
                          <p className="text-[10px] text-slate-400 italic py-1">No se registraron ventas en este turno.</p>
                        )}
                      </div>
                    </div>

                    {/* Liquidación de Salario */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 border border-indigo-100 dark:border-indigo-900/50 space-y-2 shadow-2xs">
                      <div className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b border-indigo-50 dark:border-indigo-950 pb-1.5 flex justify-between">
                        <span>Liquidación de Salario</span>
                        <span className="text-slate-400 font-bold">{lastClosedSession.workerName}</span>
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase">Salario Base</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatMoney(baseSalary, baseCurrency.symbol)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase">Comisiones</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{formatMoney(commissions, baseCurrency.symbol)}</span>
                        </div>
                        
                        {deduction > 0 && (
                          <div className="flex justify-between items-center p-1.5 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-100 dark:border-rose-900/50">
                            <span className="font-bold text-rose-600 dark:text-rose-400 text-[9px] uppercase">Descuento Descuadre</span>
                            <span className="font-mono font-black text-rose-600 dark:text-rose-400">-{formatMoney(deduction, baseCurrency.symbol)}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 border-dashed flex justify-between items-center">
                        <div>
                          <span className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-wider block">Neto a Recibir</span>
                          <span className="text-[7px] font-bold text-slate-400 uppercase">Liquidación Total Turno</span>
                        </div>
                        <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">
                          {formatMoney(totalSalary, baseCurrency.symbol)}
                        </span>
                      </div>
                    </div>

                    {/* Totales de Turno */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-2.5 border border-emerald-100 dark:border-emerald-900/50">
                        <p className="text-[8px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Total Vendido</p>
                        <p className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono">{formatMoney(totalSales, baseCurrency.symbol)}</p>
                      </div>
                      <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-2.5 text-white">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">Ventas Turno</p>
                        <p className="text-xs sm:text-sm font-black font-mono">{sessionTransactions.length} Tickets</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Action Footer - Sticky and Compact */}
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-1.5 shrink-0">
              <div className="grid grid-cols-2 gap-1.5">
                <button 
                  onClick={() => handlePrintClosureThermal(lastClosedSession)}
                  className="py-2.5 px-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Impresión Térmica 58mm"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>Imprimir 58mm</span>
                </button>

                <button 
                  onClick={() => handlePrintClosureThermal(lastClosedSession, { preferRawBT: true })}
                  className="py-2.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Imprimir con RawBT (Android)"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>RawBT</span>
                </button>
              </div>

              <button 
                onClick={() => {
                  setShowSalarySummary(false);
                  navigate('/');
                }}
                className="w-full py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-750 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Finalizar e Ir al Menú</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 border border-white/20">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Nuevo Cliente</h3>
                <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-3">
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</label>
                  <input 
                    required 
                    type="text" 
                    value={newCustomer.name} 
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</label>
                  <input 
                    type="text" 
                    value={newCustomer.phone} 
                    onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Email (Opcional)</label>
                  <input 
                    type="email" 
                    value={newCustomer.email} 
                    onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">CI o Pasaporte</label>
                  <input 
                    type="text" 
                    value={newCustomer.taxId} 
                    onChange={e => setNewCustomer({...newCustomer, taxId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                    placeholder="Número de identidad"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                  Guardar Cliente
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart & Quick Checkout Bottom Bar: Visible ONLY on small mobile screens (< md) */}
      {Boolean(currentSession) && !showMobileCart && (
        isBottomBarMinimized ? (
          <button
            type="button"
            onClick={() => setIsBottomBarMinimized(false)}
            className="md:hidden fixed bottom-3 right-3 z-40 bg-slate-900 text-white p-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 active:scale-95 animate-in fade-in"
            title="Expandir barra de ticket"
          >
            <div className="relative shrink-0">
              <ShoppingCart className="w-4 h-4 text-indigo-400" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-slate-900">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <span className="text-[9px] font-black uppercase pr-1">
              {cart.length === 0 ? "Ticket" : formatMoney(totalBase, baseCurrency.symbol)}
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        ) : (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 text-white px-3 py-2 pb-[max(0.625rem,env(safe-area-inset-bottom,12px))] shadow-[0_-8px_30px_rgba(0,0,0,0.3)] border-t border-slate-800 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2">
            <div 
              onClick={() => setShowMobileCart(true)}
              className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-950">
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 truncate">
                  {cart.length === 0 ? "Ticket" : "Total"}
                </div>
                <div className="text-xs font-black text-white truncate">
                  {cart.length === 0 ? "0 prod." : formatMoney(totalBase, baseCurrency.symbol)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowMobileCart(true)}
                className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 border border-slate-700 shadow-sm"
              >
                <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ticket</span>
              </button>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={openCheckout}
                className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-950 active:scale-95 flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cobrar</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBottomBarMinimized(true)}
                className="h-8 w-7 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors flex items-center justify-center shrink-0 border border-slate-700"
                title="Minimizar barra"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      )}

      {/* Hidden printable area for shift closure thermal receipt */}
      {lastClosedSession && (
        <div id="print-closure-area" className="hidden font-mono text-[11px] leading-tight text-black bg-white p-2">
          {(() => {
            const sessionTx = activeTransactions.filter(t => 
              t.sessionId === lastClosedSession.id && !t.deletedAt
            );

            const soldMap: { [name: string]: { name: string, qty: number, total: number } } = {};
            sessionTx.forEach(tx => {
              (tx.items || []).forEach(item => {
                const name = typeof item.product === 'string' ? item.product : (item.product?.name || 'Producto');
                if (!soldMap[name]) soldMap[name] = { name, qty: 0, total: 0 };
                const price = typeof item.product === 'object' ? (item.product?.price || 0) : 0;
                soldMap[name].qty += item.quantity;
                soldMap[name].total += (price * item.quantity);
              });
            });
            const soldList = Object.values(soldMap);
            const totalSales = sessionTx.reduce((sum, tx) => sum + tx.total, 0);

            const commissions = sessionTx.reduce((sum, tx) => {
              return sum + (tx.items || []).reduce((s, item) => {
                const prodId = typeof item.product === 'string' ? item.product : item.product?.id;
                const prod = products.find(p => p.id === prodId);
                if (!prod) return s;
                const commValue = prod.commissionValue || 0;
                return s + (commValue * item.quantity);
              }, 0);
            }, 0);

            const employee = users.find(u => u.id === lastClosedSession.userId || u.name === lastClosedSession.workerName) || users.find(u => u.name?.toLowerCase() === lastClosedSession.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
            const baseSalary = employee?.baseSalary || 0;
            const totalSalary = baseSalary + commissions;

            return (
              <div className="space-y-1">
                <div className="text-center font-black text-sm uppercase">{receiptConfig?.businessName || 'MARÉ POS'}</div>
                {receiptConfig?.showAddress && receiptConfig?.businessAddress && (
                  <div className="text-center text-[9px]">{receiptConfig.businessAddress}</div>
                )}
                {receiptConfig?.showPhone && receiptConfig?.businessPhone && (
                  <div className="text-center text-[9px]">{receiptConfig.businessPhone}</div>
                )}
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="text-center font-black uppercase text-xs">CIERRE DE CAJA / LIQUIDACIÓN</div>
                <div className="flex justify-between text-[10px]">
                  <span>TURNO:</span>
                  <span className="font-bold">{lastClosedSession.id}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>FECHA:</span>
                  <span>{new Date(lastClosedSession.closingDate || lastClosedSession.closedAt || new Date()).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>VENDEDOR:</span>
                  <span className="font-bold uppercase">{lastClosedSession.workerName || 'VENDEDOR'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>SUCURSAL:</span>
                  <span>{branches.find(b => b.id === lastClosedSession.branchId)?.name || 'Central'}</span>
                </div>
                
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="font-bold text-[10px] uppercase">PRODUCTOS VENDIDOS ({soldList.reduce((s, i) => s + i.qty, 0)}):</div>
                {soldList.length === 0 ? (
                  <div className="text-[10px] italic">Sin ventas registradas en el turno</div>
                ) : (
                  soldList.map((p, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="truncate max-w-[170px]">{p.qty}x {p?.name || "Producto"}</span>
                      <span className="font-bold">{formatMoney(p.total, baseCurrency.symbol)}</span>
                    </div>
                  ))
                )}
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="flex justify-between font-black text-xs">
                  <span>VENTA TOTAL:</span>
                  <span>{formatMoney(totalSales, baseCurrency.symbol)}</span>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>
                <div className="font-bold text-[10px] uppercase">ARQUEO DE FONDOS:</div>
                <div className="flex justify-between text-[10px]">
                  <span>Fondo Inicial:</span>
                  <span>{formatMoney(lastClosedSession.openingBalance, baseCurrency.symbol)}</span>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>
                <div className="font-bold text-[10px] uppercase">LIQUIDACIÓN DE SALARIO:</div>
                <div className="flex justify-between text-[10px]">
                  <span>Salario Base:</span>
                  <span>{formatMoney(baseSalary, baseCurrency.symbol)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Comisiones Productos:</span>
                  <span>+{formatMoney(commissions, baseCurrency.symbol)}</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-1 border-t border-dotted border-black">
                  <span>SALARIO A PAGAR:</span>
                  <span>{formatMoney(totalSalary, baseCurrency.symbol)}</span>
                </div>

                <div className="border-t border-dashed border-black my-4"></div>
                <div className="pt-6 text-center text-[9px] border-t border-black">
                  Firma del Vendedor
                </div>
                <div className="pt-6 text-center text-[9px] border-t border-black">
                  Firma Supervisor / Administrador
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showPrinterSetupModal && (
        <POSPrinterSetupModal
          connectedPrinterName={connectedPrinterName}
          printerStatusMsg={printerStatusMsg}
          isConnectingPrinter={isConnectingPrinter}
          onClose={() => setShowPrinterSetupModal(false)}
          onPairBluetooth={handlePairBluetooth}
          onConnectUsb={handleConnectUsb}
          onPrinterConnectedChange={setConnectedPrinterName}
          onSuccess={(message) => {
            setPosSuccess(message);
            if (message) setTimeout(() => setPosSuccess(""), 2500);
          }}
          onError={(message) => {
            setPosError(message);
            if (message) setTimeout(() => setPosError(""), 3000);
          }}
        />
      )}

      {/* Modal para Cancelar Turno */}
      {showCancelShiftModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-rose-100">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto rotate-12 shadow-lg shadow-rose-100">
                <Trash2 className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">¿Cancelar Turno?</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
                  Esta acción anulará las ventas de este turno, revertirá el inventario y conservará el turno como "Cancelado" en el historial. Se requiere contraseña.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="password"
                    autoFocus
                    placeholder="Contraseña del Trabajador"
                    value={cancelShiftPassword}
                    onChange={(e) => setCancelShiftPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCancelShift()}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-black text-center tracking-[0.5em]"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setShowCancelShiftModal(false);
                      setCancelShiftPassword("");
                    }}
                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                  >
                    Volver
                  </button>
                  <button 
                    onClick={handleCancelShift}
                    className="flex-2 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                  >
                    Confirmar Anulación
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
